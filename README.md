# HuskyNote — Your Local AI Secretary

> Capture it. Understand it. Keep it.

HuskyNote is a production-quality, local AI secretary for note-taking, meetings, documents, and operations. It captures what happens across meetings, documents, computer operations, and notes, organizing and synthesizing them using local AI models without sacrificing user privacy.

Repository: https://github.com/ChristianJayCuevas/HuskyNote

Project planning: [Roadmap](ROADMAP.md) covers priorities, milestones, and acceptance criteria.

---

## Overview

Modern knowledge work is fragmented across meetings, documents, screen procedures, and ad-hoc notes. HuskyNote unifies these workflows into a cohesive, privacy-centric workspace:

- Meeting Secretary: Real browser audio recording, live transcripts, clickable milestone timelines, and local AI synthesis of decisions and action items.
- Portable backups: **Settings → Storage** prepares a binary-inclusive `.huskybackup` archive and validates recovery into a separate profile. One format for Windows, macOS, and web; see [backup/recovery instructions and platform verification limits](BACKUP_FORMAT.md).
- Document Intelligence: Built-in PDF reader powered by PDF.js, coordinate-anchored annotations, text selection contextual AI actions, and automated "Turn into Steps" conversion.
- Operation Capture & Manual Generator: Capture screen states and operations, detect meaningful steps, annotate screenshots with click coordinates, and generate production-grade standard operating procedure (SOP) manuals exportable to PDF, Markdown, JSON, and HTML.
- AI Workspace: Local Ollama models (e.g., Llama 3.2, Gemma 2, Qwen 2.5) or Claude with your own Anthropic API key, chosen in Settings, with multi-entity context attachment and streaming responses.
- Local-First Architecture: 100% of data is stored client-side in IndexedDB (Dexie). No external cloud databases, no telemetry, and no tracking.

---

## Architecture

```
+-------------------------------------------------------------------+
|                            HUSKYNOTE                               |
+---------------------------------+---------------------------------+
|         Vercel Web App          |         Local Companion         |
|      (React 18 + Vite + TS)     |        (FastAPI / Python)       |
|                                 |                                 |
|  - IndexedDB (Dexie storage)    |  - Faster-Whisper ASR           |
|  - PDF.js canvas renderer       |  - Desktop Screen Capture       |
|  - Web Audio / MediaRecorder    |  - Ollama Lifecycle Proxy       |
|  - Direct Ollama REST client    |  - Local Document Processing    |
|  - jsPDF / Markdown exports     |                                 |
+---------------------------------+---------------------------------+
                 |                                  |
                 +-----------------+----------------+
                                   |
                     +-------------v-------------+
                     |       Ollama Service      |
                     |  http://localhost:11434   |
                     |   (Llama 3.2, Gemma, etc) |
                     +---------------------------+
```

---

## Key Features

### 1. Notes and Version History
- Full Markdown editing with real-time formatting toolbar.
- Automatic autosave to client-side IndexedDB.
- Persistent revision history allowing inspection and restoration of earlier versions.
- Tagging and folder organization.

### 2. Meeting Assistant and Live Audio
- Open **Meetings > Recordings & storage** to search saved audio by meeting title or date, see storage usage, play/download files, or permanently delete audio while keeping meeting notes and transcripts. The library is scoped to the current profile and includes unlinked audio from interrupted saves.
- On-device transcription applies a 70 Hz high-pass filter and bounded phrase normalization, in addition to anti-alias resampling. Processing affects recognition input only; saved audio is unchanged. Recognition accuracy still depends on the microphone, environment, language, and model.
- High-fidelity microphone capture using browser MediaRecorder and Web Audio API.
- Real-time live waveform visualizer and elapsed timer.
- Set up local speech-to-text in **Settings > Transcription**: choose English, Filipino / Taglish, or mixed languages, then set up the model and test your microphone. No account, Python, API key, or Ollama is required. Filipino/Taglish and unrestricted Auto use multilingual Whisper; Parakeet does not support Tagalog. Advanced settings include experimental Whisper Small and Turbo plus a reference-clip benchmark; improved accuracy/speed is not yet established.
- Recording chunks and pending speech jobs are saved locally during meetings. Use **Meetings > Recordings & storage** to resume pending transcription or delete audio, including its queued PCM. Notes and existing transcripts are retained. Interrupted recordings are downloadable, but damaged media containers may require external repair. Model files need an initial download, and new pinned revisions can require another download; cached models alone do not guarantee offline web startup.
- Post-meeting AI synthesis: automatic extraction of key decisions, structured action items, discussion topics, and timeline milestones.
- Simultaneous manual note-taking during ongoing meetings.

### 3. Document and PDF Intelligence
- Client-side PDF rendering using PDF.js with high-DPI scaling and thumbnail navigation.
- Floating text selection toolbar: Explain, Summarize, Simplify, Make Notes, Highlight, Ask AI.
- Coordinate-anchored annotation layer: persistent text highlights, bounding rectangles, arrows, numbered step badges, and notes.
- AI Document Analysis: identifies important terms, definitions, steps, and warnings with user-controlled accept/reject workflows.
- "Turn into Steps" mode: transforms document sections into structured numbered procedures citing source page numbers.

### 4. Computer Operation Capture and Manual Builder
- Inspired by automated documentation workflows: capture screen states during real operations.
- Step detection with timestamping, action descriptions, and click coordinate suggestions.
- Interactive Manual Builder: reorder steps, add warnings, prerequisites, expected outcomes, and troubleshooting notes.
- One-click export to PDF (formatted print layout), Markdown, JSON, and HTML.

### 5. AI Workspace
- Multi-context selector: attach specific notes, meeting transcripts, and PDF documents as context chips.
- Context-aware commands: Summarize, Extract Tasks, Generate SOP, Find Decisions, Analyze Risks.
- Streaming responses with source citations and one-click "Save as Note" integration.

### 6. Search and Templates
- Instant client-side full-text search across notes, meetings, documents, and manuals.
- Reusable built-in templates (Meeting Notes, Project Sync, Bug Investigation, SOP, Daily Log, Sprint Planning, Decision Record).
- Custom template creation and management.

---

## Single-Click Automated Ollama Setup

HuskyNote includes fully automated local AI setup scripts that require zero manual terminal configuration.

### Quick Start (Single Command)

#### macOS / Linux
```bash
git clone https://github.com/ChristianJayCuevas/HuskyNote.git
cd HuskyNote
./start.sh
```

#### Windows
You can run HuskyNote on Windows in multiple ways:

1. **Native Windows Desktop Installer (.EXE)**:
   - Download and run `HuskyNote-Setup-x64.exe`.
   - Automatically installs HuskyNote to your local programs directory, creates Desktop and Start Menu shortcuts with the official icon, configures the Windows uninstaller, and connects to your local Ollama instance.

2. **Automated Developer Setup Script (.BAT)**:
   ```cmd
   git clone https://github.com/ChristianJayCuevas/HuskyNote.git
   cd HuskyNote
   scripts\setup-windows.bat
   ```

3. **Cross-Platform npm start**:
   ```bash
   npm start
   ```

The automated launcher scripts automatically:
1. Detect your operating system (macOS / Linux / Windows).
2. Verify whether Ollama is installed and running with `OLLAMA_ORIGINS="*"`.
3. Check and install Node dependencies.
4. Launch the application with native hardware access.

---

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit and integration tests
npm run test

# Run production build
npm run build

# Build Windows native desktop application & standalone installer (.EXE)
npm run build:windows
```

---

## Vercel Deployment

HuskyNote is built to run as a 100% independent web application without requiring a persistent backend.

1. Push your repository to GitHub.
2. Import the project in Vercel (`vercel.json` is included for SPA route rewrites).
3. Set Framework Preset to `Vite`.
4. Deploy.

When deployed to Vercel:
- All note-taking, document reading, PDF annotations, meeting recordings, and manual generation work entirely in the browser.
- Local AI features will seamlessly connect to your local Ollama instance running at `http://localhost:11434` when accessed from your local browser.

---

## Optional Local Companion (Python FastAPI)

For advanced desktop screen capture and Whisper automatic speech recognition:

```bash
cd local-companion
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

---

## Optional Chrome Browser Extension

For capturing Google Meet audio and screen sessions:
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select the `/browser-extension` folder.
4. When joining a Google Meet call, click the HuskyNote extension icon to start capture.

---

## Privacy and Data Ownership

- Local-First: All notes, uploaded files, and transcripts reside solely inside your browser IndexedDB storage.
- Zero Cloud Telemetry: No user analytics, metrics, or third-party trackers are included.
- AI Requests: All prompts and contextual documents are transmitted directly to your local Ollama instance or your configured endpoint.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

HuskyNote is a rebranded fork of [DomoNote](https://github.com/darknecrocities/DomoNote) by darknecrocities, used under the MIT License. The original copyright notice is retained in [LICENSE](LICENSE). Rebranding progress for the codebase is tracked in [REBRANDING.md](REBRANDING.md).
