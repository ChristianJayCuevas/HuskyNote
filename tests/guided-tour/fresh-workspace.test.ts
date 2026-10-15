import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, initializeDatabase } from '../../src/db';
import { isWorkspaceEmpty } from '../../src/features/guided-tour/lib/fresh-workspace';

describe('isWorkspaceEmpty: whether the first-run tour may start on its own', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  afterAll(async () => {
    await db.delete();
  });

  it('is true for a brand-new workspace, including the built-in templates and default settings', async () => {
    await initializeDatabase();
    expect(await db.templates.count()).toBeGreaterThan(0);
    expect(await isWorkspaceEmpty()).toBe(true);
  });

  it.each([
    ['a note', () => db.notes.put({ id: 'n1', title: 'Hi', content: '', createdAt: 1, updatedAt: 1, tags: [] } as never)],
    [
      'a meeting',
      () =>
        db.meetings.put({
          id: 'm1',
          title: 'Sync',
          createdAt: 1,
          startTime: 1,
          durationSeconds: 0,
          transcript: [],
          manualNotes: '',
          timeline: [],
          screenshots: [],
        } as never),
    ],
    ['a document', () => db.documents.put({ id: 'd1', title: 'Doc', fileName: 'a.pdf', createdAt: 1 } as never)],
    ['a manual', () => db.manuals.put({ id: 'x1', title: 'Manual', createdAt: 1, updatedAt: 1 } as never)],
    ['a schedule item', () => db.schedule.put({ id: 's1', title: 'Call', date: '2026-10-15', createdAt: 1 } as never)],
  ])('is false once the workspace has %s', async (_, add) => {
    await add();
    expect(await isWorkspaceEmpty()).toBe(false);
  });
});
