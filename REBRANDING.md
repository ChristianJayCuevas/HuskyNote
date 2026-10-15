# DomoNote to HuskyNote Rebranding

Status: Documentation, source code, brand system, generated artwork, and macOS disk images rebranded. Windows binaries are rebuilt by the next release.

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
| Asset files | Logo renamed to `official_huskynote.png`; all icons and images are now generated from `src/brand/` (section 2) |
| Downloads | `HuskyNote-Setup.bat`, `HuskyNote-macOS-*.dmg` (renamed, see section 2), `SHA256SUMS.txt` updated |

### Data migration for existing DomoNote users

Renaming storage keys would otherwise make existing data disappear, so each surface migrates on first run and leaves the legacy data in place:

- **Web app** (`src/services/legacy-migration.ts`, run from `src/main.tsx` before the app mounts): copies every `domonote_*` localStorage key to `huskynote_*` and copies all tables from the `DomoNoteDB` IndexedDB database into `HuskyNoteDB`. Runs once, guarded by `huskynote_legacy_migrated`.
- **Browser extension** (`browser-extension/background.js`): copies `domo_meetings` and `domo_live_meeting_roster` to their `husky_*` keys on install or update.
- **Windows desktop** (`desktop/windows/MainWindow.cs`): moves `%LOCALAPPDATA%\DomoNote\WebView2Data` to `%LOCALAPPDATA%\HuskyNote\WebView2Data` if the new folder does not exist, falling back to the legacy folder if the move fails.
- **Windows installer** (`desktop/installer/InstallerEngine.cs`): closes a running `DomoNote.exe` and removes the old DomoNote program folder, shortcuts, and uninstall entry. User data is not touched.

Limits: browser storage is per origin, so data only carries over when HuskyNote is served from the same origin as the old DomoNote install (the desktop apps' `127.0.0.1:5892`, or the same local dev URL). Users moving to a new web domain should use Settings to export the workspace from DomoNote and import it into HuskyNote. An old DomoNote extension will not talk to HuskyNote because message names changed; reload the extension from this repo.

---

## 2. Brand System and Artwork

The HuskyNote identity is code, not hand-exported images. Everything lives in `src/brand/` (never edit it from page code; import from `@/brand`):

| File | What it holds |
| :--- | :--- |
| `colors.ts` | `BRAND` (name, tagline, descriptor, description, platforms, license), `HUSKY_TONES` (`ink` for light backgrounds, `snow` for dark, `neutral` for rasters that sit on both), and `BRAND_COLORS` (the landing page's Snowline / Polar night surfaces and the app-icon tile gradient) |
| `husky-mark.tsx` | `HuskyMark` — the note-page husky symbol: `size`, `tone` (`auto` follows the theme), `detail`, `title` |
| `husky-logo.tsx` | `HuskyLogo` (mark + wordmark, sizes `sm` / `md` / `lg` / `xl`) and `HuskyWordmark` |
| `husky-art.tsx` | Mascot poses `HuskyHead`, `HuskyPeek`, `HuskyFetch` (`tone`, `size`, `animated`) |
| `husky-tile.tsx` | `HuskyTile` — the rounded app-icon tile used for favicons and app icons |
| `og-card.tsx` | The 1200 x 630 social card |
| `brand.css`, `tone.ts` | The `--hn-*` color variables behind `tone="auto"` (switches under `html.dark`) |
| `fonts.ts`, `fonts.css` | Bundled Geist and Geist Mono (`@fontsource-variable/*`, no network requests) exposed as `--font-brand-sans` / `--font-brand-mono`; imported once from `src/main.tsx` |

Usage in the app: the sidebar and Download page show `HuskyLogo` (collapsed sidebar: `HuskyMark`), About shows `HuskyMark` at 64 px, the AI Workspace empty state shows `HuskyMark`, the Husky companion uses `HuskyHead`, and the landing page (`src/components/landing/`, styled by its own `landing.css`) uses the full set. The app UI itself follows the design tokens in `src/index.css` (see SOT.md, "Visual system"); brand colors are not used as UI colors.

### Generated assets

Every favicon, app icon and social image is rendered from those components:

```bash
npx vite-node scripts/brand/generate-brand-assets.ts            # write all assets
npx vite-node scripts/brand/generate-brand-assets.ts --preview <dir>  # also write an HTML preview sheet
```

The script rasterizes with Playwright using the system Edge or Chrome (`BROWSER_CHANNEL` overrides the channel) and is deterministic: running it twice produces identical files. `scripts/brand/icon-encoders.ts` writes the `.ico` and `.icns` containers (covered by `tests/brand-icon-encoders.test.ts`). It writes:

- `public/favicon.svg`, `public/favicon.ico`, `public/favicon.png`, `public/apple-touch-icon.png`
- `public/brand/huskynote-mark.svg`, `public/brand/huskynote-tile.svg`, `public/brand/og-image.png` (referenced by the `index.html` Open Graph and Twitter tags)
- `public/official_huskynote.png` and `src/assets/official_huskynote.png` (1024 px tile, used by the Linux and Windows setup scripts)
- `src/assets/husky-mascot.png` (raster mascot for external use; the app renders `HuskyHead`)
- `desktop/windows/favicon.ico`, `desktop/installer/favicon.ico`, `desktop/linux/huskynote.png`, `browser-extension/icon.png`, `AppIcon.icns` (macOS)

After changing anything in `src/brand/`, rerun the generator and commit the regenerated files with the change.

The old raster media (the landing page's `public/mascot-reading.gif` reading animation and the `public/huskynote-demo.webp` walkthrough) were removed with the landing page rebuild; the new landing page draws its product mocks in HTML and CSS.

### Binaries

- The macOS disk images are built by `.github/workflows/build-macos.yml` (run it from the Actions tab) and committed to `public/downloads/` with their checksums.
- `HuskyNote-Setup-x64.exe` and `HuskyNote-Windows-Portable.zip` are produced by `npm run build:windows` or the release workflow (requires the .NET 9 SDK). Their `SHA256SUMS.txt` lines are stale until the next release build regenerates them.
- Builds are not code-signed. The macOS app is ad-hoc signed, not notarized, so Gatekeeper warns on first launch; `Open HuskyNote.command` clears the quarantine flag. Notarizing needs an Apple Developer ID. Windows SmartScreen may also ask for confirmation.
- The macOS app serves its bundled files with the system `python3`, which on a fresh Mac prompts to install the Command Line Tools. This behavior predates the rebrand.

### Other

- The repository is private, so the app does not query the GitHub API for a star count (the sidebar's Help menu and About only link to the repository). The opt-in update check (`src/services/updates/update-checker.ts`) is the only GitHub API call.
- The local working directory may still be named `DomoNote`. Renaming it is optional (steps below); keep the `upstream` remote, which points to `https://github.com/darknecrocities/DomoNote.git` for pulling upstream fixes.

### Renaming the local working folder

Nothing in the app depends on the folder's name: browser data is tied to the address the app runs at (`127.0.0.1:5173` for the dev server), not to the folder. Do this at a stopping point:

1. **Extension first, if you load it from this folder.** Chrome derives an unpacked extension's ID from its folder path, and its saved meetings and notes belong to that ID. Before moving the folder, open the extension's side panel and use **Export backup**; the extension has no import yet, so treat the export as the record of what it held.
2. **Close everything using the folder:** the dev server (`npm run dev`), editors, terminals, Claude Code or other agent sessions started in it, and Orca's view of it.
3. **Move the folder**, for example `DomoNote` → `HuskyNote` next to it (File Explorer, or `Move-Item` in PowerShell).
4. **Repair worktrees.** In the moved folder run `git worktree repair`; if a linked worktree still reports the old path, run `git worktree repair <path-to-that-worktree>` too. Check with `git worktree list`.
5. **Reinstall dependencies only if something fails:** `npm install` (`node_modules` holds absolute paths in a few tools' caches).
6. **Re-point tools that remember the path:** add the folder again in Orca or your editor. Claude Code keeps per-project memory under a name built from the folder path (`~/.claude/projects/<path with separators replaced by ->`); copy the old project's `memory` folder to the new name to keep it.
7. **Reload the extension** from its new location (Chrome → Extensions → Load unpacked) if you use it from this folder.

Find any remaining references with:

```bash
git grep -n -i -E 'domo|darknecro' -- ':!*.md' ':!LICENSE'
```

Expected matches are the migration code above and the About view credits.
