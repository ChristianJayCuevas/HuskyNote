# HuskyNote Roadmap

Planning baseline: v0.5.0, reviewed September 30, 2026.

This is a proposed delivery sequence, not a release commitment. Milestones are ordered by dependency and user impact; dates and owners should be assigned when capacity is known. Existing implementation is distinguished from work that still needs verification. This roadmap does not certify the current build or shipped binaries.

## Product direction

Make HuskyNote a dependable local workspace for capturing knowledge, finding its source, and turning it into useful notes, decisions, and procedures. Prioritize people who work across meetings, documents, and repeatable computer tasks.

Preserve local data ownership, useful operation without AI, explicit permissions, optional cloud AI, and the existing visual system. Users should understand when content leaves their device and be able to recover their work independently of the app.

## Current foundation

The repository already implements:

- Markdown notes, version history, templates, separate workspace profiles, and scheduling.
- Meeting recording and on-device transcription with selectable engines and model caching.
- PDF reading, annotations, document questions, and procedure generation.
- Screen capture, a manual builder, and several export formats.
- Ollama and optional Claude providers, context selection, and lexical document retrieval.
- Windows, macOS, and Linux packaging, a browser extension, and an optional Python companion.
- Vitest service tests and CI workflows for web checks and desktop builds.

These capabilities should be strengthened before adding more major product surfaces.

## Delivery sequence

| Milestone | Priority | Outcome | Dependency |
| --- | --- | --- | --- |
| M1: Protect user work | P0 | Complete backups and predictable recovery | None |
| M2: Trust everyday capture | P0 | Reliable setup, recording, transcription, and failure handling | M1 archive and recovery contracts |
| M3: Connect knowledge to action | P1 | Faster discovery and traceable AI output | M1 data contracts; M2 stable capture |
| M4: Prepare a dependable release | P1 | Verified installation, accessibility, privacy, and upgrades | M1-M3 acceptance gates |
| Later: Selective expansion | P2 | Additional capabilities justified by user evidence | Stable release and feedback |

Security, documentation, and regression testing belong in every milestone. Urgent defects should be fixed when discovered rather than waiting for M4.

## M1: Protect user work

Implementation update: portable binary-inclusive backup, integrity/schema/reference validation, isolated new-profile restore, settings allowlisting, storage estimates, and native file-control adapters are implemented. See [BACKUP_FORMAT.md](BACKUP_FORMAT.md) for scope, size limits, legacy JSON limitations, and the remaining packaged-Windows/macOS validation gates. Legacy migration, crash-orphan cleanup, and the complete platform exit gate remain open.

Why first: the current workspace JSON exporter serializes records but omits the `blobs` table. A restored document, recording, or screenshot can therefore retain a reference without its underlying file. The importer merges records by ID and does not restore exported settings.

- [x] Define a versioned archive that includes records and referenced binary assets, with size and integrity checks.
- [x] Make archive scope explicit: active profile initially; document how other profiles are backed up separately.
- [x] Add an import preview with record counts, compatibility checks, and explicit merge or restore-to-new-profile behavior.
- [x] Validate archive schemas and references before writes; prevent partial restores and explain conflicts.
- [x] Define which non-secret settings are restored. Continue excluding API keys from exports.
- [ ] Expose workspace storage usage, persistence status, quota failures, and a clear backup action; build on the existing model-cache storage support.
- [ ] Verify legacy migration and profile isolation with actual IndexedDB operations, including interrupted migration and retry.

Exit gate: export a profile containing notes and revisions, a PDF and annotations, meeting audio and transcript, a screenshot manual, custom templates, and schedule entries. Restore into a fresh profile and verify content, file hashes, and relationships. Invalid archives must leave existing data intact, and no secret may appear in the archive.

Relevant code: [database and archive functions](src/db/index.ts), [profile management](src/services/profiles.ts), [legacy migration](src/services/legacy-migration.ts), [model cache](src/services/audio/model-cache.ts).

## M2: Trust everyday capture

Detailed delivery plan: [Better, faster transcription with simpler setup](TRANSCRIPTION_PLAN.md).

Why next: recording and transcription cross browser permissions, audio devices, model downloads, GPU availability, and local services. Service tests alone cannot establish that the complete user journey works.

- [ ] Add a first-run readiness flow for microphone access, storage, transcription models, and the selected AI provider. Keep ordinary note-taking available throughout setup.
- [ ] Make model download progress, cancellation, retry, disk requirements, and offline readiness understandable.
- [ ] Audit recording persistence; checkpoint audio and transcripts so users can recover after interruption. Block unsafe profile switches or offer a clear save-and-stop flow.
- [ ] Verify microphone unplugging, denied permissions, ended screen sharing, background tabs, and provider disconnection.
- [ ] Add browser-driven tests for note autosave, profile switching, archive restore, PDF annotations, and recording start/stop. Use controlled audio fixtures for automation and real hardware for capture verification.
- [ ] Establish a supported browser and desktop capability matrix, including system audio and WebGPU/WebAssembly fallback differences.
- [ ] Consolidate recording lifecycle logic where necessary to make cleanup and recovery testable.

Exit gate: complete a 60-minute reference recording on each supported capture surface; saved audio must reopen, transcript timestamps must remain ordered, and interruption recovery must meet a documented loss budget. Proposed checkpoint target: no more than five seconds of recoverable capture lost. Permission and device failures must preserve previously saved work.

Relevant code: [audio services](src/services/audio), [meeting recorder](src/components/meetings/meeting-recorder.tsx), [transcription settings](src/components/settings/transcription-settings.tsx), [current service workflow tests](tests/e2e.test.ts).

## M3: Connect knowledge to action

Why next: search currently loads entity collections and scans text in the UI. Document retrieval uses lexical matching and page-based prompts. These provide a starting point for more useful, verifiable navigation.

- [ ] Add ranked search with type, date, and tag filters, useful matching excerpts, and direct navigation to PDF pages or transcript timestamps.
- [ ] Benchmark large profiles and introduce an incremental local index if needed to meet the search budget.
- [ ] Preserve stable source references through AI responses, saved notes, generated steps, and manual exports.
- [ ] Apply context budgets and clear no-evidence responses; evaluate multilingual queries and irrelevant matches before considering local embeddings.
- [ ] Let users review extracted meeting actions and promote them into the existing schedule, with editable ownership and dates plus a backlink to the source.
- [ ] Improve the capture-to-manual review flow: edit descriptions, remove duplicate steps, redact sensitive screenshot regions, and preview exports.
- [ ] Create a fixed evaluation set for retrieval, source references, action extraction, and generated procedures. Keep fixtures out of production data paths.

Exit gate: a user can find a meeting decision, open its source, create an editable follow-up, and export a procedure with intact source references. Proposed search target: p95 below 300 ms after indexing on a documented reference machine and a 10,000-record fixture with specified text sizes. Every displayed citation in the evaluation set must resolve; record answer quality separately from citation validity.

Relevant code: [global search](src/components/search/global-search-modal.tsx), [document retrieval](src/services/ai/rag.ts), [AI workspace](src/components/ai-workspace/ai-workspace-view.tsx), [calendar services](src/services/calendar), [manual builder](src/components/operations/manual-builder.tsx).

## M4: Prepare a dependable release

- [ ] Verify clean install, launch, upgrade, data retention, and uninstall behavior on every platform advertised as supported.
- [ ] Regenerate release artifacts and checksums together; verify download routes return the intended binaries and publish a tested compatibility matrix.
- [ ] Resolve or explicitly document the macOS system-Python dependency. Assess signing and notarization separately; required credentials and funding are release dependencies.
- [ ] Test extension capture, transfer into the workspace, disconnect recovery, and compatibility across app/extension versions.
- [ ] Review companion endpoints, allowed origins, desktop bridges, imported content, exported HTML, and API-key handling. Replace unnecessarily broad access with explicit trust boundaries.
- [ ] Align privacy documentation with actual network behavior: optional Claude requests, model downloads, configured endpoints, GitHub features, and any browser speech fallback. Verify disclosures against a network trace.
- [ ] Complete keyboard and screen-reader checks for core workflows, including focus handling in dialogs, recording controls, contrast, and reduced motion.
- [ ] Update README, SOT, onboarding, troubleshooting, and release notes to match verified behavior.

Exit gate: all supported-platform smoke checks pass, upgrade tests retain the M1 reference workspace, release checksums match downloads, and no known release-blocking data-loss or security defect remains. Record unsupported capabilities explicitly. Signing credentials must be available before promising signed distribution.

Relevant code and docs: [CI workflows](.github/workflows), [desktop shells](desktop), [extension](browser-extension), [companion](local-companion), [rebranding release caveats](REBRANDING.md), [architecture](SOT.md).

## Later: Selective expansion

Revisit these after the reliability milestones and direct user feedback:

- Local OCR for scanned PDFs, if failed text extraction is a frequent blocker.
- Local semantic retrieval, if measured lexical-search quality is insufficient.
- More calendar integrations, if the existing schedule and export flows prove inadequate.
- Optional encrypted synchronization, only after archive compatibility, conflict resolution, and key recovery are designed.
- Collaboration or mobile clients, only with a separate scope and a clear way to preserve the local-first model.

Avoid making cloud accounts mandatory or adding new providers simply to increase the feature count.

## First implementation batch

1. Specify the complete archive format, profile scope, import behavior, and backward compatibility.
2. Implement binary-inclusive export and validated restore, with round-trip and failure tests.
3. Surface storage status and backup limitations in Settings until complete restore is available.
4. Establish browser smoke coverage for autosave, profile isolation, and archive restore.
5. Audit recording persistence and define the checkpoint/recovery design for M2.

Assign an owner and estimate to each item before scheduling it. Keep changes small enough to review and tie each to its milestone's exit gate. Run the existing test suite and production build for implementation changes, plus focused browser or platform checks where relevant.

Track milestone acceptance results, user-reported data loss, capture failures, retrieval quality, and task completion through reproducible fixtures and voluntary feedback; do not introduce background telemetry. Review priorities after each milestone and record material changes here.
