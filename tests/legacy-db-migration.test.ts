import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db';
import { migrateLegacyData, migrateLegacyDatabase } from '../src/services/legacy-migration';

/**
 * A DomoNote database exactly as DomoNote v1.0.3 (the last upstream release) created it:
 * the schema from `git show v1.0.3:src/db/index.ts`, versions 1 and 2.
 */
function openDomoNoteV103(): Dexie {
  const legacy = new Dexie('DomoNoteDB');
  legacy.version(1).stores({
    notes: 'id, title, folderId, createdAt, updatedAt, *tags',
    meetings: 'id, title, startTime, createdAt',
    documents: 'id, title, fileName, createdAt',
    annotations: 'id, documentId, pageNumber, createdAt',
    operationSessions: 'id, title, recordedAt',
    manuals: 'id, title, createdAt, updatedAt',
    templates: 'id, title, category, isBuiltin',
    settings: 'id',
    blobs: 'id, mimeType, createdAt',
  });
  legacy.version(2).stores({
    schedule: 'id, date, time, category, completed, createdAt',
  });
  return legacy;
}

/** One record per DomoNote table, shaped like DomoNote v1.0.3 saved them */
const DOMONOTE_DATA: Record<string, Record<string, unknown>[]> = {
  notes: [
    { id: 'note-1', title: 'Q4 planning', content: '# Goals', folderId: null, createdAt: 1, updatedAt: 2, tags: ['work', 'plan'] },
    { id: 'note-2', title: 'Groceries', content: '- eggs', folderId: null, createdAt: 3, updatedAt: 4, tags: [] },
  ],
  meetings: [
    {
      id: 'meeting-1',
      title: 'Weekly sync',
      startTime: 10,
      createdAt: 10,
      durationSeconds: 1800,
      audioBlobId: 'blob-1',
      transcript: [{ id: 's1', timestampSeconds: 1, speaker: 'You / Host', text: 'Hello everyone.' }],
      manualNotes: 'Action: send the deck',
      timeline: [],
      screenshots: [],
    },
  ],
  documents: [{ id: 'doc-1', title: 'Policy', fileName: 'policy.pdf', createdAt: 5, blobId: 'blob-2' }],
  annotations: [{ id: 'ann-1', documentId: 'doc-1', pageNumber: 2, createdAt: 6, text: 'Check this' }],
  operationSessions: [{ id: 'op-1', title: 'Expense report walkthrough', recordedAt: 7, steps: [] }],
  manuals: [{ id: 'manual-1', title: 'How to file expenses', createdAt: 8, updatedAt: 9, steps: [] }],
  templates: [{ id: 'template-custom', title: 'My 1:1', category: 'meeting', isBuiltin: false, content: '## Wins' }],
  settings: [{ id: 'current', ollamaBaseUrl: 'http://localhost:11434', selectedModel: 'llama3', companionUrl: 'http://localhost:8765', theme: 'light', autoSaveIntervalSeconds: 3, speechLanguage: 'auto' }],
  blobs: [
    { id: 'blob-1', mimeType: 'audio/webm', createdAt: 10, data: new Uint8Array([1, 2, 3]).buffer },
    { id: 'blob-2', mimeType: 'application/pdf', createdAt: 5, data: new Uint8Array([4, 5]).buffer },
  ],
  schedule: [{ id: 'event-1', title: 'Dentist', date: '2026-10-20', time: '09:00', category: 'personal', completed: false, createdAt: 11 }],
};

async function seedDomoNote() {
  const legacy = openDomoNoteV103();
  await legacy.open();
  for (const [table, rows] of Object.entries(DOMONOTE_DATA)) await legacy.table(table).bulkPut(rows);
  legacy.close();
}

async function readAll(database: Dexie, table: string) {
  return database.table(table).orderBy(':id').toArray();
}

describe('moving a DomoNote v1.0.3 database into HuskyNote', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await Dexie.delete('DomoNoteDB');
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await Dexie.delete('DomoNoteDB');
  });

  it('copies every DomoNote table, record for record', async () => {
    await seedDomoNote();
    await migrateLegacyDatabase();
    for (const [table, rows] of Object.entries(DOMONOTE_DATA)) {
      expect([table, await readAll(db, table)]).toEqual([table, [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)))]);
    }
  });

  it('leaves the DomoNote database in place, so an older build still opens it', async () => {
    await seedDomoNote();
    await migrateLegacyDatabase();
    const legacy = openDomoNoteV103();
    await legacy.open();
    expect(await legacy.table('notes').count()).toBe(2);
    expect(await legacy.table('meetings').count()).toBe(1);
    legacy.close();
  });

  it("keeps HuskyNote's own records and tables, and can run twice without duplicates", async () => {
    await db.notes.put({ id: 'husky-note', title: 'Made in HuskyNote', content: '', createdAt: 20, updatedAt: 20, tags: [] } as never);
    await seedDomoNote();
    await migrateLegacyDatabase();
    await migrateLegacyDatabase();
    expect(await db.notes.count()).toBe(3);
    expect(await db.meetings.count()).toBe(1);
    // Tables DomoNote never had are untouched
    expect(await db.speechJobs.count()).toBe(0);
    expect(await db.audioChunks.count()).toBe(0);
  });

  it("leaves the moved data usable through HuskyNote's indexes", async () => {
    await seedDomoNote();
    await migrateLegacyDatabase();
    expect((await db.notes.where('tags').equals('work').toArray()).map((n) => n.id)).toEqual(['note-1']);
    expect((await db.meetings.orderBy('startTime').toArray()).map((m) => m.id)).toEqual(['meeting-1']);
    expect((await db.schedule.where('date').equals('2026-10-20').toArray()).map((e) => e.id)).toEqual(['event-1']);
    expect((await db.settings.get('current'))?.selectedModel).toBe('llama3');
  });

  it('does nothing when there is no DomoNote database', async () => {
    await migrateLegacyDatabase();
    expect(await db.notes.count()).toBe(0);
  });

  it('runs once on first start (database and saved preferences), then never again', async () => {
    const store = new Map<string, string>([['domonote_theme', 'light']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    });
    await seedDomoNote();
    await migrateLegacyData();
    expect(await db.notes.count()).toBe(2);
    expect(store.get('huskynote_theme')).toBe('light');
    expect(store.get('huskynote_legacy_migrated')).toBe('true');

    // A note deleted in HuskyNote afterwards must not come back on the next start
    await db.notes.delete('note-2');
    await migrateLegacyData();
    expect(await db.notes.count()).toBe(1);
  });
});
