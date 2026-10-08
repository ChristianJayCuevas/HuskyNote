# UI/UX re-review — October 1, 2026

## Assessment

The app looks coherent and restrained on desktop, particularly in dark mode. Its biggest weakness is the gap between what a control promises and what actually happens. Visual polish cannot compensate for unreliable save feedback, ineffective Back navigation, or misleading search and backup actions.

The September 30 findings about save feedback, mobile selection, clickable content rows, and shared dialog behavior remain present. This review adds direct browser evidence and identifies inconsistencies that the earlier source review missed.

## Method and limits

Inspected current source and rendered the local development app in a fresh, isolated headless Edge context at 1440 × 900 and 390 × 844. Created only synthetic notes and a meeting inside that temporary context. External network requests were blocked, so AI was deliberately unavailable. No real workspace, microphone, downloaded speech model, or packaged desktop application was used.

Evidence was recorded as browser observations and screenshots, which are no longer kept in the repository. The diagnostic script captured the principal workspace screens and completed the interaction checks. Its initial run stopped at the landing screen because that screen contained two `main` landmarks and the locator expected one. After correcting that diagnostic locator, the full run also captured the landing screen. Marketing copy and landmark findings are grounded in source.

These checks establish the reproduced behaviors, not a complete accessibility audit or usability study. Screenshot captures immediately following theme changes can include transitions; do not treat an intermediate frame as proof of a permanent color defect.

## Browser-confirmed findings

| Priority | Finding | Evidence | Required behavior |
| --- | --- | --- | --- |
| Critical | A failed note write still displays “Saved.” | Injected a quota error into the note update. The editor showed Saved while IndexedDB retained the previous content. | Show unsaved/saving/error/saved accurately; preserve the draft and offer Retry. |
| High | Mobile Back does not return to the list. | After clicking Back, the editor remained visible and New Note in the list remained hidden. | Intentional Back must leave the list visible until an item is selected. |
| High | Header Search searches commands rather than workspace content. | A word present in a saved note returned “No matching commands.” | Expose clearly labeled content search; label the command palette separately. |
| High | Palette New Note creates no note. | Note count was two before and after activation. | Create and open a new note, or use a navigation label. |
| High | Version history opens without dialog focus or an accessible dialog name. | Focus remained outside the dialog; neither `aria-label` nor `aria-labelledby` was present. | Move focus into the dialog, contain it, name the dialog, and restore focus on close. |

Sources: [note editor](src/components/notes/note-editor.tsx), [notes view](src/views/notes-view.tsx), [topbar](src/components/layout/topbar.tsx), [command palette](src/components/ui/command-palette.tsx), [shared modal](src/components/ui/modal.tsx).

### Save feedback is the first implementation priority

The failure is more serious than a cosmetic status problem. Users treat Saved as permission to leave. Introduce an immediate unsaved state, an in-progress state, and an explicit error with Retry. Ensure pending edits remain associated with the correct note when switching items, navigating away, or retrying. A queued or stale write must not mark a newer draft as saved.

Also review version restoration: its current success toast is issued without awaiting the save result. Any action that claims content is persisted must depend on successful persistence.

### Search requires two clear entry points

The app already has a global content-search modal and a command palette, but the header labels the latter Search. Global content search is available through Ctrl/Cmd+Shift+F in the workspace context; that useful feature needs a discoverable visible entry point.

Keep a labeled workspace search control at ordinary desktop widths. Provide Commands as a separate menu or shortcut. Command descriptions must describe actual behavior. Several displayed command shortcut hints are not implemented by the reviewed global shortcut handler; remove unsupported hints or wire them up deliberately.

## New source-confirmed trust issue: two incompatible backup experiences

Settings offers a binary-inclusive `.huskybackup` archive. The command palette still exposes Export Workspace with the description “Download JSON archive of all local data,” generates a filename containing `backup`, and calls the old record-only exporter.

That exporter omits the binary assets table, and the complete recovery UI rejects legacy JSON as a complete backup. A user can therefore follow a prominent export action, receive success feedback, and mistakenly believe documents and recordings are protected.

**Priority: Critical.** Route the palette action to the same complete-backup flow as Settings. If record-only export is intentionally retained, label it explicitly as incomplete and never present it as a recoverable backup of all data.

Sources: [command palette](src/components/ui/command-palette.tsx), [legacy JSON exporter](src/db/index.ts), [backup settings](src/components/settings/backup-settings.tsx), [backup contract](BACKUP_FORMAT.md).

## Visual critique from rendered screens

### Home is orderly but gives too much space to empty categories

The populated dark Home screen has a clean palette and consistent alignment. However, five equally weighted action tiles precede content, and large empty Documents and Step guides cards remain visible with only two notes and one meeting. The grid describes the app's feature categories more strongly than the user's current work.

Make Recent activity the main surface. Put creation actions in a compact row and make the primary action clear. Empty categories can become small prompts or disappear from the returning-user view until relevant. Preserve an explicit first-run screen for users with no content.

Evidence: populated Home.

### The editor devotes substantial space to controls

Desktop notes use a navigation rail plus a 320px list panel before the writing surface. The editor header includes modes, focus, dictation, history, two exports, and deletion, followed by another formatting row. These controls are aligned, but their density competes with the writing task.

On mobile, text labels disappear and the toolbar becomes a sequence of similar small icons. Markdown and PDF export are visually indistinguishable download icons. The user must infer the distinction from location or a tooltip that is difficult to discover on touch.

Keep formatting and the current view readily available. Move exports and history into a named document menu. Group deletion separately. Give touch controls explicit accessible names and sufficient hit areas, and use a labeled overflow menu instead of stripping every label.

Evidence: desktop editor, mobile editor.

### Typography is consistently small

List titles, metadata, guidance, and many controls are 12px. Consistency is useful, but meaningful hierarchy needs differences in size, spacing, and emphasis. Use roughly 14px for list titles and controls, 12px for metadata, and a user-adjustable writing size starting around 16px. Validate these proposed values with realistic content, zoom, and smaller displays.

The raw Markdown editor is suitable for technical users; whether it should be the default depends on the intended audience. Do not assume that a GitHub-inspired visual preference means every user is comfortable writing Markdown.

### Transcription setup uses good progressive disclosure, but its main path is verbose

The basic setup begins with conversation language and a microphone test, while model selection sits under Advanced. This is a sound structure: users can choose an outcome before inspecting implementation details.

The basic panel still exposes effective model, size variants, pinned revisions, cache behavior, offline caveats, device details, and diagnostics together. “Set up transcription / retry” combines two states into one label.

Use state-specific labels: Download transcription model, Retry setup, and Check readiness. Keep language, download size, progress, and microphone test in the main path. Place revision/cache explanation and timing diagnostics in Advanced. Keep limitations available through concise supporting copy.

Evidence: transcription settings.

### Recording setup should explain readiness before recording

The meeting screen has a strong Start recording action, separate transcript and notes panels, and a recognizable timer. These are good anchors.

Before capture, the transcript promises live text and speaker names. Model readiness and speaker-name expectations should be explained accurately at that point. If a model is not ready, say whether audio can still be recorded and transcribed later. Present microphone access, audio source, and transcription readiness as distinct states; an unrelated AI-offline indicator should not imply speech recognition is unavailable.

Evidence: meeting setup. Actual microphone capture and transcript accuracy were not tested.

## Remaining source-based concerns

- **Keyboard access:** note, meeting, and Home content rows still use clickable `div`s without standard keyboard activation.
- **Shortcut conflict:** global Ctrl/Cmd+B toggles the sidebar even while editing text.
- **Platform hints:** Cmd shortcut labels are displayed on Windows.
- **Navigation expectation:** the workspace logo opens marketing content rather than Home.
- **Optional-service urgency:** pulsing red AI Offline status is persistent even when the current task does not require AI.
- **Storage unknown states:** absent estimates become zero values and absent persistence information becomes a negative result. Unknown and denied states should be distinguished.
- **Light theme consistency:** the companion includes hardcoded white text on light-mode zinc surfaces. Validate the expanded panel and use semantic light/dark tokens.
- **Marketing trust:** landing copy includes “100% Offline,” “Zero Cloud,” and “Everything stays 100% private,” while the app supports optional Claude requests and initial model downloads. Make the local default and optional external processing clear without absolute promises.
- **Landmarks:** the landing screen nests a `main` element within the application layout's `main`. Use one primary main landmark.

## Implementation order

1. Correct note save state, retry behavior, and persistence-related success messages.
2. Align all backup entry points with complete, recoverable archives.
3. Fix mobile list navigation and keyboard/dialog behavior.
4. Separate content search from commands and make commands perform their named actions.
5. Refine editor menus, typography, and Home hierarchy using before/after captures.
6. Simplify setup copy and verify service-readiness and privacy messages.

The storage roadmap plan remains a separate implementation scope. These recommendations do not mark any product milestone complete.

## Implementation results

The findings above describe the baseline captured before implementation. Following approval to address the review, the following changes were implemented on October 1:

- Note drafts show unsaved, saving, saved-on-device, and failure states. Failed saves offer Retry. Writes are serialized, navigation flushes pending changes to the correct note, and failed drafts remain in memory for reopening while the app stays open. Closing or reloading can still lose an unpersisted draft; a browser leave warning is requested when unsaved drafts exist.
- Version restoration shows success only after persistence succeeds. Deleting a note cancels pending draft saves and waits for any active write before deletion.
- Mobile notes and meetings no longer automatically select the first item when returning to the list. Desktop initial selection remains available.
- The command palette's record-only Export Workspace action was replaced with Back up active profile, which opens the complete-backup flow in Settings → Storage, including when Settings is already open on another tab.
- The editor's action group wraps to accommodate explicit save feedback on smaller screens.

- Header Search now opens workspace content search. Commands has a separate entry point with a platform-appropriate shortcut hint. The palette creates new notes, opens meeting setup without starting recording, and opens the document picker. Unsupported shortcut hints were removed.
- Shared dialogs and the command palette move focus inside, contain Tab navigation, make background content inert, and restore focus on close. Dialogs have programmatic names. Note, meeting, recent-work, search-result, and revision rows use keyboard-operable buttons with focus indicators.
- Home prioritizes a combined Recent work list and today's schedule. Creation actions use a compact toolbar; large empty category cards and workspace totals no longer compete with recent work.
- The editor groups history, exports, and deletion under a labeled Note actions menu. Writing text is larger, standard small buttons are more legible, and mobile menu placement is bounded by the viewport. Revision history stacks on narrow screens.
- Note deletion offers Undo until its notification is dismissed. Recovery retains the deleted note's content, tags, and revisions in the current app session. It is not a persistent Trash facility and does not survive restarting the app.
- The workspace logo returns to Home. Ctrl/Cmd+B no longer collapses the sidebar when typing in an input, textarea, or contenteditable surface.
- Appearance and language controls are grouped into a header menu. AI-not-connected status uses a neutral indicator. The companion is opt-in by default, honors an explicit prior visibility preference, and uses light/dark styling that keeps its content visible.
- Transcription setup uses state-specific action labels and moves technical detail and diagnostics into Advanced. Recording setup explains audio permission and transcription readiness separately, and transcript copy no longer promises immediate text or accurate speaker names.
- Missing storage APIs produce explicit unknown states instead of fabricated zero values or a false persistence denial. The broader storage roadmap task remains separate.
- English landing copy explains local defaults, optional Claude processing, and initial downloads. A processing disclosure is also rendered through the English fallback where no translation exists. The nested main landmark was removed. Theme transitions and CSS motion respect reduced-motion preferences.

## Verification and remaining limits

The current browser regression script is [scripts/test-ui-ux-browser.mjs](scripts/test-ui-ux-browser.mjs). Run it with a local preview at `http://127.0.0.1:5188`, or set `TEST_BASE_URL`. The earlier inspection script and observations are historical baseline evidence and target the pre-change interface.

Browser regressions cover save failure/retry, retained drafts, rapid note switching, mobile Back, complete-backup navigation, content search, dialog focus trapping/restoration and inert background, command creation/setup, direct document selection, editor/menu viewport bounds, note deletion/Undo, light theme, one landing main landmark, and unknown storage states.

Before/after screenshots were captured during the review; they are no longer kept in the repository. Running the regression script saves new ones to `artifacts/ui-ux-review-2026-10-01/after/`, which git ignores.

Validation does not establish real-device microphone behavior, transcription accuracy, packaged-desktop compatibility, or a complete screen-reader audit. English copy was revised; other existing translations need a dedicated editorial pass to fully align their older marketing statements. Draft retention and deletion Undo currently last only while the app session remains open. Permanent draft recovery after crashes and persistent Trash require separate data and archive contracts.
