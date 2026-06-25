# ProcessCapture

**Record your work. AI documents your processes.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Beta](https://img.shields.io/badge/Status-Beta-orange.svg)]()

ProcessCapture is an open-source, self-hosted screen recorder with an AI agent built in. It records you performing your work, then an AI agent reviews the recording and produces a detailed workflow analysis report — processes, goals, successes, failures, bottlenecks, and structured documentation ready for automation design.

## Why?

Every company trying to adopt AI runs into the same wall: they don't actually know how their work happens. They have process docs that nobody follows, SOPs that are out of date, and tribal knowledge that lives in one person's head.

ProcessCapture solves the first mile of AI adoption. Instead of asking people to describe their work (they can't), you record them doing it. The AI watches the recording and writes the documentation for you.

> "A considerable portion of tribal knowledge isn't true expertise — it's workarounds people built for broken systems. If you just capture it and encode it into the agent, you've automated the dysfunction."
> — Ahmad Kakar, CEO of Euclid

## How It Works

1. **Record** — Open ProcessCapture, name the workflow you're about to perform, hit record
2. **Work** — Just do your normal work. Narrate what you're doing (optional but helpful)
3. **Analyze** — When you stop, ProcessCapture extracts frames, transcribes audio, and runs AI analysis
4. **Report** — Get a structured workflow report with process maps, bottlenecks, automation opportunities, and agent design recommendations

## Features

- 🎥 Screen + audio recording (full screen, window, or region)
- ✅ Pre-recording checklist (state your goals before you start)
- 🖼️ Frame extraction with OCR (text visible on screen is captured)
- 🎙️ Audio transcription (via faster-whisper locally or Whisper API)
- 🤖 Multi-pass AI analysis (process extraction → pattern identification → recommendations)
- 📊 Structured report output (Markdown + JSON)
- 🔒 Privacy-first (everything runs locally, your data never leaves your machine)
- 🏠 Self-hosted (no cloud dependencies, no subscriptions)

## Report Output

Each recording produces a workflow report with:

- **Executive Summary** — What was recorded and key findings
- **Process Map** — Step-by-step breakdown with timestamps and durations
- **Tools & Systems Used** — Complete inventory of applications interacted with
- **Goals** — What was attempted and whether it was achieved
- **Successes** — What worked well and efficient patterns
- **Failures & Issues** — Errors, rework, confusion points
- **Bottlenecks** — Slow steps with automation potential
- **Tribal Knowledge** — Implicit knowledge the user applied without explaining
- **Automation Opportunities** — Table with ROI ratings (10x/5x/2x/sub-1x)
- **Agent Design Recommendations** — What should be deterministic, what needs AI judgment, what stays human

## Installation

### Prerequisites

- Node.js 20+
- Python 3.10+
- ffmpeg (system install)
- Tesseract OCR (system install)
- An LLM API key (OpenAI, Cerebras, SambaNova, or any OpenAI-compatible provider)

### Install

```bash
git clone https://github.com/albs-business/processcapture.git
cd processcapture
npm install
pip install faster-whisper pytesseract pillow openai
```

### Configure

```bash
# Set your LLM API key (any OpenAI-compatible provider)
export OPENAI_API_KEY="your-key-here"

# Optional: Use a different provider (Cerebras, SambaNova, etc.)
export OPENAI_API_BASE="https://api.cerebras.ai/v1"
export PROCESSCAPTURE_MODEL="gpt-oss-120b"
```

### Run

```bash
npm run dev
```

## Use Cases

- **AI/Agent deployments** — Understand how work actually happens before building automation
- **Process documentation** — Generate SOPs from real work, not interviews
- **Onboarding** — Record your best performer, generate training materials
- **Compliance** — Document regulated processes with timestamps and evidence
- **Operations audit** — Find bottlenecks and manual steps eating your team's time

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop app | Electron + React + TypeScript + Tailwind |
| Screen capture | ffmpeg |
| Audio transcription | faster-whisper (local) / Whisper API |
| OCR | Tesseract |
| AI analysis | Any OpenAI-compatible LLM |
| Storage | Local filesystem |

## License

MIT — Free to use, modify, and commercialize.

## Built By

[ALL LINES BUSINESS SOLUTIONS](https://simplifyingbusinesses.com) — We deploy AI agents for businesses. ProcessCapture is the first tool we use in every engagement, because you can't automate what you don't understand.

## Contributing

Contributions welcome. This is an early beta — expect rough edges.