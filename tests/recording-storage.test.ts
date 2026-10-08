import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { deleteRecording, listRecordings } from '../src/services/audio/recording-storage';
import type { Meeting } from '../src/types';

const meeting = (id: string, audioBlobId: string): Meeting => ({
  id, audioBlobId, title: `Meeting ${id}`, startTime: 1000, durationSeconds: 60,
  transcript: [{ id: 's1', timestampSeconds: 0, speaker: 'Host', text: 'Keep this transcript.' }],
  manualNotes: 'Keep these notes.', timeline: [], screenshots: [], createdAt: 1000,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterAll(async () => { await db.delete(); });

describe('recording storage', () => {
  it('lists linked and orphan audio, excludes documents, and reports actual bytes', async () => {
    await db.meetings.put(meeting('m1', 'audio'));
    await db.blobs.bulkPut([
      { id: 'audio', data: new Blob(['sound']), mimeType: 'audio/webm', createdAt: 1000 },
      { id: 'orphan', data: new Blob(['lost']), mimeType: 'audio/mp4', createdAt: 2000 },
      { id: 'pdf', data: new Blob(['pdf']), mimeType: 'application/pdf', createdAt: 3000 },
    ]);
    const entries = await listRecordings();
    expect(entries.map((r) => r.id)).toEqual(['orphan', 'audio']);
    expect(entries[0]).toMatchObject({ title: 'Unlinked recording', size: 4 });
    expect(entries[1]).toMatchObject({ meetingId: 'm1', title: 'Meeting m1', size: 5 });
    expect(entries[1]).not.toHaveProperty('data');
  });

  it('deletes shared audio and clears all links without touching meeting text or other blobs', async () => {
    const first = meeting('m1', 'audio');
    await db.meetings.bulkPut([first, meeting('m2', 'audio')]);
    await db.blobs.bulkPut([
      { id: 'audio', data: new Blob(['sound']), mimeType: 'audio/webm', createdAt: 1 },
      { id: 'keep', data: new Blob(['keep']), mimeType: 'audio/webm', createdAt: 1 },
    ]);
    await deleteRecording('audio');
    expect(await db.blobs.get('audio')).toBeUndefined();
    expect(await db.blobs.get('keep')).toBeDefined();
    const { audioBlobId: _, ...expected } = first;
    expect(await db.meetings.get('m1')).toEqual(expected);
    expect((await db.meetings.get('m2'))?.audioBlobId).toBeUndefined();
    await deleteRecording('audio'); // Repeated deletion is harmless.
  });

  it('rolls back reference removal if deleting the audio fails', async () => {
    await db.meetings.put(meeting('m1', 'audio'));
    await db.blobs.put({ id: 'audio', data: new Blob(['sound']), mimeType: 'audio/webm', createdAt: 1 });
    const fail = () => { throw new Error('Simulated write failure'); };
    db.blobs.hook('deleting', fail);
    try { await expect(deleteRecording('audio')).rejects.toThrow('Simulated write failure'); }
    finally { db.blobs.hook('deleting').unsubscribe(fail); }
    expect((await db.meetings.get('m1'))?.audioBlobId).toBe('audio');
    expect(await db.blobs.get('audio')).toBeDefined();
  });
});
