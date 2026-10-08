import { db, DEFAULT_SETTINGS, HuskyNoteDatabase } from '../../db';
import { getActiveProfile, profileDatabaseName, registerRestoredProfile, type Profile } from '../profiles';
import { validators, validateRecords } from './schema';

// v1: 8-byte magic, uint32 LE manifest length, SHA-256 manifest, UTF-8 manifest, raw assets.
// No compression/base64: bounded parsing and no decompression bombs or filesystem paths.
const MAGIC = 'HUSKYBK1';
const HEADER = 44;
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST = 32 * 1024 * 1024;
const names = Object.keys(validators);
type Tables = Record<string, any[]>;
interface Asset { id: string; size: number; hash: string; type: string }
interface Manifest { format: 'huskynote-backup'; version: 1; createdAt: string; profileName: string; tables: Tables; assets: Asset[] }
export interface BackupPreview { profileName: string; createdAt: string; counts: Record<string, number>; bytes: number; warnings: string[] }
const prepared = new WeakMap<BackupPreview, { tables: Tables; assets: Map<string, Blob> }>();
const hash = async (blob: Blob) => {
  if (!globalThis.crypto?.subtle) throw new Error('Backup integrity checks require HTTPS or the local desktop app.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Allowlist portable preferences; endpoints may contain passwords/tokens and are intentionally excluded. */
function safeSettings(value: any) {
  return { id: 'current', theme: 'dark', autoSaveIntervalSeconds: value?.autoSaveIntervalSeconds ?? 3,
    speechLanguage: value?.speechLanguage ?? 'auto', selectedModel: value?.selectedModel ?? '',
    ...(typeof value?.transcriptionEngine === 'string' ? { transcriptionEngine: value.transcriptionEngine } : {}) };
}

function checkReferences(t: Tables): void {
  const ids = (table: string) => new Set(t[table].map((r) => r.id));
  const blobs = ids('blobs'); const meetings = ids('meetings'); const documents = ids('documents');
  const partial = new Set(t.audioChunks.map((r) => r.recordingId));
  const pending = new Set(t.speechJobs.map((r) => r.meetingId));
  const requireRef = (valid: boolean, label: string) => { if (!valid) throw new Error(`Missing archive reference: ${label}.`); };
  for (const d of t.documents) requireRef(blobs.has(d.fileBlobId), `document ${d.id} file`);
  for (const a of t.annotations) requireRef(documents.has(a.documentId), `annotation ${a.id} document`);
  for (const m of t.meetings) if (m.audioBlobId) requireRef(blobs.has(m.audioBlobId) || partial.has(m.audioBlobId) || pending.has(m.id), `meeting ${m.id} audio`);
  for (const job of t.speechJobs) requireRef(meetings.has(job.meetingId) && !!t.meetings.find((m) => m.id === job.meetingId)?.audioBlobId, `job ${job.id} meeting audio`);
  for (const item of [...t.manuals, ...t.operationSessions]) for (const step of item.steps) {
    if (step.screenshotBlobId) requireRef(blobs.has(step.screenshotBlobId), `step ${step.id} screenshot`);
  }
}

export async function exportBackup(source: HuskyNoteDatabase = db, profileName = getActiveProfile().name): Promise<Blob> {
  // One readonly snapshot keeps record/asset relationships consistent across concurrent edits.
  const tables: Tables = await source.transaction('r', source.tables, async () => {
    const result: Tables = {};
    for (const name of names) result[name] = await source.table(name).toArray();
    return result;
  });
  tables.settings = [safeSettings(tables.settings[0])];
  const assets: Asset[] = []; const parts: Blob[] = [];
  let bytes = 0;
  for (const name of ['blobs', 'audioChunks', 'speechJobs']) {
    for (const record of tables[name]) {
      const field = name === 'speechJobs' ? 'audio' : 'data';
      const value = record[field];
      let blob: Blob;
      if (field === 'audio') {
        if (!(value instanceof Float32Array)) throw new Error('Invalid pending audio.');
        const buffer = new ArrayBuffer(value.length * 4); const view = new DataView(buffer);
        value.forEach((sample, i) => view.setFloat32(i * 4, sample, true));
        blob = new Blob([buffer], { type: 'application/x-huskynote-f32le' });
      } else {
        if (!(value instanceof Blob)) throw new Error('Invalid binary asset.');
        blob = value;
      }
      bytes += blob.size;
      if (bytes > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 512 MiB limit. Export large recordings separately first.');
      const id = String(assets.length);
      assets.push({ id, size: blob.size, hash: await hash(blob), type: blob.type });
      parts.push(blob); delete record[field]; record.asset = id;
    }
  }
  validateRecords(tables); checkReferences(tables);
  const manifest: Manifest = { format: 'huskynote-backup', version: 1, createdAt: new Date().toISOString(), profileName, tables, assets };
  const metadata = new Blob([JSON.stringify(manifest)]);
  if (metadata.size > MAX_MANIFEST || HEADER + metadata.size + bytes > MAX_BACKUP_BYTES) throw new Error('Backup exceeds supported size limits.');
  const header = new Uint8Array(HEADER); header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(8, metadata.size, true);
  header.set(new Uint8Array(await crypto.subtle.digest('SHA-256', await metadata.arrayBuffer())), 12);
  return new Blob([header, metadata, ...parts], { type: 'application/octet-stream' });
}

export async function inspectBackup(file: Blob): Promise<BackupPreview> {
  if (file.size > MAX_BACKUP_BYTES || file.size < HEADER) throw new Error('Unsupported backup size (maximum 512 MiB).');
  const header = new Uint8Array(await file.slice(0, HEADER).arrayBuffer());
  if (new TextDecoder().decode(header.slice(0, 8)) !== MAGIC) throw new Error('Not a .huskybackup archive. Legacy JSON backups omit files and cannot be restored as complete backups.');
  const size = new DataView(header.buffer).getUint32(8, true);
  if (!size || size > MAX_MANIFEST || HEADER + size > file.size) throw new Error('Invalid manifest size.');
  const metadata = file.slice(HEADER, HEADER + size);
  const expected = Array.from(header.slice(12)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (await hash(metadata) !== expected) throw new Error('Backup manifest integrity check failed.');
  const manifest = JSON.parse(await metadata.text()) as Manifest;
  if (manifest.format !== 'huskynote-backup' || manifest.version !== 1) throw new Error('Unsupported backup version. Update the app before restoring.');
  if (typeof manifest.profileName !== 'string' || typeof manifest.createdAt !== 'string' || !Array.isArray(manifest.assets) || manifest.assets.length > 100_000) throw new Error('Invalid backup metadata.');
  validateRecords(manifest.tables); checkReferences(manifest.tables);
  const assets = new Map<string, Blob>(); let offset = HEADER + size;
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== 'string' || assets.has(asset.id) || !Number.isSafeInteger(asset.size) || asset.size < 0
      || typeof asset.type !== 'string' || !/^[a-f0-9]{64}$/.test(asset.hash) || offset + asset.size > file.size) throw new Error('Invalid binary asset entry.');
    const blob = file.slice(offset, offset + asset.size, asset.type); offset += asset.size;
    if (await hash(blob) !== asset.hash) throw new Error(`Binary asset ${asset.id} is damaged.`);
    assets.set(asset.id, blob);
  }
  if (offset !== file.size) throw new Error('Unexpected trailing backup data.');
  const referenced = new Set<string>();
  for (const name of ['blobs', 'audioChunks', 'speechJobs']) for (const record of manifest.tables[name]) {
    const asset = assets.get(record.asset);
    if (!asset || (name === 'speechJobs' && asset.size % 4 !== 0)) throw new Error('Missing or invalid binary asset.');
    referenced.add(record.asset);
    if (name === 'speechJobs') {
      const samples = new DataView(await asset.arrayBuffer());
      for (let i = 0; i < samples.byteLength; i += 4) if (!Number.isFinite(samples.getFloat32(i, true))) throw new Error('Invalid PCM sample.');
    }
  }
  if (referenced.size !== assets.size) throw new Error('Unreferenced binary assets.');
  manifest.tables.settings = [safeSettings(manifest.tables.settings[0])];
  const preview: BackupPreview = { profileName: manifest.profileName, createdAt: manifest.createdAt,
    counts: Object.fromEntries(names.map((name) => [name, manifest.tables[name].length])), bytes: file.size,
    warnings: ['Unencrypted backup: keep this file private. API keys, service endpoints, calendar credentials, and downloaded models are excluded.',
      ...(manifest.tables.audioChunks.length ? ['Contains interrupted recording chunks; some containers may need external repair.'] : []),
      ...(manifest.tables.speechJobs.length ? ['Pending speech jobs are retained. Set up the model, then resume them manually.'] : [])] };
  prepared.set(preview, { tables: manifest.tables, assets });
  return preview;
}

export async function restoreBackup(preview: BackupPreview, name: string): Promise<Profile> {
  const data = prepared.get(preview);
  if (!data) throw new Error('Select and validate the backup again.');
  if (!name.trim() || name.trim().length > 40) throw new Error('Use a profile name of 1–40 characters.');
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < preview.bytes) {
      throw new Error('Not enough estimated storage for a separate restored profile. Free space and retry; existing profiles are unchanged.');
    }
  }
  const identifier = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const profile: Profile = { id: `restore-${identifier}`, name: name.trim(), createdAt: Date.now() };
  const target = new HuskyNoteDatabase(profileDatabaseName(profile.id));
  try {
    // These are JSON-only records until binary decoding below; no structuredClone dependency on older WebKit.
    const tables: Tables = JSON.parse(JSON.stringify(data.tables));
    // Binary decoding stays outside the IndexedDB transaction to avoid auto-commit.
    for (const table of ['blobs', 'audioChunks', 'speechJobs']) for (const record of tables[table]) {
      const blob = data.assets.get(record.asset)!; delete record.asset;
      if (table === 'speechJobs') {
        const view = new DataView(await blob.arrayBuffer()); const audio = new Float32Array(view.byteLength / 4);
        for (let i = 0; i < audio.length; i++) {
          audio[i] = view.getFloat32(i * 4, true);
          if (!Number.isFinite(audio[i])) throw new Error('Invalid PCM sample.');
        }
        record.audio = audio;
      } else record.data = blob;
    }
    tables.settings = [{ ...DEFAULT_SETTINGS, ...safeSettings(tables.settings[0]) }];
    await target.transaction('rw', target.tables, async () => {
      for (const table of names) if (tables[table].length) await target.table(table).bulkAdd(tables[table]);
    });
    registerRestoredProfile(profile);
    return profile;
  } catch (error) {
    // Only the unique database created by this invocation is removed; never the active profile.
    await target.delete();
    throw error;
  } finally { target.close(); }
}
