# HUSKYNOTE: SOURCE OF TRUTH (SOT)

Document Version: 1.2.0  
Product: HuskyNote (formerly DomoNote)  
Repository: https://github.com/ChristianJayCuevas/HuskyNote  
Upstream: https://github.com/darknecrocities/DomoNote (MIT)  
Status: Canonical Architecture, Technical Specification, and Operating Manual  

> Brand transition: documentation, source code, and artwork reflect the HuskyNote brand, and data saved by DomoNote builds is migrated on first run; see [REBRANDING.md](REBRANDING.md).

---

## 1. Product Statement

HuskyNote is an open-source, local-first AI secretary and note-taking workspace.
- **Tagline**: "Capture it. Understand it. Keep it."
- **Secondary Description**: "HuskyNote — Your Local AI Secretary for meetings, documents, and notes."

HuskyNote integrates five primary knowledge and capture modalities into a unified workspace:
1. **Markdown & Structured Notes**: Full Markdown editing with version history and folder organization.
2. **Meeting Recording, Speaker Detection & Live Timelines**: High-fidelity microphone and tab audio recording, speaker tracking, live speech-to-text, multilingual AI translation, and automatic synthesis of action items and decisions.
3. **Document / PDF Intelligence**: PDF.js canvas engine with coordinate-anchored annotations, text selection AI actions, and automated "Turn into Steps" conversion.
4. **Computer Operation Capture & SOP Manual Generator**: Screen procedure recording, click coordinate annotation, and one-click export to PDF, Markdown, JSON, and HTML.
5. **Native Desktop Shells & Browser Extensions**: Dedicated native desktop applications for macOS and Windows with system tray HUDs, and a Google Meet capture extension.

---

## 2. Core Architectural Principles

1. **Local-First Storage**: All user notes, meetings, audio recordings, uploaded PDFs, annotations, and generated manuals are persisted client-side in IndexedDB via Dexie. No remote database or mandatory server is required for full functionality.
2. **Vercel & Static Host Compatibility**: The web application is built strictly as a client-side React Single Page Application (SPA) using Vite. It builds without Node.js backend runtime requirements and is deployable to static hosts such as Vercel.
3. **Decoupled Local AI**: Local intelligence communicates with Ollama at `http://localhost:11434`. If Ollama is offline or unavailable, the application provides clear visual status and diagnostic instructions rather than failing or substituting synthetic responses.
4. **Privacy and Zero Telemetry**: No user data, uploaded documents, or transcripts are transmitted to third-party cloud services. Operating system and browser permissions are requested explicitly.
5. **Real Data Integrity**: The application does not generate or display synthetic filler cards, fake statistics, or mock AI completions. Empty states are explicitly communicated.
6. **Grayscale Visual Discipline**: The visual system is strictly black, white, and grayscale. Saturated accent colors are restricted to semantic states (recording active, connection status, alerts). Emojis are prohibited across UI icons and documentation.
7. **Safe Binary Delivery**: Download links for native installers (`.exe`, `.dmg`, `.zip`, `.AppImage`) must deliver genuine PE/Mach-O binaries. SPA web servers must never rewrite binary download paths to `index.html`. Automated fallbacks forward directly to official GitHub Releases.

---

## 3. Technology Stack

### 3.1 Web Application
- **Frontend Framework**: React 18, TypeScript 5 (Strict Mode)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 (configured with custom grayscale tokens)
- **Iconography**: Lucide React (no emojis permitted)
- **Local Database**: IndexedDB via Dexie 4
- **Document Engine**: PDF.js (`pdfjs-dist`)
- **Markdown Engine**: React Markdown, Remark GFM, DOMPurify for HTML sanitization
- **Export Engines**: jsPDF (for client-side PDF rendering), native Markdown/JSON serializers
- **Local AI Service**: Ollama REST API (streaming generate, chat, and tag endpoints)
- **Speech-to-Text**: On-device engines in web workers, selectable in Settings (`src/services/audio/transcription-engines.ts`): Parakeet TDT v3 via parakeet.js (default; 25 European languages), Moonshine Base and Whisper Base via transformers.js. WebGPU when available, WebAssembly otherwise. Languages the chosen engine lacks use Whisper Base automatically. The Web Speech API is a last-resort fallback.
- **Optional Cloud AI**: Claude through the Anthropic API with the user's own key (`src/services/ai/claude.ts`), selectable instead of Ollama in Settings. Only the text of a request is sent; audio and stored data stay local.

### 3.2 Native Desktop Applications
- **macOS Desktop App (`desktop/main.swift`)**:
  - Native Cocoa & WebKit (`WKWebView`) shell
  - Menu Bar HUD item with live Ollama health polling (`http://127.0.0.1:11434/api/tags`)
  - Global shortcuts: Open HuskyNote, New Note, Focus Mode, Record Meeting, Schedule, Studio, Settings
  - Bundled local static server (port 5892)
- **Windows Desktop App (`desktop/windows/`)**:
  - Native C# .NET 9 WinForms shell with Microsoft Edge WebView2 control
  - Centered dark-themed window (`DwmSetWindowAttribute(DWMWA_USE_IMMERSIVE_DARK_MODE)`)
  - Windows System Tray (`NotifyIcon`) with mascot icon and context menu
  - Embedded lightweight static server on `127.0.0.1:5892` with SPA fallback
  - Single-instance mutex guard (`Global\HuskyNote_Desktop_SingleInstance`)
  - Auto-start & live Ollama health monitoring
- **Windows Standalone Installer (`desktop/installer/`)**:
  - Self-contained executable: `HuskyNote-Setup-x64.exe`
  - Installs to `%LOCALAPPDATA%\Programs\HuskyNote` (no UAC / admin required)
  - Creates Desktop and Start Menu shortcuts with official icon
  - Registers in Windows Registry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\HuskyNote`
  - Standalone uninstaller script (`uninstall.bat`)
  - Supports silent installation (`/S`, `/silent`, `--quiet`)

### 3.3 Optional Companion & Extensions
- **Local Companion (`local-companion/`)**: Python FastAPI (Faster-Whisper ASR, desktop screen capture)
- **Browser Extension (`browser-extension/`)**: Chrome Manifest V3 (Google Meet audio and screen capture integration)

---

## 4. Entity Data Models

All entities are defined with strict TypeScript typing and indexed in IndexedDB:

### 4.1 Note
- `id`: string (UUID)
- `title`: string
- `content`: string (Markdown)
- `folderId?`: string
- `tags`: string[]
- `createdAt`: number (timestamp)
- `updatedAt`: number (timestamp)
- `versions`: NoteVersion[] (id, timestamp, content, title)

### 4.2 Meeting
- `id`: string (UUID)
- `title`: string
- `startTime`: number
- `endTime?`: number
- `durationSeconds`: number
- `audioBlobId?`: string (reference to Blobs table)
- `transcript`: TranscriptSegment[] (id, timestampSeconds, speaker, text)
- `manualNotes`: string
- `timeline`: TimelineItem[] (timestampSeconds, label, type)
- `summary?`: MeetingSummary (overview, decisions, actionItems, topics, followUpTasks)

### 4.3 Document
- `id`: string (UUID)
- `title`: string
- `fileName`: string
- `fileSize`: number
- `pageCount`: number
- `fileBlobId`: string (reference to Blobs table)
- `extractedPages`: ExtractedPage[] (pageNumber, text)
- `createdAt`: number

### 4.4 Annotation
- `id`: string (UUID)
- `documentId`: string
- `pageNumber`: number
- `type`: `'highlight' | 'underline' | 'rectangle' | 'arrow' | 'marker' | 'note'`
- `coords`: `{ x: number, y: number, width: number, height: number }`
- `color`: string
- `text?`: string
- `label?`: string
- `createdAt`: number

### 4.5 OperationSession & Manual
- `OperationSession`: recordedAt, steps (screenshotBlobId, actionDescription, clickCoords, annotations)
- `Manual`: title, purpose, requirements, steps, warnings, expectedResult, troubleshooting

### 4.6 Settings
- `ollamaBaseUrl`: string (default: `"http://localhost:11434"`)
- `selectedModel`: string (default: `"llama3.2"`)
- `autoSaveIntervalSeconds`: number
- `companionUrl`: string (default: `"http://localhost:8765"`)
- `speechRecognitionLanguage`: string (default: `"en-US"`)

---

## 5. Security & Privacy Boundaries

1. **XSS Prevention**: Raw markdown is rendered through React Markdown with dangerous HTML execution disabled and sanitized with DOMPurify.
2. **File Upload Verification**: PDF uploads are validated for valid PDF headers (`%PDF-`) and size-constrained client-side.
3. **Network Isolation**: Outbound network requests from the web application target localhost (Ollama port 11434, companion port 8765) or are completely client-side, except two connections the user turns on: the Claude API when Claude is the selected AI provider, and the once-a-day update check against GitHub Releases (off by default, sends no workspace data).
4. **Permissions Principle**: Microphone and Screen Sharing APIs are invoked only upon direct user action. Visual indicators remain conspicuous during active recording.

---

## 6. Multi-Platform Distribution & Download Protocol

To guarantee reliable binary distribution:
1. **GitHub Releases as Canonical Distribution**:
   - Official release binaries are compiled via CI/CD and hosted on GitHub Releases (`https://github.com/ChristianJayCuevas/HuskyNote/releases`).
2. **SPA Rewrite Protection**:
   - Static hosting configuration (`vercel.json`) must exclude `/downloads/` from SPA root rewrites.
3. **Smart Client-side Probe**:
   - When users click download, the web client performs a HEAD probe on the local route. If the route returns a route-rewritten HTML file rather than a genuine binary, it automatically redirects to the canonical GitHub Release URL.
4. **Desktop Installer Verification**:
   - Installers must be verified directly on physical hardware and runner environments (silent install, shortcut resolution, clean uninstallation).

---

## 7. CI/CD & Quality Assurance

- **Continuous Integration (`.github/workflows/ci.yml`)**:
  - Runs on all pushes and pull requests to `main`.
  - Matrix testing across Node.js 20 & 22 on Linux runners.
  - Full TypeScript compilation (`tsc -b`), Vitest test suite execution, and production build verification.
  - Native Windows desktop app and installer compilation on `windows-latest` with verification of artifact existence and silent install test.
- **Automated Releases (`.github/workflows/release.yml`)**:
  - Triggers on tag pushes (`v*`) or manual dispatch.
  - Compiles `HuskyNote-Setup-x64.exe`, `HuskyNote-Windows-Portable.zip`, and `HuskyNote-Setup.bat`.
  - Generates `SHA256SUMS.txt` cryptographic checksums.
  - Creates a GitHub Release with assets attached.
- **Git Commit Standards**:
  - Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`, `refactor(...)`, `test(...)`.
  - Strictly no emojis in commit messages, code comments, or documentation.
