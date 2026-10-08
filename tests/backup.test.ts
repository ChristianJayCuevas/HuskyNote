import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, HuskyNoteDatabase } from '../src/db';
import { exportBackup, inspectBackup, restoreBackup } from '../src/services/backup/archive';
import { getActiveProfileId, listProfiles, profileDatabaseName } from '../src/services/profiles';

let source: HuskyNoteDatabase;
const store = new Map<string, string>();
const opened: HuskyNoteDatabase[] = [];
beforeEach(async () => {
  store.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  source = new HuskyNoteDatabase(`test-${crypto.randomUUID()}`); opened.push(source);
  await source.notes.put({ id: 'n', title: 'Original', content: 'Salamat', tags: ['work'], versions: [{ id: 'v', timestamp: 1, title: 'Old', content: 'history' }], createdAt: 1, updatedAt: 2 });
  await source.settings.put({ ...DEFAULT_SETTINGS, claudeApiKey: 'secret-key', ollamaBaseUrl: 'https://user:secret@host', speechLanguage: 'fil-PH' });
  await source.blobs.bulkPut([
    { id: 'pdf', data: new Blob(['%PDF-test'], { type: 'application/pdf' }), mimeType: 'application/pdf', createdAt: 1 },
    { id: 'shot', data: new Blob(['pixels'], { type: 'image/png' }), mimeType: 'image/png', createdAt: 1 },
  ]);
  await source.documents.put({ id: 'd', title: 'PDF', fileName: 'test.pdf', fileBlobId: 'pdf', fileSize: 9, pageCount: 1, extractedPages: [{ pageNumber: 1, text: 'PDF' }], createdAt: 1 });
  await source.annotations.put({ id: 'a', documentId: 'd', pageNumber: 1, type: 'note', coords: { x: 1, y: 2, width: 3, height: 4 }, color: 'red', text: 'Keep', createdAt: 1 });
  await source.meetings.put({ id: 'm', title: 'Meeting', audioBlobId: 'audio', startTime: 1, durationSeconds: 2, transcript: [{ id: 'seg', speaker: 'Me', text: 'Hello', timestampSeconds: 0 }], manualNotes: 'notes', timeline: [], screenshots: [], createdAt: 1 });
  await source.audioChunks.put({ id: 'chunk', recordingId: 'audio', sequence: 0, data: new Blob(['audio'], { type: 'audio/webm' }), createdAt: 1 });
  await source.speechJobs.put({ id: 'job', meetingId: 'm', sequence: 0, startSeconds: 0, language: 'fil-PH', speaker: 'Me', engineId: 'whisper-base', audio: new Float32Array([0.25, -0.5]), attempts: 1 });
  await source.manuals.put({ id: 'manual', title: 'Guide', purpose: 'Test', requirements: [], warnings: [], troubleshooting: [], expectedResult: 'Done', version: 1, createdAt: 1, updatedAt: 1, steps: [{ id: 'step', stepNumber: 1, title: 'One', description: 'Click', screenshotBlobId: 'shot' }] });
  await source.templates.put({ id: 't', title: 'Custom', category: 'general', description: '', defaultContent: 'Template', isBuiltin: false });
  await source.schedule.put({ id: 'event', title: 'Follow up', date: '2026-09-30', time: '10:00', durationMin: 30, category: 'meeting', completed: false, createdAt: 1 });
});
afterEach(async () => { vi.restoreAllMocks(); for (const db of opened.splice(0)) await db.delete(); vi.unstubAllGlobals(); });

async function rewrite(blob: Blob, change: (manifest: any) => void) {
  const header = new Uint8Array(await blob.slice(0, 44).arrayBuffer());
  const oldSize = new DataView(header.buffer).getUint32(8, true);
  const manifest = JSON.parse(await blob.slice(44, 44 + oldSize).text()); change(manifest);
  const metadata = new Blob([JSON.stringify(manifest)]);
  new DataView(header.buffer).setUint32(8, metadata.size, true);
  header.set(new Uint8Array(await crypto.subtle.digest('SHA-256', await metadata.arrayBuffer())), 12);
  return new Blob([header, metadata, blob.slice(44 + oldSize)]);
}

describe('portable backup and isolated restore', () => {
  it('round trips files, history, references, partial audio and float32 jobs, excluding credentials', async () => {
    const archive = await exportBackup(source, 'Work');
    expect(await archive.text()).not.toContain('secret');
    const preview = await inspectBackup(archive);
    expect(preview.counts.notes).toBe(1);
    const profile = await restoreBackup(preview, 'Recovered');
    const target = new HuskyNoteDatabase(profileDatabaseName(profile.id)); opened.push(target);
    expect(await target.notes.toArray()).toEqual(await source.notes.toArray());
    for (const table of ['documents', 'annotations', 'meetings', 'manuals', 'templates', 'schedule']) {
      expect(await target.table(table).toArray()).toEqual(await source.table(table).toArray());
    }
    expect(await (await target.blobs.get('pdf'))!.data.text()).toBe('%PDF-test');
    expect(await (await target.audioChunks.get('chunk'))!.data.text()).toBe('audio');
    expect((await target.speechJobs.get('job'))!.audio).toEqual(new Float32Array([0.25, -0.5]));
    expect(await target.settings.get('current')).toMatchObject({ speechLanguage: 'fil-PH', ollamaBaseUrl: DEFAULT_SETTINGS.ollamaBaseUrl });
    expect((await target.settings.get('current'))?.claudeApiKey).toBeUndefined();
    expect(getActiveProfileId()).toBe('default');
    expect((await source.notes.get('n'))?.title).toBe('Original');
  });

  it('rejects truncated and corrupted files before publishing a profile', async () => {
    const archive = await exportBackup(source);
    await expect(inspectBackup(archive.slice(0, archive.size - 1))).rejects.toThrow();
    const bytes = new Uint8Array(await archive.arrayBuffer()); bytes[bytes.length - 1] ^= 255;
    await expect(inspectBackup(new Blob([bytes]))).rejects.toThrow('damaged');
    bytes[45] ^= 255;
    await expect(inspectBackup(new Blob([bytes]))).rejects.toThrow('manifest integrity');
    expect(listProfiles()).toHaveLength(1);
  });

  it.each([
    ['version', (m: any) => { m.version = 999; }],
    ['schema', (m: any) => { m.tables.notes[0].versions = 'wrong'; }],
    ['duplicate', (m: any) => { m.tables.notes.push(m.tables.notes[0]); }],
    ['reference', (m: any) => { m.tables.documents[0].fileBlobId = 'absent'; }],
    ['asset', (m: any) => { m.tables.blobs[0].asset = 'absent'; }],
  ])('rejects invalid %s even with a recomputed manifest hash', async (_label, change) => {
    const archive = await rewrite(await exportBackup(source), change);
    await expect(inspectBackup(archive)).rejects.toThrow();
    expect(listProfiles()).toHaveLength(1);
  });

  it('does not export dangling file references as a complete backup', async () => {
    await source.blobs.delete('pdf');
    await expect(exportBackup(source)).rejects.toThrow('Missing archive reference');
  });

  it('rolls back a failed write and leaves the active database unchanged', async () => {
    const preview = await inspectBackup(await exportBackup(source));
    const transaction = HuskyNoteDatabase.prototype.transaction;
    const spy = vi.spyOn(HuskyNoteDatabase.prototype, 'transaction').mockImplementationOnce(function (this: HuskyNoteDatabase, mode: any, tables: any, scope: any) {
      return (transaction as any).call(this, mode, tables, async () => {
        await scope(); // Fail after writes have executed: the transaction must still roll back.
        throw new Error('Quota exceeded');
      });
    } as any);
    await expect(restoreBackup(preview, 'Failed')).rejects.toThrow('Quota exceeded'); spy.mockRestore();
    expect(listProfiles()).toHaveLength(1);
    expect(await source.notes.count()).toBe(1);
  });

  it('removes the staged database if profile registration fails', async () => {
    const preview = await inspectBackup(await exportBackup(source));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    await expect(restoreBackup(preview, 'Failed')).rejects.toThrow('Storage blocked');
    expect(listProfiles()).toHaveLength(1);
  });

  it('rejects incomplete legacy JSON with an actionable message', async () => {
    await expect(inspectBackup(new Blob([JSON.stringify({ version: '1.1.0', data: { notes: [] }, exportedAt: 'today' })]))).rejects.toThrow('Legacy JSON');
  });
});
