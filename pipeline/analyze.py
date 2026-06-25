#!/usr/bin/env python3
"""
ProcessCapture AI Workflow Analyzer
====================================
Takes the extracted timeline and runs multi-pass LLM analysis to produce
a structured workflow report.

Pass 1: Extract process steps from timeline
Pass 2: Identify patterns, bottlenecks, and tribal knowledge
Pass 3: Generate recommendations (deterministic vs agent vs human)
"""

import json
import os
import sys
from typing import Optional

def get_llm_client():
    """Get LLM client. Supports OpenAI-compatible APIs."""
    # Check for API key — works with OpenAI, Cerebras, SambaNova, any OpenAI-compatible
    api_key = os.environ.get('OPENAI_API_KEY') or os.environ.get('CEREBRAS_API_KEY') or os.environ.get('PROCESSCAPTURE_API_KEY')
    base_url = os.environ.get('OPENAI_API_BASE') or os.environ.get('CEREBRAS_API_BASE') or 'https://api.openai.com/v1'
    model = os.environ.get('PROCESSCAPTURE_MODEL') or 'gpt-4o'

    if not api_key:
        raise ValueError(
            "No API key found. Set OPENAI_API_KEY, CEREBRAS_API_KEY, or PROCESSCAPTURE_API_KEY. "
            "Also set OPENAI_API_BASE if using a non-OpenAI provider."
        )

    from openai import OpenAI
    return OpenAI(api_key=api_key, base_url=base_url), model

def format_timeline_for_llm(timeline: dict, max_chars: int = 50000) -> str:
    """Format the timeline into a text representation for the LLM."""
    lines = []
    for frame in timeline['frames']:
        ts = frame.get('timestamp_str', '')
        ocr = frame.get('ocr_text', '')[:500]  # Limit OCR text per frame
        transcript = frame.get('transcript', '').strip()

        line_parts = [f"[{ts}]"]

        if transcript:
            line_parts.append(f"Audio: {transcript}")

        if ocr:
            line_parts.append(f"Screen: {ocr[:200]}")

        changes = frame.get('changes')
        if isinstance(changes, dict) and changes.get('added'):
            line_parts.append(f"Changed: {', '.join(changes['added'][:10])}")

        lines.append(' | '.join(line_parts))

    result = '\n'.join(lines)
    if len(result) > max_chars:
        result = result[:max_chars] + '\n[...truncated...]'
    return result

PASS1_PROMPT = """You are a workflow analyst. You are reviewing a screen recording timeline of someone performing their work.

The timeline contains timestamped OCR text (what's visible on screen) and audio transcript (what the person said).

Your task: Extract a detailed step-by-step process map.

For each step, identify:
- Step number and timestamp
- Action description (what they did)
- Tool/system used (what application or website)
- Duration (approximate)
- Decision points (where they chose between options)
- Errors or issues encountered
- Implicit knowledge (things they did without explaining)

Also identify:
- Overall goal (what were they trying to accomplish?)
- Whether the goal was achieved
- Any stated vs actual process differences

Output as structured JSON:
{
  "goal": "what they were trying to do",
  "goal_achieved": true/false,
  "steps": [
    {
      "step": 1,
      "timestamp": "0:00",
      "action": "description",
      "tool": "what they used",
      "duration_seconds": 15,
      "decision_point": null or "description of decision",
      "error": null or "what went wrong",
      "implicit_knowledge": null or "what they knew but didn't explain"
    }
  ],
  "stated_vs_actual": "any differences between what they said they'd do and what they did"
}

Timeline:
"""

PASS2_PROMPT = """You are a workflow analyst reviewing a structured process map extracted from a screen recording.

Your task: Identify patterns, bottlenecks, and insights.

Analyze for:
1. BOTTLENECKS — Steps that were slow, repetitive, or manual. Include timestamps and duration.
2. SUCCESSES — Steps that were efficient, used shortcuts, or worked well.
3. FAILURES — Errors, rework, confusion, dead ends.
4. TRIBAL KNOWLEDGE — Steps performed without explanation that required implicit knowledge.
5. EXCEPTIONS — Edge cases, unusual handling, deviations from the normal path.
6. TOOLS USED — Complete inventory of applications, websites, and systems.
7. CONTEXT SWITCHING — Times when the user switched between tools unnecessarily.

Output as structured JSON:
{
  "bottlenecks": [{"step": 1, "issue": "...", "timestamp": "...", "duration_seconds": 0, "potential_automation": "..."}],
  "successes": [{"step": 1, "what_worked": "...", "timestamp": "..."}],
  "failures": [{"step": 1, "what_failed": "...", "timestamp": "...", "recovery": "..."}],
  "tribal_knowledge": [{"step": 1, "knowledge": "...", "how_they_knew": "..."}],
  "exceptions": [{"step": 1, "what_happened": "...", "handling": "..."}],
  "tools_used": [{"name": "...", "purpose": "...", "frequency": 1}],
  "context_switches": [{"from": "...", "to": "...", "timestamp": "...", "unnecessary": true/false}]
}

Process map:
"""

PASS3_PROMPT = """You are an AI agent architect. You are reviewing a workflow analysis from a screen recording.

Your task: Generate the final workflow report with recommendations.

Based on the process map and pattern analysis, produce a Markdown report with these sections:

## Executive Summary
Brief overview of what was recorded and key findings (2-3 sentences).

## Process Map
Numbered list of steps with timestamps and durations. Mark decision points with ↳.

## Tools & Systems Used
Bulleted list of each tool and how it was used.

## Goals
What the user was trying to accomplish and whether it was achieved.

## Successes
What worked well and efficient patterns.

## Failures & Issues
What went wrong, with timestamps.

## Bottlenecks
Slow or manual steps, with timestamps and potential automation.

## Tribal Knowledge Detected
Steps that required implicit knowledge the user didn't explain.

## Automation Opportunities
Table with columns: Step | Type (Deterministic/Agent/Human) | ROI (10x/5x/2x/sub-1x) | Recommendation

## Agent Design Recommendations
- **Deterministic:** Steps that should be automated with code
- **Agent:** Steps that need AI judgment
- **Human:** Steps that should remain human

Be specific and actionable. This report will be used to design AI agents for this workflow.

Process map:
{process_map}

Pattern analysis:
{pattern_analysis}
"""

def run_llm_pass(client, model: str, prompt: str, content: str) -> str:
    """Run a single LLM pass."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a workflow analyst AI. You analyze screen recordings to extract structured workflow documentation. Always respond with valid JSON when asked for JSON."},
            {"role": "user", "content": prompt + content},
        ],
        temperature=0.3,
        max_tokens=4096,
    )
    return response.choices[0].message.content

def analyze_workflow(timeline: dict, project_dir: str) -> str:
    """Run multi-pass LLM analysis and generate report."""
    try:
        client, model = get_llm_client()
    except ValueError as e:
        return f"# Workflow Report\n\n**Error:** {e}\n\nThe extraction pipeline ran successfully, but no LLM API key was configured. Set OPENAI_API_KEY or CEREBRAS_API_KEY to generate AI analysis reports.\n\n## Raw Timeline\n\nSee `timeline.json` in the project directory for the extracted data."

    # Load metadata if available
    metadata = {}
    metadata_path = os.path.join(project_dir, 'recording_' + '.json')
    # Find the metadata file
    for f in os.listdir(project_dir):
        if f.endswith('.json') and f != 'timeline.json':
            with open(os.path.join(project_dir, f)) as fh:
                metadata = json.load(fh)
            break

    project_name = metadata.get('project', 'Unknown Workflow')
    checklist = metadata.get('checklist', [])

    # Format timeline for LLM
    timeline_text = format_timeline_for_llm(timeline)

    # Add context from metadata
    context = f"\n\nWorkflow name: {project_name}\nStated goals: {', '.join(checklist) if checklist else 'Not specified'}\n"
    timeline_text += context

    print("[analyze] Pass 1: Extracting process steps...")
    pass1_result = run_llm_pass(client, model, PASS1_PROMPT, timeline_text)

    print("[analyze] Pass 2: Identifying patterns and bottlenecks...")
    pass2_result = run_llm_pass(client, model, PASS2_PROMPT, pass1_result)

    print("[analyze] Pass 3: Generating final report...")
    pass3_content = PASS3_PROMPT.replace('{process_map}', pass1_result).replace('{pattern_analysis}', pass2_result)
    final_report = run_llm_pass(client, model, "", pass3_content)

    # Add header
    header = f"# Workflow Analysis: {project_name}\n"
    header += f"**Date:** {metadata.get('timestamp', 'Unknown')}\n"
    header += f"**Recorded by:** ProcessCapture\n\n"

    return header + final_report

if __name__ == '__main__':
    # Standalone usage
    if len(sys.argv) < 3:
        print("Usage: python3 analyze.py <timeline.json> <project_dir>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        timeline = json.load(f)

    report = analyze_workflow(timeline, sys.argv[2])
    print(report)