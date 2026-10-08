# Next roadmap step: Storage status and backup access

Date: September 30, 2026  
Status: Implementation plan; work not yet performed.

## Roadmap alignment

This document covers only the first unchecked task in [ROADMAP.md](ROADMAP.md), under **M1: Protect user work**:

> Expose workspace storage usage, persistence status, quota failures, and a clear backup action; build on the existing model-cache storage support.

“Next step” here means the next unfinished item in the product roadmap. The separate [UI/UX review](UI_UX_REVIEW.md) has its own recommended order of improvements; this document does not expand into that entire sequence.

## Outcome

In **Settings → Storage**, users can understand estimated storage consumption, whether persistent storage is granted, what a storage failure means, and how to prepare and save a complete backup of the active profile.

Unknown storage information must never appear as zero usage or as a confirmed lack of persistence. Preparing an archive must never imply that an external backup has already been saved.

## Existing implementation

- [BackupSettings](src/components/settings/backup-settings.tsx) already displays a combined usage/quota/persistence sentence and exposes preparation, download, inspection, and restore actions.
- That component reads `navigator.storage.estimate()` and `persisted()` once on mount. Missing estimates currently fall back to zero, and a missing persistence result is treated as false.
- The same component already explains that estimates may include model caches and other profiles.
- [Archive restore](src/services/backup/archive.ts) already checks estimated capacity before restoring. Actual write failures remain authoritative.
- [Settings](src/views/settings-view.tsx) already includes a Storage tab and mounts the backup controls.
- [BACKUP_FORMAT.md](BACKUP_FORMAT.md) documents archive scope, limits, exclusions, and platform verification gaps.

Extend these surfaces. Preserve the archive format, profile isolation, and existing recovery behavior.

## Scope boundaries

Included: storage reporting, explicit persistence states and a user-triggered persistence request where supported, quota-specific recovery messaging in backup/restore, refresh behavior, and clear backup action states.

Deferred: legacy migration, crash-orphan cleanup, recording recovery, broad application write-error handling, the note autosave defect identified in the UI/UX review, new archive formats, per-profile byte accounting, automatic deletion, and broader visual redesign. The autosave defect remains a separate urgent issue; completing this task does not resolve it.

## Proposed interface

Use one compact storage summary above the existing backup controls. Keep the current visual system.

| Element | Proposed behavior |
| --- | --- |
| Storage usage | Show formatted usage and quota only when known; label both as estimates. |
| Scope explanation | “This estimate covers this app’s browser storage, including other profiles and downloaded models.” |
| Unknown estimate | “Storage estimate unavailable.” Never fabricate a zero or percentage. |
| Persistence | Distinguish checking, granted, not granted, unavailable, and check failed. |
| Persistence action | Show “Request persistent storage” when supported and not granted; invoke only after a click. |
| Refresh | Re-read estimates and persistence without reloading or changing profiles. |
| Backup action | Retain “Prepare complete backup,” followed by “Save backup file” once preparation succeeds. |
| Backup scope | Name the active profile and retain the existing archive limits and exclusions. |

Explain persistence briefly: it reduces automatic storage eviction risk; it is not an external backup and does not protect against manual deletion or device failure.

For a denied persistence request, show a neutral explanation and retain ordinary app operation. Do not retry automatically or present unsupported APIs as a permission denial.

## Implementation sequence

### 1. Introduce a small storage-status service

Proposed file: `src/services/storage/status.ts`.

- Wrap capability detection, estimate reads, persistence reads, and persistence requests.
- Return structured results instead of a single display string.
- Keep usage and quota optional; accept only finite, nonnegative values.
- Compute a usage percentage only when both values are valid and quota is greater than zero.
- Keep estimate and persistence results independent so one failed API does not discard the other result.
- Distinguish unsupported APIs from rejected calls.
- Make requesting persistence an explicit method, separate from read-only status refresh.
- Recognize quota failures using structured error names, including relevant wrapped causes; inspect existing Dexie error shapes before implementing the classifier. Do not classify every write failure as a quota error.

Avoid presenting the origin-wide estimate as a measurement of the active profile. Reuse existing formatting or storage utilities if a suitable helper already exists.

### 2. Integrate the summary into Settings

Primary file: `src/components/settings/backup-settings.tsx`.

- Replace the current combined `storage` string with structured loading, result, and error states.
- Render usage, persistence, and backup scope as clearly labeled information.
- Add Refresh and the conditional persistence request action.
- Refresh on mount, after a persistence request, and after successful restore.
- Prevent stale async results from replacing newer refresh results or updating an unmounted component.
- Keep storage-status refresh separate from backup/restore busy state; it must not disable unrelated functionality unnecessarily.
- Use a polite status announcement for results, and retain accessible names for controls.
- Keep explanatory copy and controls usable at narrow widths and increased zoom.

Modify `src/views/settings-view.tsx` only if needed to avoid duplicate or contradictory storage summaries.

### 3. Clarify backup and quota failure states

Primary files: `src/components/settings/backup-settings.tsx` and, only where necessary, `src/services/backup/archive.ts`.

- Preserve the current active-recording guard and restore-to-new-profile contract.
- Preserve the estimated-capacity preflight check while labeling estimates as advisory.
- For an actual quota failure during restore, explain that the restore did not complete, retain the source backup, and provide a retry path after the user frees storage.
- Confirm transaction rollback and staging cleanup behavior before promising that existing profiles are unchanged in failure copy.
- Offer guidance toward existing recording/model storage management surfaces without deleting anything automatically.
- Distinguish quota failures from malformed archives, permissions, and general storage errors.
- Retain separate states for archive preparation and the save/download action.
- Do not display “Backup saved” merely because a download link was clicked. Only use completion language if the platform provides reliable confirmation.
- Preserve existing object-URL cleanup and avoid unnecessary copies of large archive data.

Suggested quota copy, after rollback is verified: “Not enough storage to restore this backup. Existing profiles are unchanged. Keep your backup file, free storage, then try again.”

### 4. Add focused verification

Proposed service tests: `tests/storage-status.test.ts`. Extend existing backup tests where appropriate.

| Scenario | Expected result |
| --- | --- |
| Estimate and persistence available | Accurate formatted values and persistence state. |
| Missing APIs | Unavailable state; no fabricated zero values or denial. |
| Estimate succeeds, persistence fails | Usage remains visible; persistence reports failure independently. |
| Persistence succeeds, estimate fails | Persistence remains visible; usage reports unavailable. |
| Zero/unknown quota | No invalid percentage or division by zero. |
| Persistence granted or denied | Correct feedback; app remains usable in both cases. |
| Rapid repeated refresh | Latest request determines the displayed state. |
| Restore preflight finds insufficient capacity | No restore writes; actionable explanation. |
| Actual quota failure after preflight | Restore aborts safely; existing profile data remains intact. |
| Other write failure | No misleading quota-specific message. |
| Archive prepared | UI asks user to save it externally; does not claim download completion. |

Use controlled storage API stubs and isolated test profiles. Never fill the user’s actual disk or modify their real workspace to reproduce quota failures.

Run the existing test suite and production build as required by the roadmap:

```text
npm test
npm run build
```

Run the existing backup browser smoke check with its documented dev-server setup if backup/restore behavior changes:

```text
npm run test:backup-browser
```

Inspect Settings → Storage in light and dark modes, at narrow and desktop widths, and with keyboard navigation. Record any packaged-app checks that cannot be performed; browser mocks do not certify native storage or download behavior.

### 5. Update documentation and task status

- Update [BACKUP_FORMAT.md](BACKUP_FORMAT.md) with the final persistence and quota guidance.
- Record checks actually performed and any platform limits.
- Mark only the targeted M1 checkbox complete after its acceptance criteria pass. Do not mark M1 itself complete: legacy migration and platform recovery gates remain separate.

## Acceptance criteria

- [ ] Settings displays known estimates accurately and unknown values honestly.
- [ ] Storage scope is clearly distinguished from active-profile backup scope.
- [ ] Persistence states are distinguishable and failures do not block ordinary use.
- [ ] A persistence request occurs only through an explicit user action.
- [ ] Quota failures provide actionable feedback without automatic deletion or false success.
- [ ] Restore failures preserve existing profiles and retain a retry path.
- [ ] Backup preparation and external file saving remain distinct states.
- [ ] Controls are keyboard accessible and remain usable at narrow widths.
- [ ] Relevant automated checks, build, and visual inspection pass, with unavailable platform checks documented.
- [ ] Documentation reflects verified behavior and only this roadmap task is marked complete.
