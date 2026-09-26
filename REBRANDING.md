# DomoNote to HuskyNote Rebranding Tracker

Status: Documentation rebranded. Source code, binaries, and assets not yet changed.

This file records every part of the codebase that still carries the DomoNote brand, so the code rebrand can be planned and done in one pass. At the time of writing, roughly 930 lines across 108 files (excluding docs and `package-lock.json`) reference "Domo", "DomoNote", or the upstream `darknecrocities` repository.

Find everything that remains with:

```bash
git grep -n -i -E 'domo|darknecro' -- ':!*.md' ':!LICENSE'
```

---

## 0. Licensing Constraints (Do Not Change)

- `LICENSE` must keep the original line `Copyright (c) 2026 darknecrocities / DomoNote Contributors`. The MIT License requires the notice to remain in all copies and substantial portions. Add new copyright lines; never remove the original.
- The DomoNote name, logo, and mascot artwork are the upstream project's brand identity. MIT grants rights to the code, not the brand, so all DomoNote-branded assets should be replaced rather than reused.

---

## 1. User Data Keys (Migration Required)

Renaming these without a migration makes existing users' data disappear. Either keep the old keys permanently, or ship a one-time migration that copies old data to new keys before switching.

| Location | Current value | Suggested value |
| :--- | :--- | :--- |
| `src/db/index.ts:15` | class `DomoNoteDatabase` | `HuskyNoteDatabase` (safe to rename) |
| `src/db/index.ts:28` | IndexedDB name `'DomoNoteDB'` | `'HuskyNoteDB'` with a migration from `DomoNoteDB` |
| `src/context/ai-context.tsx:27` | `domonote_user_selected_model` | `huskynote_user_selected_model` |
| `src/context/language-context.tsx:55,65` | `domonote_language` | `huskynote_language` |
| `src/context/theme-context.tsx:22,47` | `domonote_theme` | `huskynote_theme` |
| `src/services/audio/sound-fx.ts:12,16,45,64` | `domonote_sound_muted`, `domonote_sound_volume` | `huskynote_sound_*` |
| `src/services/calendar/google-calendar.ts:3` | `domonote_google_calendar_config` | `huskynote_google_calendar_config` |

Recommended approach: add a small `migrateLegacyStorage()` helper that runs once at startup, copies each `domonote_*` localStorage key to its `huskynote_*` equivalent if the new key is absent, and opens `DomoNoteDB` to copy tables into `HuskyNoteDB`.

---

## 2. Desktop and Installer Identity (Upgrade Path Required)

Changing these affects how existing installs are detected, upgraded, and uninstalled.

| Location | Item |
| :--- | :--- |
| `desktop/windows/Program.cs:14` | Mutex `Global\DomoNote_Desktop_SingleInstance` |
| `desktop/installer/InstallerEngine.cs:139` and registry writes | Uninstall key `HKCU\...\Uninstall\DomoNote` |
| `desktop/installer/InstallerEngine.cs:156-161` | `Publisher`, `URLInfoAbout`, `HelpLink` (point to darknecrocities) |
| `desktop/installer/InstallerEngine.cs` | Install dir `%LOCALAPPDATA%\Programs\DomoNote`, shortcut names |
| `desktop/windows/DomoNote.csproj` | Rename file to `HuskyNote.csproj`; update `AssemblyName`, `<Authors>` |
| `desktop/installer/DomoNoteSetup.csproj` | Rename file to `HuskyNoteSetup.csproj`; update `<Authors>` |
| `desktop/windows/MainWindow.cs` | Window title, tray text, menu labels |
| `desktop/main.swift` | Window title, menu labels, comments, binary name `DomoNote.app` |
| `desktop/Open DomoNote.command` | Rename file to `Open HuskyNote.command` and update contents |

The installer should detect and remove (or migrate) an existing DomoNote install so users do not end up with both.

---

## 3. Distributed Binaries and Download Files

These files are prebuilt with the DomoNote name and must be rebuilt, not just renamed.

- `public/downloads/DomoNote-macOS-Universal.dmg`
- `public/downloads/DomoNote-macOS-arm64.dmg`
- `public/downloads/DomoNote-macOS-x64.dmg`
- `public/downloads/DomoNote-Setup.bat` (also clones the upstream repo URL)
- `public/downloads/SHA256SUMS.txt` (regenerate after rebuilding)
- Generated at build time: `DomoNote-Setup-x64.exe`, `DomoNote-Windows-Portable.zip`, `DomoNote-Chrome-Extension.zip`, `Setup-DomoNote-Extension.command`

---

## 4. CI/CD Workflows

- `.github/workflows/ci.yml`: artifact names, expected file paths, install directory check, `domonote-windows-binaries` artifact name.
- `.github/workflows/release.yml`: release title, asset file names, checksum inputs.

Update these together with section 3, or CI fails because it looks for files that no longer exist.

---

## 5. Hardcoded Repository URLs

All of these point at `https://github.com/darknecrocities/DomoNote` and should point at `https://github.com/ChristianJayCuevas/HuskyNote`:

- `src/services/github/stars.ts:3` (`REPO_OWNER`, plus the repo name)
- `src/views/download-view.tsx` (about 15 occurrences, including releases links and embedded setup scripts)
- `src/views/landing-page.tsx:319,452`
- `src/views/about-view.tsx:27`
- `src/components/layout/sidebar.tsx:270`
- `src/components/modals/cloud-environment-modal.tsx:31,124`
- `scripts/setup-windows.bat:39`, `scripts/setup-linux.sh:20`, `public/downloads/DomoNote-Setup.bat:39`

Consider centralizing these into a single constant (for example `src/config/brand.ts`) so a future rename is a single edit.

---

## 6. Web App Metadata and Configuration

- `package.json` / `package-lock.json`: `"name": "domonote"` becomes `"huskynote"`. Also add `"license": "MIT"`.
- `index.html`: `<title>`, meta description, favicon and apple-touch-icon (`/official_domonote.png`).
- `.env.example`: header comment and `VITE_APP_NAME=DomoNote`.
- `vite.config.ts`: plugin name `domonote-chrome-extension-installer`, extension folder names, download file names, and toast messages.
- `vercel.json`: verify there are no brand-specific rewrites after the download file renames.

---

## 7. Browser Extension

- `browser-extension/manifest.json`: `name` and `default_title`.
- `browser-extension/content.js` (about 200 references), `background.js`, `popup.html`, `popup.js`: DOM IDs, class names, message types, and UI strings.
- `browser-extension/setup-extension.command`, `scripts/setup-chrome-extension.sh`.

Changing message type strings requires updating the web app side that listens for them at the same time.

---

## 8. UI Copy and Translations

- `src/locales/en.json`, `fr.json`, `ja.json`, `zh.json`: app name, "About DomoNote", "Open DomoNote", "WHY DOMONOTE", copyright line, and the "Domo Notes" (focus mode) product name.
- Hardcoded strings in components, notably `src/views/landing-page.tsx`, `src/views/download-view.tsx`, `src/views/about-view.tsx`, `src/views/settings-view.tsx`, `src/views/changelog-view.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`, `src/components/layout/mode-switcher.tsx`, `src/components/ui/command-palette.tsx`, and `src/components/meetings/meeting-recorder.tsx`.
- AI system prompts that name the assistant (search `src/services/ai/` and `src/context/ai-context.tsx`).

Decide on a replacement for the "Domo Notes" focus mode name (for example "Husky Notes" or a neutral "Focus Notes").

---

## 9. Mascot and Visual Assets

The DomoNote mascot "Domo" is a panda. HuskyNote needs new mascot artwork (for example a husky) to replace:

- `src/components/ui/panda-mascot.tsx`, `src/components/ui/global-mascot-dock.tsx` ("Domo Panda Companion")
- `src/assets/domodomo.png`, `domodomo_wink.png`, `domolaptop.*`, `domoreading.*`, `domotest.*`, `welcome_domo.*`, `domonote-demo.webp`, `official_domonote.png`
- `public/official_domonote.png`, `public/domoreading.gif`, `public/domonote-demo.webp`
- `AppIcon.icns` (macOS app icon) and the Windows tray/app icon
- Other mascot references: `src/views/zen-focus-view.tsx`, `src/views/landing-page.tsx`, `src/views/about-view.tsx`, `src/components/meetings/floating-meeting-controller.tsx`, `src/components/documents/document-notes-modal.tsx`

---

## 10. Local Environment

- The local working directory is still named `DomoNote`. Renaming it is optional and does not affect the repository.
- The previous `origin` remote is kept as `upstream` (`https://github.com/darknecrocities/DomoNote.git`) for pulling future upstream fixes.

---

## Suggested Order

1. Sections 5, 6, and 8: repository URLs, metadata, and UI copy (low risk).
2. Section 1: storage keys with a migration, plus tests.
3. Section 9: mascot and icon assets.
4. Sections 2, 3, 4, and 7 together: desktop, installer, extension, binaries, and CI, followed by a tagged release.
