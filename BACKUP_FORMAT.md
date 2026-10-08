# Portable backup and recovery

## Using backups

In Settings → Storage, choose **Prepare complete backup**, then **Save backup file**. Copy the `.huskybackup` file to a private location outside the app/browser data directory (for example, an external drive). Preparing a backup does not mean the file has been saved; verify the download completed. Backups are unencrypted and can contain sensitive audio, screenshots, and text.

Use **Choose backup to verify and restore**, review the source, counts, and warnings, and choose a unique new profile name. Restore never merges or overwrites an existing profile and does not switch your current profile. The restored profile is available in the profile menu. Model downloads, credentials, and local service configuration must be set up again; pending transcription resumes only when explicitly requested.

The archive is independent of operating-system paths and browser storage directories. The same format is used by web, Windows WebView2, and macOS WKWebView. Each installation and browser origin retains its own data; transferring the archive is an explicit operation, not synchronization. Back up each profile separately. Do not rely on copying live IndexedDB directories between platforms.

Stop capture, let edits autosave, and avoid edits in other windows during backup. The database is read in one consistent readonly transaction. Unsaved editor buffers are not part of that snapshot. Partial audio is preserved, but an interrupted recording container is not guaranteed to be playable without repair.

## Included and excluded data

All current profile tables are included: notes with revisions, meetings, documents, annotations, operation sessions, manuals, templates, schedule, binary blobs (including unlinked assets), interrupted recording chunks, and pending speech jobs.

Portable settings use an allowlist: theme, autosave interval, speech language, selected local model name, and transcription engine. API keys, service URLs (which may contain credentials), cloud-provider configuration, calendar OAuth/localStorage credentials, microphone/device choices, profile registry, and model caches are excluded. Secrets pasted into notes or recorded on screen remain user content and cannot automatically be removed.

Old `.json` workspace exports did not include binary files. This recovery flow rejects them with an explanation instead of treating them as complete backups. Keep those files and the original installation; make a new complete backup there if possible. Legacy record-only service functions remain for compatibility but are no longer exposed as complete backup/restore controls.

## Version 1 format

File extension: `.huskybackup`; transport MIME: `application/octet-stream`.

| Region | Encoding |
| --- | --- |
| Bytes 0–7 | ASCII `HUSKYBK1` |
| Bytes 8–11 | Unsigned 32-bit little-endian manifest byte length |
| Bytes 12–43 | SHA-256 of the exact manifest bytes |
| Manifest | UTF-8 JSON: format, version, creation date, source profile name, tables, ordered assets |
| Remaining bytes | Raw assets in manifest order; no padding or compression |

Each asset entry contains a unique ID, byte size, lowercase SHA-256, and MIME type. Binary table records replace `data` (blobs/chunks) or `audio` (jobs) with an `asset` ID. Pending PCM is explicitly IEEE float32 little-endian at the existing 16 kHz mono job sample rate. Images embedded as data URLs remain inside records. There are no archive filesystem paths to extract.

Limits: 512 MiB total, 32 MiB manifest, 100,000 table records and 100,000 assets. The implementation does not promise streaming or arbitrarily large profile support. Raw assets avoid base64 expansion and compressed-file expansion attacks; hashing uses one asset buffer at a time. Very large single assets and the database snapshot still require memory. Exceeding a limit fails explicitly without producing a partial backup.

## Restore safety

Before writing: validate format/version, bounded sizes, required/nested record shapes, duplicate IDs, critical file/document/meeting references, asset existence, finite PCM, and every checksum. Unknown archive versions are rejected. Checksums detect accidental damage, not authenticity: someone who edits a backup can recompute them.

Restore into a freshly generated, isolated database using one transaction. Register the new profile only after commit. If writes or profile registration fail, delete only that invocation's staging database; the current profile is untouched. A process crash between commit and registration can leave an unlisted staging database; retrying creates a separate profile and does not reuse partial state. Automatic cleanup of crash-orphaned staging databases is not yet implemented.

Quota estimates are advisory. Actual quota/write errors remain authoritative and abort restore. Keep the original backup until the restored profile has been checked.

## Platform verification

September 30, 2026: 170 automated tests and the production web build passed. The download/import round trip passed in Edge and Playwright WebKit with persistent profiles on Windows. WebKit's private test context could not store Blob fixtures; persistent profiles passed. Use normal persistent browser storage, not private browsing, for work you need to retain.

- Automated service tests cover full round trips, credential exclusions, malformed records, missing references, corruption, truncation, unsupported versions, and write/registration failures.
- `npm run test:backup-browser` uses a dev server at port 5187 (override `TEST_BASE_URL`) and a fresh Edge profile by default. It saves an actual archive and imports it into another isolated context. No user workspace or real microphone is accessed.
- Set `BROWSER_ENGINE=webkit` to run the same browser test with Playwright WebKit (install with `npx playwright install webkit`). This is not a substitute for testing the native macOS shell.
- Windows adds a Save dialog for backups and retains WebView2 download progress/errors. macOS adds native open/save/download delegates and reveals completed downloads in Finder; choose a new filename rather than replacing an old backup. Implementations follow [Microsoft's download event contract](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.downloadstarting) and [Apple's download destination contract](https://developer.apple.com/documentation/webkit/wkdownloaddelegate/download(_:decidedestinationusing:suggestedfilename:completionhandler:)).
- Native release gate: build Windows with .NET 9 and macOS with the configured macOS 12+ SDK targets. Test save, cancellation, full disk, file selection, restore, restart, and cross-platform transfer in the actual packaged apps. These native checks cannot be certified from the current Windows/.NET 6 environment.
