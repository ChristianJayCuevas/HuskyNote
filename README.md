# HuskyNote — Your Local AI Secretary

> Capture it. Understand it. Keep it.

HuskyNote is a local-first AI secretary for meetings, notes, documents, and step-by-step guides. It records and transcribes meetings on your own computer, writes meeting reports with the AI you choose, and keeps everything in a workspace stored on your device.

- **Your data stays local.** Notes, meetings, audio, and documents are stored on this device. There are no accounts, no cloud sync, and no tracking.
- **Transcription runs on your computer.** Speech is never sent anywhere to be transcribed.
- **Choose your AI:**
  - Ollama runs on this computer.
  - Claude uses your own Anthropic API key.
  - ChatGPT (Codex) uses your ChatGPT plan through the Codex app.

Repository: https://github.com/ChristianJayCuevas/HuskyNote · [Latest release](https://github.com/ChristianJayCuevas/HuskyNote/releases/latest) · [Roadmap](ROADMAP.md)

---

## Download

Get the latest version from [Releases](https://github.com/ChristianJayCuevas/HuskyNote/releases/latest).

| Platform | File |
| --- | --- |
| Windows installer | `HuskyNote-Setup-x64.exe` |
| Windows portable | `HuskyNote-Windows-Portable.zip` |
| macOS (Apple Silicon and Intel) | `HuskyNote-macOS-Universal.dmg` |
| macOS (Apple Silicon only / Intel only) | `HuskyNote-macOS-arm64.dmg` / `HuskyNote-macOS-x64.dmg` |
| Linux | `HuskyNote-Linux-x86_64.AppImage` or `HuskyNote-Linux-x64.tar.gz` |

- **macOS:** the app is not notarized, so macOS warns on first launch. Run `Open HuskyNote.command` from the disk image once to clear the warning.
- **Linux:** the AppImage needs FUSE 2 (`libfuse2`); without it, use the tarball.
- **Checksums:** verify downloads with `SHA256SUMS.txt`.

Each app and each browser keeps its own workspace. To move your work between them, use a backup (see [Profiles and backups](#profiles-and-backups)).

---

## Features

### Meetings
- **Record** your microphone, a browser tab's audio, or both. The microphone is chosen next to the record button.
- **Transcribe on this device.** Choose an engine in **Settings → Transcription**:
  - **Parakeet** (default): fastest, 25 European languages, uses the GPU when available.
  - **Moonshine:** lightweight, English only.
  - **Whisper:** multilingual, and used for Filipino / Taglish.
  - **Whisper Small and Turbo:** experimental. A local benchmark lets you compare engines.
- **Recordings are saved every second.** If a recording is interrupted, **Finish saving** rebuilds it from the saved audio. Search, play, download, or delete saved audio in **Meetings → Recordings & storage**.
- **Meeting reports** include:
  - a summary, key decisions, and action items you can tick off;
  - topics discussed, follow-ups, and a timeline.

  If no AI was connected when a meeting ended, use **Generate report** later. You can rename a finished meeting and polish its topics with AI.
- **Import** a meeting from:
  - a Microsoft Teams transcript (`.vtt` or `.docx`);
  - transcript text copied out of Teams;
  - an audio or video recording, which is transcribed on this device.
- **Supplement** a transcript with the Teams transcript of the same meeting:
  - HuskyNote lines up the two by time, takes speaker names from Teams, and adds lines it missed.
  - It can have the AI correct the wording.
  - **Restore original** undoes it.
- **Merge** recordings that belong to one meeting, for example after a pause or a crash. The gaps are marked, and **Unmerge** splits them again.
- **Export:**
  - a designed PDF report;
  - a Markdown file with the meeting details, the full report, your notes, and the complete timestamped transcript, ready to hand to another AI;
  - Copy, or Save as note.

### Notes
- Markdown editor with autosave. A visible save state shows unsaved, saving, saved, or failed, with Retry.
- Version history with restore, tags, templates, and Undo after deleting a note.

### Documents
- PDF reader (PDF.js) with thumbnails, highlights, shapes, numbered step badges, and notes anchored to the page.
- Select text to Explain, Summarize, Simplify, Make Notes, or Ask AI.
- **Turn into Steps** converts a section into a numbered procedure that cites its pages.

### Step guides
- Capture screens during a task, then build a step-by-step guide.
- Reorder steps and add warnings, prerequisites, expected results, and troubleshooting.
- Export to PDF, Markdown, JSON, or HTML.

### AI Workspace and Home
- **AI Workspace:** attach notes, meetings, and documents as context, then chat or run commands such as Summarize, Extract Tasks, Find Decisions, or Generate SOP. Save answers as notes.
- **Home:**
  - open action items, time spent in meetings, and what's coming up;
  - meetings still without a report, open questions, and recent work.
- **Search:** full-text search across everything. Commands open from their own button or shortcut.

### Profiles and backups
- **Profiles** keep separate workspaces for different jobs or projects. Each has its own notes, meetings, documents, guides, and schedule.
- **Backups:** **Settings → Storage** prepares a complete `.huskybackup` file of the current profile, including audio, and restores it into a new profile.
  - It also shows how much storage is used and whether the browser keeps it permanently.
  - See [the backup format and recovery notes](BACKUP_FORMAT.md).

---

## AI providers

Choose the AI in **Settings → AI**. Transcription always runs on this device, whichever AI you choose.

| Provider | What you need | Where your text goes |
| --- | --- | --- |
| **Local AI (Ollama)** | [Ollama](https://ollama.com) running on this computer with a model such as Llama 3.2, Gemma, or Qwen | Stays on this computer (`http://localhost:11434`) |
| **Claude** | An Anthropic API key from [platform.claude.com](https://platform.claude.com/settings/keys). Models: Claude Opus 5, Sonnet 5, or Haiku 4.5. Usage is billed to your API account | Anthropic |
| **ChatGPT (Codex)** | A ChatGPT plan and the [Codex app or CLI](https://developers.openai.com/codex) installed and signed in. Works in the Windows app and with `npm run dev` | OpenAI, through Codex on this computer |

### Using your ChatGPT plan with Codex
1. Install Codex: the Codex app, or `npm install -g @openai/codex`.
2. In HuskyNote, open **Settings → AI** and choose **ChatGPT (Codex)**.
3. Click **Sign in with ChatGPT**. Codex opens the ChatGPT sign-in in your browser. If you are already signed in to Codex, HuskyNote shows **Signed in with ChatGPT**.
4. Pick a model. Requests count toward your plan's Codex usage limits.

How it works:
- **HuskyNote never handles your sign-in.** It never sees your ChatGPT password or tokens. Its local server runs `codex exec` with your request, and Codex handles sign-in and billing.
- **Codex's tools are turned off:** no shell, no code, no web, no files. It can only read what HuskyNote sends and write text back.
- **The endpoint is locked to HuskyNote.** Only HuskyNote's own page can call it.
- **Platforms:** the macOS and Linux apps do not include this yet.

---

## Browser extension

The extension in [`browser-extension/`](browser-extension) works in Chrome and Edge:
- It collects Teams meeting transcripts.
- It captures Google Meet audio.
- It adds right-click actions to save or summarize selected text.

**Install:**
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `browser-extension` folder.

**Collect a Teams transcript**, even when downloading is turned off:
1. In Teams on the web, open the meeting's **Recap → Transcript**.
2. Click the HuskyNote extension, then **Collect transcript from this tab**. You can also right-click and choose **Collect Teams transcript for HuskyNote**.

   The extension scrolls through the transcript panel and reads only the text Teams shows you.
3. In HuskyNote, open the meeting and choose **Supplement**, or choose **Import a meeting** in Meetings. Select **Paste from Teams**, then **Use it**.

---

## Run from source

Requires Node.js 20 or 22.

```bash
git clone https://github.com/ChristianJayCuevas/HuskyNote.git
cd HuskyNote
npm install
npm run dev        # http://127.0.0.1:5173
```

Quick start scripts check for Ollama, install dependencies, and launch the app:

| System | Command |
| --- | --- |
| macOS / Linux | `./start.sh` |
| Windows | `scripts\setup-windows.bat` |
| Any | `npm start` |
| Ollama only | `npm run setup:ollama` |

Development commands:

```bash
npm test                 # unit and integration tests (Vitest)
npm run build            # type-check and production build
npm run build:windows    # Windows desktop app and installer (.NET 9 SDK)
npm run test:ui-browser  # browser regression checks against a local preview
```

### Releases
1. Bump the version in `package.json`.
2. Add an entry to [`src/data/changelog.json`](src/data/changelog.json). It is both the in-app changelog and the release notes.
3. Push a tag such as `v0.6.0`.

GitHub Actions builds Windows, macOS, and Linux and publishes the release with checksums. Every pull request also runs the tests and all three desktop builds.

---

## Architecture

```
+-------------------------------------------------------------------------+
|  Desktop shell: Windows (WebView2) | macOS (WKWebView) | Linux / browser |
+-------------------------------------------------------------------------+
|  HuskyNote web app: React 18 + Vite + TypeScript, shadcn/ui components  |
|                                                                         |
|  - IndexedDB (Dexie): notes, meetings, audio, documents, per profile    |
|  - On-device speech: Parakeet, Moonshine, Whisper (WebGPU or WASM)      |
|  - PDF.js reader, jsPDF and Markdown exports                            |
+------------------+----------------------+-------------------------------+
|  Ollama          |  Claude              |  ChatGPT (Codex)              |
|  localhost:11434 |  Anthropic API,      |  /api/codex on the local      |
|  (local models)  |  your API key        |  server -> Codex CLI -> OpenAI|
+------------------+----------------------+-------------------------------+
   Local server: Vite dev server, the Windows app's built-in server,
   or serve.py in the macOS and Linux apps
```

The site can also be deployed as static files (for example, to Vercel with the included `vercel.json`). A hosted copy shows the landing page and downloads. The workspace itself runs in the desktop apps or from a local server, where the data stays on the device.

An optional Python companion in [`local-companion/`](local-companion) adds desktop screen capture and Faster-Whisper:

```bash
cd local-companion
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765 --reload
```

---

## Privacy and data ownership

- **Local storage:** notes, meetings, recordings, transcripts, and documents are stored in the app's local database (IndexedDB) on this device.
- **No accounts, cloud sync, analytics, or trackers.** The update check is off by default. When turned on, it only asks GitHub whether a newer release exists.
- **On-device transcription:** audio is always transcribed on this device.
- **AI requests:**
  - **Ollama:** text stays on this computer.
  - **Claude:** text is sent to Anthropic. Your key stays on this device and is left out of backups.
  - **ChatGPT (Codex):** text is sent to OpenAI. Sign-in stays inside Codex.

---

## Project documents

- [Roadmap](ROADMAP.md): priorities, milestones, and acceptance criteria
- [Backup format](BACKUP_FORMAT.md): archive layout, what is included, and recovery
- [Transcription plan](TRANSCRIPTION_PLAN.md): engines, language routing, and validation status
- [Contributing](CONTRIBUTING.md)
- [Rebranding notes](REBRANDING.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

HuskyNote is a rebranded fork of [DomoNote](https://github.com/darknecrocities/DomoNote) by darknecrocities, used under the MIT License. The original copyright notice is retained in [LICENSE](LICENSE). Rebranding progress for the codebase is tracked in [REBRANDING.md](REBRANDING.md).
