# Contributing to HuskyNote

Welcome to the HuskyNote open-source project. We appreciate contributions from the community to help make local-first, privacy-respecting AI note-taking and workspace capture accessible to everyone.

Please review this document thoroughly before opening an issue or submitting a Pull Request.

---

## 1. Guiding Architectural Principles

All contributions must strictly respect HuskyNote's core design rules:

1. **Local-First Data Ownership**: All user notes, meetings, audio recordings, uploaded PDFs, annotations, and generated manuals are persisted client-side in IndexedDB via Dexie. No core feature may depend on a mandatory external cloud database or telemetry service.
2. **Grayscale Visual Discipline**: All user interfaces must adhere to the black and white design system. Accent colors are reserved strictly for semantic feedback (recording active, connection status, alerts). **Emojis are strictly prohibited across all UI icons, components, code comments, and documentation.**
3. **Decoupled Local AI**: Local intelligence connects directly to local Ollama instances (`http://localhost:11434`). If Ollama is offline or unavailable, the application provides clear visual status and diagnostic instructions rather than failing or substituting synthetic responses.
4. **Zero Synthetic / Mock Data**: Do not introduce mock data, fake statistics, or synthetic AI completions into production code paths.
5. **Safe Binary Delivery**: Download links for native installers (`.exe`, `.dmg`, `.zip`, `.AppImage`) must deliver genuine PE/Mach-O binaries. SPA web servers must never rewrite binary download paths to `index.html`. Automated fallbacks forward directly to official GitHub Releases.

---

## 2. Environment Setup

### 2.1 Prerequisites
- **Node.js**: Version 20.x or 22.x LTS (https://nodejs.org/)
- **Git**: Version 2.30+ (https://git-scm.com/)
- **Ollama** *(Optional for local AI)*: https://ollama.com/
- **.NET 9.0 SDK** *(Optional, for Windows Desktop App contributions)*: https://dotnet.microsoft.com/download

### 2.2 Quick Start

#### macOS / Linux
```bash
# Clone the repository
git clone https://github.com/ChristianJayCuevas/HuskyNote.git
cd HuskyNote

# Install dependencies and start the development server
npm install
npm run dev
```

#### Windows
```cmd
git clone https://github.com/ChristianJayCuevas/HuskyNote.git
cd HuskyNote

# Automated developer setup
scripts\setup-windows.bat
```

Or run standard npm commands:
```bash
npm install
npm run dev
```

---

## 3. Project Structure

```
HuskyNote/
├── .github/
│   ├── workflows/            # GitHub Actions CI & Release pipelines
│   └── ISSUE_TEMPLATE/       # Bug report and feature request templates
├── desktop/
│   ├── main.swift            # Native macOS Cocoa + WebKit shell
│   ├── windows/              # Native Windows C# WebView2 desktop application
│   │   ├── HuskyNote.csproj   # Project file targeting net9.0-windows
│   │   ├── MainWindow.cs     # Window, System Tray HUD, and event dispatch
│   │   └── StaticServer.cs   # Embedded lightweight local static server
│   └── installer/            # Standalone Windows installer (HuskyNote-Setup-x64.exe)
│       ├── HuskyNoteSetup.csproj
│       ├── InstallerEngine.cs
│       └── SetupForm.cs
├── local-companion/          # Python FastAPI companion (Faster-Whisper, Screen Capture)
├── browser-extension/        # Chrome Manifest V3 extension (Google Meet capture)
├── public/                   # Static public assets, brands, and downloads
├── scripts/
│   ├── setup-windows.bat     # Windows automated setup script
│   ├── setup-ollama.sh       # macOS/Linux automated Ollama launcher
│   ├── build-windows.ps1     # Automated Windows packaging pipeline
│   ├── build-windows.js      # Cross-platform Windows build runner
│   └── start.js              # Cross-platform npm start launcher
├── src/
│   ├── components/           # Reusable UI components & modals
│   ├── context/              # Workspace, theme, and application state
│   ├── db/                   # IndexedDB database schemas and Dexie configuration
│   ├── services/             # Audio, calendar, AI translation, and export engines
│   ├── types/                # Strict TypeScript interface declarations
│   └── views/                # Top-level workspace views (Notes, Meetings, Downloads, etc.)
└── tests/                    # Vitest unit and integration test suites
```

---

## 4. Development Workflow & Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server (`http://127.0.0.1:5173`) |
| `npm run test` | Runs the Vitest test suite |
| `npm run build` | Compiles TypeScript (`tsc -b`) and produces production Vite bundle |
| `npm run build:windows` | Publishes native Windows desktop app, bundle, and installer |
| `npm run setup:windows` | Runs automated Windows setup and Ollama configuration |
| `npm run setup:ollama` | Configures local Ollama instance on macOS/Linux with CORS |
| `npm start` | Cross-platform launcher (runs `start.sh` or `setup-windows.bat`) |

---

## 5. Coding Standards

- **TypeScript Strictness**: Strict mode is enabled. Do not use `any` unless strictly interfacing with untyped third-party libraries; provide explicit type annotations.
- **Grayscale UI Tokens**: Use the curated Tailwind grayscale classes (`bg-slate-900`, `dark:bg-white`, `border-zinc-800`, `text-slate-400`). Saturated colors are reserved exclusively for status badges (green for active Ollama, red for recording).
- **Sanitization**: All user-rendered HTML or Markdown must pass through `DOMPurify.sanitize(...)`.
- **Testing**: Add unit tests in `/tests` for all new services, parsing logic, and detectors.

---

## 6. Commit Message & Pull Request Protocol

### 6.1 Conventional Commits
Use imperative conventional commit messages **strictly without emojis**:

```
feat(windows): add native desktop app, standalone installer, and fix .exe download
fix(download): prevent SPA route rewrites on binary download paths
test(speaker): add audio detector unit test fixtures
docs(sot): update canonical architecture to version 1.1.0
```

### 6.2 Pull Request Checklist
Before opening a PR:
1. Ensure `npm run test` passes (all tests green).
2. Ensure `npm run build` succeeds without compiler warnings or type errors.
3. If modifying Windows desktop code, verify that `scripts/build-windows.ps1` completes successfully.
4. Fill out the Pull Request template completely.

Thank you for helping build HuskyNote!
