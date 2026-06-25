#!/usr/bin/env python3
"""
ProcessCapture Extraction Pipeline
===================================
Takes a screen recording (video + audio) and extracts:
1. Frames at 1 FPS
2. OCR text from each frame
3. Audio transcription (via faster-whisper or OpenAI Whisper API)
4. Structured timeline JSON

Usage:
    python3 extract.py <video_path> <project_dir>
"""

import sys
import os
import json
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime

def extract_frames(video_path: str, output_dir: str, fps: int = 1) -> list[dict]:
    """Extract frames from video at specified FPS using ffmpeg."""
    frames_dir = os.path.join(output_dir, 'frames')
    os.makedirs(frames_dir, exist_ok=True)

    # Extract frames
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-vf', f'fps={fps}',
        '-q:v', '2',  # JPEG quality
        os.path.join(frames_dir, 'frame_%06d.jpg')
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    # Get video duration for timestamp calculation
    duration_cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        video_path
    ]
    result = subprocess.run(duration_cmd, capture_output=True, text=True)
    duration = float(result.stdout.strip()) if result.stdout.strip() else 0

    # Build frame list with timestamps
    frames = []
    frame_files = sorted(Path(frames_dir).glob('frame_*.jpg'))
    for i, frame_path in enumerate(frame_files):
        timestamp = i / fps
        frames.append({
            'index': i,
            'timestamp': timestamp,
            'timestamp_str': f"{int(timestamp // 60)}:{int(timestamp % 60):02d}",
            'file': str(frame_path),
        })

    return frames

def extract_audio(video_path: str, output_dir: str) -> str:
    """Extract audio from video as WAV."""
    audio_path = os.path.join(output_dir, 'audio.wav')
    cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        audio_path
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return audio_path

def transcribe_audio(audio_path: str) -> list[dict]:
    """
    Transcribe audio to text with timestamps.
    Tries faster-whisper (local) first, falls back to OpenAI API.
    """
    segments = []

    # Try faster-whisper (local, no API key needed)
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel('base', device='cpu', compute_type='int8')
        segs, _ = model.transcribe(audio_path, beam_size=5)
        for seg in segs:
            segments.append({
                'start': seg.start,
                'end': seg.end,
                'text': seg.text.strip(),
            })
        return segments
    except ImportError:
        print("[extract] faster-whisper not installed, trying OpenAI API...")

    # Fall back to OpenAI Whisper API
    try:
        import openai
        client = openai.OpenAI()
        with open(audio_path, 'rb') as f:
            result = client.audio.transcriptions.create(
                model='whisper-1',
                file=f,
                response_format='verbose_json',
            )
            for seg in result.segments:
                segments.append({
                    'start': seg.start,
                    'end': seg.end,
                    'text': seg.text.strip(),
                })
        return segments
    except Exception as e:
        print(f"[extract] Transcription failed: {e}")
        return []

def ocr_frames(frames: list[dict]) -> list[dict]:
    """
    Run OCR on each frame to extract visible text.
    Uses Tesseract via pytesseract.
    """
    try:
        from PIL import Image
        import pytesseract
    except ImportError:
        print("[extract] pytesseract not installed, skipping OCR")
        return frames

    for frame in frames:
        try:
            image = Image.open(frame['file'])
            text = pytesseract.image_to_string(image)
            frame['ocr_text'] = text.strip()
        except Exception as e:
            frame['ocr_text'] = ''
            print(f"[extract] OCR failed for frame {frame['index']}: {e}")

    return frames

def build_timeline(frames: list[dict], transcript: list[dict]) -> dict:
    """Combine frames and transcript into a structured timeline."""
    # Match transcript segments to frames by timestamp
    for frame in frames:
        frame['transcript'] = ''
        for seg in transcript:
            if seg['start'] <= frame['timestamp'] <= seg['end']:
                frame['transcript'] += seg['text'] + ' '

    # Detect changes between frames (text differences)
    for i, frame in enumerate(frames):
        if i == 0:
            frame['changes'] = 'initial'
            continue

        prev_text = frames[i - 1].get('ocr_text', '')
        curr_text = frame.get('ocr_text', '')

        if prev_text != curr_text:
            # Simple diff — what's new
            prev_words = set(prev_text.split())
            curr_words = set(curr_text.split())
            added = curr_words - prev_words
            removed = prev_words - curr_words
            frame['changes'] = {
                'added': list(added)[:20],  # Limit to avoid noise
                'removed': list(removed)[:20],
            }
        else:
            frame['changes'] = 'none'

    return {
        'total_frames': len(frames),
        'total_segments': len(transcript),
        'frames': frames,
        'transcript': transcript,
    }

def save_timeline(timeline: dict, output_dir: str) -> str:
    """Save timeline as JSON."""
    timeline_path = os.path.join(output_dir, 'timeline.json')
    with open(timeline_path, 'w') as f:
        json.dump(timeline, f, indent=2)
    return timeline_path

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 extract.py <video_path> <project_dir>")
        sys.exit(1)

    video_path = sys.argv[1]
    project_dir = sys.argv[2]

    if not os.path.exists(video_path):
        print(f"Error: Video not found: {video_path}")
        sys.exit(1)

    os.makedirs(project_dir, exist_ok=True)

    print(f"[extract] Processing: {video_path}")
    print(f"[extract] Output: {project_dir}")

    # Step 1: Extract frames
    print("[extract] Extracting frames (1 FPS)...")
    frames = extract_frames(video_path, project_dir, fps=1)
    print(f"[extract] Extracted {len(frames)} frames")

    # Step 2: Extract audio
    print("[extract] Extracting audio...")
    audio_path = extract_audio(video_path, project_dir)

    # Step 3: Transcribe audio
    print("[extract] Transcribing audio...")
    transcript = transcribe_audio(audio_path)
    print(f"[extract] Transcribed {len(transcript)} segments")

    # Step 4: OCR frames
    print("[extract] Running OCR on frames...")
    frames = ocr_frames(frames)

    # Step 5: Build timeline
    print("[extract] Building timeline...")
    timeline = build_timeline(frames, transcript)

    # Step 6: Save timeline
    timeline_path = save_timeline(timeline, project_dir)
    print(f"[extract] Timeline saved: {timeline_path}")

    # Step 7: Run AI analysis
    print("[extract] Running AI workflow analysis...")
    from analyze import analyze_workflow
    report = analyze_workflow(timeline, project_dir)

    report_path = os.path.join(project_dir, 'report.md')
    with open(report_path, 'w') as f:
        f.write(report)
    print(f"[extract] Report saved: {report_path}")

    print("[extract] Done!")

if __name__ == '__main__':
    main()