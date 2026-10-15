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
6. **Visual System (near-grayscale, Notion-style)**: The interface is built from shadcn/ui (new-york) primitives on semantic design tokens, in Light, Dark, and System themes (System is the default). Neutrals are warm grays; primary actions are near-black in light mode and near-white in dark mode. Color has exactly three jobs: keyboard focus rings and text selection (blue `--ring`), semantic status (success, warning, info, destructive; an active recording is destructive), and data (chart-1 to chart-5). Emojis are prohibited across UI icons and documentation. The full specification is in section 8.
7. **Safe Binary Delivery**: Download links for native installers (`.exe`, `.dmg`, `.zip`, `.AppImage`) must deliver genuine PE/Mach-O binaries. SPA web servers must never rewrite binary download paths to `index.html`. Automated fallbacks forward directly to official GitHub Releases.

---

## 3. Technology Stack

### 3.1 Web Application
- **Frontend Framework**: React 18, TypeScript 5 (Strict Mode)
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 3 with semantic design tokens (HSL CSS variables for light and dark in `src/index.css`), shadcn/ui new-york primitives on Radix UI and class-variance-authority in `src/components/ui`, cmdk for the command palette, and bundled Geist fonts (no font requests at runtime). Token rules are enforced by `scripts/check-design-tokens.mjs`.
- **Iconography**: Lucide React (no emojis permitted)
- **Local Database**: IndexedDB via Dexie 4
- **Document Engine**: PDF.js (`pdfjs-dist`)
- **Markdown Engine**: React Markdown and Remark GFM through the `Markdown` primitive: HTML in the source is shown as text (never rendered), and URLs are restricted to http(s), mailto, and relative links, plus base64 `data:image/*` for images. DOMPurify sanitizes any other user-provided HTML.
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
  - Self-contained single-file executable: `HuskyNote-Setup-x64.exe`. The installer and the app both carry the .NET 9 runtime, so nothing else needs installing; the version comes from `package.json` (`desktop/Directory.Build.props`)
  - Installs to `%LOCALAPPDATA%\Programs\HuskyNote` (no UAC / admin required)
  - Closes a running HuskyNote before updating it (asks first in the windowed installer)
  - The app checks for the Microsoft Edge WebView2 Runtime at startup and offers Microsoft's Evergreen Bootstrapper when it is missing
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

---

## 8. Visual System

The app UI (everything except the landing page) follows one token and primitive system. `scripts/check-design-tokens.mjs` enforces the token rules.

1. **Design tokens** (`src/index.css`, shadcn/ui v3 format: HSL channels, light values in `:root`, dark values in `.dark`; mapped in `tailwind.config.js`):
   - Surfaces and text: `background`, `foreground`, `card`, `popover`, `muted` / `muted-foreground`, `accent`, `secondary`, `primary` / `primary-foreground`, `border`, `input`, `sidebar-*`.
   - Focus and selection: `ring` (Notion blue `#2383E2`), the only decorative use of blue.
   - Status: `success`, `warning`, `info`, `destructive`, used for text and icons and soft fills (`bg-success/10 text-success`); only `destructive` is a solid fill.
   - Data: `chart-1` to `chart-5` (charts and speaker identity dots only).
   - Documents: `paper` / `paper-foreground` keep PDF and document pages white in both themes.
   - Radius (`rounded-md` controls, `rounded-lg` cards and menus, `rounded-xl` dialogs) and shadows (`shadow-xs` to `shadow-xl`) also come from tokens.
   - The `slate` and `zinc` ramps are remapped to warm grays for legacy code; `canvas` is deprecated. New code uses the semantic names.
2. **Themes**: Light, Dark, and System (default). The preference is stored in `localStorage.huskynote_theme` (`light`, `dark`, or `system`); an inline script in `index.html` applies the class before first paint. `src/context/theme-context.tsx` exposes `preference`, `setPreference`, the resolved `theme`, and `toggleTheme(origin?)` (circular reveal only when an origin is passed).
3. **Typography**: Geist and Geist Mono are bundled through `@fontsource-variable/*` and loaded once from `src/brand/fonts.ts` (no font requests at runtime). Page titles `text-2xl font-semibold`, document titles `text-3xl sm:text-4xl font-bold`, UI text `text-sm`, meta text `text-xs text-muted-foreground`; nothing smaller than 12 px in the app UI. Long-form Markdown renders through the `Markdown` primitive (Tailwind Typography on the tokens).
4. **Primitives** (`src/components/ui`, each file lists its exports at the top): shadcn/ui **Tailwind v3 new-york** sources copied by hand (shadcn CLI 2.x era, `hsl(var(--x))`), on Radix UI and class-variance-authority. Never run `shadcn@latest`; it targets Tailwind v4 and oklch, which the macOS WebKit shell does not need and the tokens do not use. Every button, input, select, menu, popover, dialog, tab strip, segmented control, badge, alert, table, and empty state uses these primitives; menus and overlays are never hand-rolled.
5. **Layout patterns**: pages use `PageContainer` + `PageHeader` and scroll inside the single `<main>`; list/detail views (Notes, Meetings, Documents, Manuals) use `ResizableListPanel` + `ListPane` with a `Toolbar` heading the detail pane. Controls are `h-8` (`h-7` small), bars (topbar, list headers, toolbars) are `h-11`, sidebar items `h-7`. Only `AppLayout` renders `<main>` and only the sidebar renders `<aside>`.
6. **Design exceptions**: a literal color is allowed only where tokens cannot apply: the Picture-in-Picture window's inline HTML, annotation and screenshot overlay colors drawn on canvases, media on a black stage, white paper pages, and third-party logos. Each needs a `design-exception: <reason>` comment on the same line or the line above.
7. **Checker**: `node scripts/check-design-tokens.mjs [files or directories]` flags palette colors, `canvas`, `dark:` outside `src/components/ui`, hex/rgb/hsl literals, `bg-white`/`bg-black`/`text-white`/`text-black`, deprecated Button variants and sizes, `backdrop-blur`, `transition-all`, `duration-500`, press/hover scale effects, `rounded-2xl`/`rounded-3xl`, `shadow-2xl`, and `font-extrabold`/`font-black`. With no arguments it scans `src` except the landing page and `src/brand`, and exits 1 on any violation. The app is at 0 violations; keep it there.
8. **Brand and landing**: the HuskyNote mark, logo, mascot poses, and generated icons come from `src/brand` (import from `@/brand`; see REBRANDING.md). The landing page (`src/views/landing-page.tsx`, `src/components/landing`) is self-contained, styled by its own `landing.css` under `.hn-landing`, and is outside the checker's scope.
