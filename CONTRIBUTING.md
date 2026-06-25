# Contributing to ProcessCapture

Thanks for your interest in contributing! This is an early-stage project and there's plenty of room to help.

## Development Setup

### Prerequisites

- Node.js 20+
- Python 3.10+
- ffmpeg (system install)
- Tesseract OCR (system install)

### Getting Started

```bash
git clone https://github.com/FranklinIV94/processcapture.git
cd processcapture
npm install
pip install faster-whisper pytesseract pillow openai
npm run dev
```

### Project Structure

- `electron/` — Electron main process (screen capture, IPC, file management)
- `src/` — React frontend (UI components)
- `pipeline/` — Python extraction and analysis pipeline
- `schemas/` — JSON schemas for recording metadata and timeline data

### Development Workflow

1. Fork the repo and create a feature branch
2. Make your changes
3. Ensure CI passes: `npm run lint && npm run build`
4. Test the extraction pipeline: `python3 pipeline/extract.py <video_path> <output_dir>`
5. Open a PR with a clear description of what changed and why

### Code Style

- TypeScript: strict mode, no unused locals/params
- Python: PEP 8, type hints where practical
- React: functional components, hooks

### Reporting Issues

When reporting bugs, include:

- Operating system and version
- Node.js and Python versions
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or logs

### Areas That Need Help

- Cross-platform screen capture (currently Linux-only via ffmpeg x11grab)
- Electron builder configuration for distributable packages
- Web-based report viewer
- BPMN/flowchart export
- Internationalization

## Code of Conduct

Be respectful, be constructive, be patient. We're building something useful together.