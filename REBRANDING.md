# DomoNote to HuskyNote Rebranding

Status: Documentation and source code rebranded. Artwork and prebuilt macOS binaries still pending.

HuskyNote is a rebranded fork of [DomoNote](https://github.com/darknecrocities/DomoNote) by darknecrocities, used under the MIT License.

---

## 0. Licensing Constraints (Do Not Change)

- `LICENSE` must keep the original line `Copyright (c) 2026 darknecrocities / DomoNote Contributors`. The MIT License requires the notice to remain in all copies and substantial portions. Add new copyright lines; never remove the original.
- The DomoNote name, logo, and mascot artwork are the upstream project's brand identity. MIT grants rights to the code, not the brand, so the remaining DomoNote artwork (section 2) should be replaced.
- The About view keeps an "Open Source Credits" card linking the upstream project.

---

## 1. Completed

| Area | Change |
| :--- | :--- |
| Docs | README, CONTRIBUTING, SECURITY, SOT, GitHub templates, component READMEs |
| Repository links | All `darknecrocities/DomoNote` URLs now point to `ChristianJayCuevas/HuskyNote` |
| Metadata | `package.json` name `huskynote` and `"license": "MIT"`, `index.html`, `.env.example`, `vite.config.ts` |
| UI copy | App name, locales (en, fr, ja, zh), "Domo Notes" focus mode renamed to "Husky Notes" |
| Storage keys | `domonote_*` localStorage keys, `DomoNoteDB`, BroadcastChannel and DOM event names renamed |
| Browser extension | Manifest name, message types (`HUSKY_*`, `HUSKYNOTE_*`), CSS classes (`husky-*`), storage keys (`husky_*`) |
| Windows desktop | Project files `HuskyNote.csproj` / `HuskyNoteSetup.csproj`, namespaces, mutex, install dir, registry key, shortcuts, publisher |
| macOS desktop | `main.swift` window title and menus, `Open HuskyNote.command` launcher |
| CI/CD | Workflow artifact names and release asset names |
| Asset files | Logo renamed to `official_huskynote.png`, demo to `huskynote-demo.webp`, mascot media to neutral `mascot-*` names |
| Downloads | `HuskyNote-Setup.bat`, `HuskyNote-macOS-*.dmg` (renamed, see section 2), `SHA256SUMS.txt` updated |

### Data migration for existing DomoNote users

Renaming storage keys would otherwise make existing data disappear, so each surface migrates on first run and leaves the legacy data in place:

- **Web app** (`src/services/legacy-migration.ts`, run from `src/main.tsx` before the app mounts): copies every `domonote_*` localStorage key to `huskynote_*` and copies all tables from the `DomoNoteDB` IndexedDB database into `HuskyNoteDB`. Runs once, guarded by `huskynote_legacy_migrated`.
- **Browser extension** (`browser-extension/background.js`): copies `domo_meetings` and `domo_live_meeting_roster` to their `husky_*` keys on install or update.
- **Windows desktop** (`desktop/windows/MainWindow.cs`): moves `%LOCALAPPDATA%\DomoNote\WebView2Data` to `%LOCALAPPDATA%\HuskyNote\WebView2Data` if the new folder does not exist, falling back to the legacy folder if the move fails.
- **Windows installer** (`desktop/installer/InstallerEngine.cs`): closes a running `DomoNote.exe` and removes the old DomoNote program folder, shortcuts, and uninstall entry. User data is not touched.

Limits: browser storage is per origin, so data only carries over when HuskyNote is served from the same origin as the old DomoNote install (the desktop apps' `127.0.0.1:5892`, or the same local dev URL). Users moving to a new web domain should use Settings to export the workspace from DomoNote and import it into HuskyNote. An old DomoNote extension will not talk to HuskyNote because message names changed; reload the extension from this repo.

---

## 2. Remaining

### Artwork (needs new design)

The files were renamed but still contain DomoNote artwork, including the panda mascot "Domo":

- Logo: `public/official_huskynote.png`, `src/assets/official_huskynote.png`
- App icons: `AppIcon.icns`, `desktop/windows/favicon.ico`, `desktop/installer/favicon.ico`
- Mascot media: `src/assets/mascot*.{png,gif,webp,webm,mov}`, `src/assets/welcome-mascot.*`, `public/mascot-reading.gif`, `src/assets/huskynote-demo.webp`, `public/huskynote-demo.webp`
- Mascot code: `src/components/ui/panda-mascot.tsx` (component and its image), the menu bar mascot drawn in `desktop/main.swift`, and the panda references in `src/views/changelog-view.tsx`

Dropping replacements in at the same paths needs no code changes. Renaming `PandaMascot` is only needed if the component name should match the new mascot.

### Binaries (need rebuilding)

- `public/downloads/HuskyNote-macOS-*.dmg` are the old DomoNote builds under new file names. Rebuild them on a Mac from `desktop/main.swift` and update their lines in `SHA256SUMS.txt`.
- `HuskyNote-Setup-x64.exe` and `HuskyNote-Windows-Portable.zip` are produced by `npm run build:windows` or the release workflow (requires the .NET 9 SDK). Their `SHA256SUMS.txt` lines are stale until the next release build regenerates them.

### Other

- The GitHub star counter (`src/services/github/stars.ts`) cannot read a private repository, so it shows no count until the repository is public.
- The local working directory is still named `DomoNote`. Renaming it is optional; the `upstream` remote still points to `https://github.com/darknecrocities/DomoNote.git` for pulling upstream fixes.

Find any remaining references with:

```bash
git grep -n -i -E 'domo|darknecro' -- ':!*.md' ':!LICENSE'
```

Expected matches are the migration code above and the About view credits.
