import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { collectOpenActionItems, setActionItemDone } from '../src/services/meetings/action-items';
import type { Meeting } from '../src/types';

const meeting = (id: string, startTime: number, actionItems: NonNullable<Meeting['summary']>['actionItems']): Meeting => ({
  id,
  title: `Meeting ${id}`,
  startTime,
  durationSeconds: 600,
  createdAt: startTime,
  manualNotes: '',
  transcript: [],
  timeline: [],
  screenshots: [],
  summary: { overview: 'Sync', decisions: [], actionItems, topics: [], followUpTasks: [], aiGenerated: true },
});

describe('collectOpenActionItems', () => {
  it('lists open items from the newest meeting first and keeps each item\'s position', () => {
    const items = collectOpenActionItems([
      meeting('old', 1000, [{ task: 'Send the deck', owner: 'Ana' }]),
      meeting('new', 2000, [{ task: 'Done already', done: true }, { task: 'Join the committee meeting', owner: 'Jack' }, { task: '  ' }]),
    ]);
    expect(items.map((i) => [i.meetingId, i.index, i.task])).toEqual([
      ['new', 1, 'Join the committee meeting'],
      ['old', 0, 'Send the deck'],
    ]);
  });

  it('ignores meetings without a report', () => {
    expect(collectOpenActionItems([{ ...meeting('x', 1, []), summary: undefined }])).toEqual([]);
  });
});

describe('setActionItemDone', () => {
  beforeEach(async () => {
    await db.meetings.clear();
  });

  it('saves the done state on the meeting without touching other items', async () => {
    await db.meetings.put(meeting('m', 1, [{ task: 'A' }, { task: 'B', owner: 'CJ' }]));
    await setActionItemDone('m', 1, true);
    const saved = await db.meetings.get('m');
    expect(saved?.summary?.actionItems).toEqual([{ task: 'A' }, { task: 'B', owner: 'CJ', done: true }]);
    await setActionItemDone('m', 1, false);
    expect((await db.meetings.get('m'))?.summary?.actionItems[1].done).toBe(false);
  });

  it('does nothing for a missing meeting or item', async () => {
    await expect(setActionItemDone('missing', 0, true)).resolves.toBeUndefined();
    await db.meetings.put(meeting('m', 1, [{ task: 'A' }]));
    await setActionItemDone('m', 5, true);
    expect((await db.meetings.get('m'))?.summary?.actionItems).toEqual([{ task: 'A' }]);
  });
});
