# Contributing to HuskyNote

Welcome to the HuskyNote open-source project. We appreciate contributions from the community to help make local-first, privacy-respecting AI note-taking and workspace capture accessible to everyone.

Please review this document thoroughly before opening an issue or submitting a Pull Request.

---

## 1. Guiding Architectural Principles

All contributions must strictly respect HuskyNote's core design rules:

1. **Local-First Data Ownership**: All user notes, meetings, audio recordings, uploaded PDFs, annotations, and generated manuals are persisted client-side in IndexedDB via Dexie. No core feature may depend on a mandatory external cloud database or telemetry service.
2. **Visual System (near-grayscale, Notion-style)**: Interfaces use the shared primitives and semantic design tokens, and must work in light and dark. Color is reserved for three jobs: focus rings and text selection, semantic status (success, warning, info, destructive), and data (charts). **Emojis are strictly prohibited across all UI icons, components, code comments, and documentation.**
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
├── public/                   # Static public assets, generated brand icons (brand/), and downloads
├── scripts/
│   ├── check-design-tokens.mjs  # Design-token checker for src (see Coding Standards)
│   ├── brand/                # Brand asset generator (favicons, app icons, social image)
│   ├── test-*-browser.mjs    # Playwright browser regression checks (run against a dev server)
│   ├── setup-windows.bat     # Windows automated setup script
│   ├── setup-ollama.sh       # macOS/Linux automated Ollama launcher
│   ├── build-windows.ps1     # Automated Windows packaging pipeline
│   ├── build-windows.js      # Cross-platform Windows build runner
│   └── start.js              # Cross-platform npm start launcher
├── src/
│   ├── brand/                # HuskyNote mark, logo, mascot, colors, and Geist fonts (import from '@/brand')
│   ├── components/
│   │   ├── ui/               # Shared primitives (shadcn/ui new-york on Radix) and app-wide widgets
│   │   ├── landing/          # Self-contained landing page (landing.css, outside the token checker)
│   │   └── ...               # Feature components (notes, meetings, documents, settings, ...)
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
| `node scripts/check-design-tokens.mjs [paths]` | Checks UI code against the design tokens (no paths: all of `src`, landing and brand excluded) |
| `npm run test:ui-browser` | Browser regressions for the shell, notes, search, and settings (set `TEST_BASE_URL` to your dev server) |
| `npm run test:backup-browser` / `npm run test:transcription-browser` | Browser checks for backups and audio capture |
| `npx vite-node scripts/brand/generate-brand-assets.ts` | Regenerates every icon and social image from `src/brand` |

---

## 5. Coding Standards

- **TypeScript Strictness**: Strict mode is enabled. Do not use `any` unless strictly interfacing with untyped third-party libraries; provide explicit type annotations.
- **Design Tokens**: Style with the semantic token classes defined in `src/index.css` and `tailwind.config.js`: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`, `bg-sidebar`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary text-primary-foreground`, status colors `text-success` / `text-warning` / `text-info` / `text-destructive` (soft fills such as `bg-success/10`), and `bg-chart-1` to `bg-chart-5` for data. Tokens switch with the theme, so do not use Tailwind palette colors (`slate`, `zinc`, `gray`, `blue`, `emerald`, ...), the deprecated `canvas` colors, `dark:` variants outside `src/components/ui`, hex/rgb/hsl literals, `bg-white`/`bg-black`/`text-white`/`text-black`, `backdrop-blur`, `transition-all`, `duration-500`, press/hover scale effects, `rounded-2xl`/`rounded-3xl`, `shadow-2xl`, or `font-extrabold`/`font-black`.
- **UI Primitives**: Build screens from `src/components/ui` (each file lists its exports at the top): `Button`, `Input`, `Textarea`, `NativeSelect`, `Field`, `Switch`, `Checkbox`, `Dialog`/`Modal`, `AlertDialog`/`ConfirmDialog`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip`, `Tabs`, `ToggleGroup`, `Badge`, `Alert`, `Table`, `EmptyState`, `PageContainer`/`PageHeader`/`PageSection`, `ListPane`, `Toolbar`, `Markdown`, and toasts through `addToast`. Do not hand-roll menus, overlays, or click-outside handlers. To add a primitive, copy the shadcn/ui **Tailwind v3 new-york** source (shadcn CLI 2.x era, `hsl(var(--x))` colors) by hand and adapt it; never run `shadcn@latest`, which targets Tailwind v4 and oklch.
- **Layout Patterns**: Pages use `PageContainer` + `PageHeader` and scroll inside the shell's `<main>` (do not add another full-height scrolling root). List/detail views use `ResizableListPanel` + `ListPane` with a `Toolbar` above the detail. Controls are `h-8` (`h-7` small) and bars are `h-11`; use the type scale in SOT.md section 8 (nothing below `text-xs`, no uppercase tracking labels).
- **Fonts and Brand**: Geist and Geist Mono are bundled and loaded once from `src/main.tsx`; do not add font imports or font CDN links. Use the brand components from `@/brand` (`HuskyMark`, `HuskyLogo`, `HuskyHead`, ...) and do not edit `src/brand` for page work.
- **Design Exceptions**: When a literal color is genuinely required (Picture-in-Picture inline HTML, annotation and screenshot overlay colors drawn on canvases, media on a black stage, white paper pages, third-party logos), add a `design-exception: <reason>` comment on the same line or the line above.
- **Token Check**: Run `node scripts/check-design-tokens.mjs <changed files>` (or with no arguments for all of `src`, landing and brand excluded). It exits 1 when it finds a violation.
- **Sanitization**: Render Markdown with the `Markdown` primitive (`src/components/ui/markdown.tsx`): it never renders raw HTML (HTML in the source shows as text) and restricts URLs to http(s), mailto, and relative links (base64 `data:image/*` is allowed for images only). Do not add `rehype-raw`. Any other user-rendered HTML must pass through `DOMPurify.sanitize(...)`.
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
3. Ensure `node scripts/check-design-tokens.mjs <changed UI files>` reports 0 violations, and check your screens in light and dark.
4. If modifying Windows desktop code, verify that `scripts/build-windows.ps1` completes successfully.
5. Fill out the Pull Request template completely.

Thank you for helping build HuskyNote!
