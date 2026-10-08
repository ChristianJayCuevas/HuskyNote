# UI/UX Review

Follow-up: [October 1 browser-based re-review and implementation results](UI_UX_REVIEW_2026-10-01.md).

Date: September 30, 2026  
Application: HuskyNote / DomoNote  
Design perspective: minimalist, GitHub-inspired workspace with an emphasis on predictable interactions, clear hierarchy, and user trust.

## Scope and limitations

This is a source-based heuristic review of the application shell, Home, notes, meetings, settings structure, and shared controls. No application code was changed during the review.

Live desktop inspection was unavailable because PowerShell could not resolve the `orca` command. Findings about implementation behavior are grounded in the source; visual recommendations are design judgments that still need validation in the running application. Rendered spacing, contrast, responsive layouts, and assistive-technology behavior were not tested. This is not a user study or a complete accessibility audit.

## Overall assessment

The app has a solid visual foundation. Its neutral palette, borders, icon family, and list-and-detail layouts support a focused workspace. The main opportunity is clearer prioritization and more dependable behavior.

The GitHub-inspired colors are already present. Further progress should emphasize understandable actions, reliable feedback, keyboard access, and a calmer hierarchy. Trust and navigation issues should be addressed before cosmetic changes.

## Strengths to preserve

- **Restrained visual foundation:** neutral surfaces, consistent icons, and subtle borders suit a content-heavy workspace.
- **List-and-detail layouts:** notes and meetings share a useful pattern for browsing and working without repeatedly changing screens.
- **Remembered layout preferences:** resizable and collapsible panels support different working styles.
- **Recognition cues:** previews, dates, tags, and version history help users identify and recover their work.
- **Plain storage language:** “saved on this device” explains local storage in terms users can understand.

Relevant sources: [theme configuration](tailwind.config.js), [color tokens](src/index.css), [resizable panels](src/components/ui/resizable-list-panel.tsx), [note list](src/components/notes/note-list.tsx).

## Priority findings

### 1. Failed saves report success

**Priority:** Critical  
**Evidence:** Confirmed in source.

The note editor catches an autosave error, logs it to the console, and then sets `saveStatus` to `saved`. The visible status consequently reports “Saved” even when persistence fails. Changes also wait 1.2 seconds before the save function marks them as saving, leaving a period when the status can still say “Saved” after an edit.

**User impact:** Users rely on save feedback when deciding whether it is safe to leave. False reassurance undermines the app’s core promise and can conceal unsaved work.

**Recommendation:**

- Mark a draft as having unsaved changes immediately after editing.
- Distinguish pending changes, saving, saved, and failed states.
- On failure, retain the draft and show “Couldn’t save” with Retry.
- Use “Saved on this device” when persistence succeeds.

**Acceptance check:** Simulate a storage failure. The editor must not report success, the draft must remain available, and Retry must persist the content before showing a saved state.

Source: [note editor](src/components/notes/note-editor.tsx), particularly `performSave`, `handleTitleChange`, and `handleContentChange`.

### 2. Mobile Back conflicts with automatic selection

**Priority:** High  
**Evidence:** Conflicting state transitions confirmed in source; live reproduction pending.

Notes and meetings automatically select the first available item whenever the active selection is empty. Their mobile Back actions clear that selection to reveal the list. The selection effect then selects an item again, which hides the list on mobile.

**User impact:** Back can appear ineffective or immediately reopen a detail screen. This breaks the user’s expectation of control over navigation.

**Recommendation:** Model list visibility separately from the selected item, or restrict automatic selection to desktop or initial entry. An intentional Back action must leave the mobile list visible.

**Acceptance check:** With multiple saved items, open an item on a narrow viewport, press Back, and select another item. The list should remain visible until the user chooses an item.

Sources: [notes view](src/views/notes-view.tsx), [meetings view](src/views/meetings-view.tsx).

### 3. Core content rows lack keyboard interaction

**Priority:** High  
**Evidence:** Confirmed in the reviewed source.

Note rows, meeting rows, and several recent-item rows on Home use clickable `div` elements without corresponding keyboard activation or focusability.

**User impact:** Keyboard users cannot reach and open core content through the expected interaction path.

**Recommendation:** Use semantic links or buttons as appropriate. Provide visible focus and expose selection using semantics appropriate to the chosen interaction pattern.

**Acceptance check:** Navigate through the main content using only the keyboard, open each item type, and confirm focus remains visible and predictable.

Sources: [note list](src/components/notes/note-list.tsx), [meetings view](src/views/meetings-view.tsx), [dashboard](src/views/dashboard-view.tsx).

### 4. Shared dialogs have incomplete focus behavior

**Priority:** High  
**Evidence:** Confirmed in the shared modal implementation; runtime assistive-technology testing pending.

The shared modal includes `role="dialog"`, `aria-modal="true"`, and Escape handling. It does not implement initial focus placement, focus trapping, restoration to the trigger, or an association between the dialog and its visible title.

**User impact:** Keyboard focus can remain behind the dialog or escape into the underlying interface. Users may lose their place when the dialog closes.

**Recommendation:** Implement a consistent accessible dialog primitive with a programmatic name, deliberate initial focus, contained keyboard navigation, and focus restoration. Ensure background content is unavailable while the modal is active.

**Acceptance check:** Open a dialog by keyboard, traverse it in both directions, close it, and verify that focus returns to its trigger. Check that a screen reader announces its title.

Source: [shared modal](src/components/ui/modal.tsx).

## Design and interaction recommendations

### 5. Make Home prioritize resuming work

**Priority:** Medium  
**Evidence:** Layout structure confirmed in source; hierarchy assessment is a design judgment.

Home presents five similarly styled creation tiles, workspace totals, and multiple recent-content cards. This gives substantial prominence to starting new work and to content categories before helping a returning user resume a task.

**User impact:** Users must scan multiple competing regions to answer “Where was I?” Counts contribute little to that decision unless they indicate something actionable.

**Recommendation:**

- Make a unified Recent list the main returning-user surface, with type, title, and last activity.
- Place today’s schedule alongside it or below it on smaller screens.
- Put creation actions in a compact toolbar with a clear primary action.
- Use a distinct first-run state that emphasizes one starting action and keeps alternatives available.
- Keep totals secondary unless they support a specific task.

Source: [dashboard](src/views/dashboard-view.tsx).

### 6. Make action labels match their immediate result

**Priority:** Medium  
**Evidence:** Confirmed in source.

On Home, “New Note” creates a note. “Start Meeting,” “Upload Document,” and “Create Guide” navigate to their sections without directly initiating the named setup flow.

**User impact:** Similar-looking actions have different levels of completion. Users must discover whether a button performs a task or merely takes them somewhere.

**Recommendation:** Open the corresponding creation or setup flow directly. “Start Meeting” should open recording setup and require an explicit recording action. If navigation alone is intended, use destination labels such as “View meetings.”

**Acceptance check:** Each action opens the flow its label promises and never begins audio capture merely because the user navigated to it.

Source: [dashboard action definitions](src/views/dashboard-view.tsx).

### 7. Reduce competing controls in the application shell

**Priority:** Medium  
**Evidence:** Control placement confirmed in source; perceived visual competition needs live validation.

The topbar contains dictation, Quick Bar, language, search, and theme controls. The sidebar adds AI status and connection controls, while a companion button occupies a persistent corner. Search’s text label is hidden below the `2xl` breakpoint.

**User impact:** Frequent and occasional actions compete for attention. Icon-heavy controls require users to remember meanings or inspect tooltips.

**Recommendation:** Give search a visible label at ordinary desktop widths. Group capture actions under a clearly labeled control, retaining immediate access to active recording controls. Move language and appearance preferences into a menu. Keep the companion optional and subordinate to the current task.

Sources: [topbar](src/components/layout/topbar.tsx), [sidebar](src/components/layout/sidebar.tsx), [app layout](src/components/layout/app-layout.tsx), [companion](src/components/ui/global-mascot-dock.tsx).

### 8. Reserve urgency for conditions that need attention

**Priority:** Medium  
**Evidence:** AI-offline presentation confirmed in source; emotional impact is a heuristic assessment.

The sidebar displays a pulsing red indicator when AI is disconnected. Core note-taking remains useful without an AI connection.

**User impact:** A persistent urgent signal can imply that the entire app is broken or that setup is mandatory. Repeated non-actionable urgency also weakens the meaning of real errors.

**Recommendation:** Distinguish “AI not configured,” disconnected service, connection attempt, and failed AI request. Use neutral presentation for optional setup and provide contextual guidance when a user requests AI assistance. Reserve red and persistent motion for conditions that warrant immediate attention.

Source: [sidebar AI status](src/components/layout/sidebar.tsx).

### 9. Strengthen type hierarchy and simplify containers

**Priority:** Medium  
**Evidence:** Typography and container classes confirmed in source; rendered legibility and contrast untested.

Note titles, previews, dates, tags, and many controls use `text-xs`. Weight carries much of the hierarchy. Home nests bordered rows inside bordered cards, while several navigation and action surfaces use rounded containers, shadows, and motion.

**User impact:** Similar text sizes can make scanning harder. Excessive framing can draw attention toward the interface instead of the content.

**Proposed baseline for validation:**

- 14px for list titles and standard controls.
- 12px for secondary metadata.
- 16px for long-form writing text.
- Subtle row separators within a shared list surface.
- A small, consistent set of corner radii and surface levels.
- Strong emphasis for the current selection and primary action.

These are proposed design values, not measured accessibility conclusions. Validate at common viewport sizes and increased zoom.

Sources: [note list](src/components/notes/note-list.tsx), [note editor](src/components/notes/note-editor.tsx), [dashboard](src/views/dashboard-view.tsx), [button styles](src/components/ui/button.tsx).

### 10. Preserve familiar navigation and shortcut expectations

**Priority:** Medium  
**Evidence:** Confirmed in source.

- The workspace logo navigates to the landing page instead of Home.
- The global Ctrl/Cmd+B shortcut toggles the sidebar without excluding text inputs or editing surfaces.
- The search shortcut displays “Cmd+K” even on Windows.

**User impact:** These behaviors conflict with common expectations: a workspace logo returns to the workspace home, Bold shortcuts belong to editing, and shortcut hints reflect the current platform.

**Recommendation:** Route the workspace logo to Home and expose the product website separately. Avoid intercepting formatting shortcuts while typing. Show platform-appropriate shortcut labels.

**Acceptance check:** Exercise shortcuts while editing a note and while navigating the shell. Confirm platform labels and logo navigation match their intended behavior.

Sources: [sidebar](src/components/layout/sidebar.tsx), [topbar](src/components/layout/topbar.tsx).

### 11. Simplify the note editor’s action hierarchy

**Priority:** Medium  
**Evidence:** Available actions confirmed in source; visual crowding needs live validation.

The editor exposes view modes, focus mode, dictation, history, Markdown export, PDF export, deletion, and a formatting toolbar. These actions have different frequencies and consequences.

**User impact:** A broad set of equally available controls can increase scanning effort during a task that benefits from sustained attention.

**Recommendation:** Keep writing and view controls easy to reach. Consolidate export formats and history into a document menu. Group deletion separately. Consider recoverable Trash or an Undo flow: the current permanent-delete confirmation prevents some accidents but provides no recovery after confirmation.

Source: [note editor](src/components/notes/note-editor.tsx).

## Proposed design direction

A quiet navigation rail, a clearly labeled search field, one primary action per screen, compact content rows, and a generous writing area would suit this product well.

Use the GitHub-inspired direction to guide predictable structure, explicit state, and consistent interaction patterns. Give prose enough space for comfortable reading and writing. Use accent color and motion selectively to communicate selection, progress, and meaningful status.

## Recommended order of work

1. Correct save feedback and verify draft retention on failure.
2. Resolve mobile list/detail navigation.
3. Make core rows and dialogs keyboard accessible.
4. Align action labels, destinations, and shortcuts with expected behavior.
5. Refine Home around resuming work and simplify the application shell.
6. Tune typography, surfaces, and editor controls through rendered inspection.

## Follow-up validation

The next review should inspect the running app in light and dark modes at phone, tablet, and desktop widths. It should include:

- First-time creation of a note and subsequent return to that note.
- Save failure, recovery, and navigation away from pending changes.
- Mobile list/detail navigation with multiple items.
- Keyboard-only navigation through lists, menus, and dialogs.
- Recording setup, permission denial, active recording, and saving.
- Empty, populated, loading, disconnected, and error states.
- Long titles, large collections, increased zoom, and measured contrast.

Use observed task completion and user hesitation to validate the proposed hierarchy. No claim of improved usability should be treated as established until those changes are tested.
