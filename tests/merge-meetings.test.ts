import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { buildMergedMeeting, finishInterruptedRecording, isUnfinishedRecording, mergeMeetings, unmergeMeeting } from '../src/services/meetings/merge';
import { meetingDurationSeconds } from '../src/services/meetings/meeting-report';
import type { Meeting } from '../src/types';

const T0 = Date.UTC(2026, 9, 1, 14, 58, 59); // in the past, so recordings are not "still running"
const seg = (id: string, at: number, text: string) => ({ id, timestampSeconds: at, speaker: 'You', text });
const meeting = (id: string, startTime: number, extra: Partial<Meeting> = {}): Meeting => ({
  id, title: 'Meeting Title', startTime, durationSeconds: 0, createdAt: startTime, manualNotes: '',
  transcript: [], timeline: [], screenshots: [], audioBlobId: `audio-${id}`, ...extra,
});

describe('buildMergedMeeting', () => {
  // Three parts of one meeting, cut off twice by page reloads
  const a = meeting('a', T0, { endTime: T0 + 132_000, transcript: [seg('1', 4, 'Hello'), seg('2', 126, 'Let me share')], manualNotes: 'Agenda' });
  const b = meeting('b', T0 + 459_000, { endTime: T0 + 459_000 + 1_584_000, transcript: [seg('1', 0, 'Back again'), seg('2', 1575, 'One more thing')] });
  const c = meeting('c', T0 + 2_364_000, { endTime: T0 + 2_364_000 + 2_773_000, transcript: [seg('1', 10, 'Wrapping up')], manualNotes: 'Follow up' });

  it('joins transcripts in time order with times counted from the first part', () => {
    const merged = buildMergedMeeting([c, a, b], { id: 'm', title: 'Exception desk sync', now: 1 });
    expect(merged.transcript.map((s) => [s.timestampSeconds, s.text])).toEqual([
      [4, 'Hello'], [126, 'Let me share'], [459, 'Back again'], [2034, 'One more thing'], [2374, 'Wrapping up'],
    ]);
    expect(new Set(merged.transcript.map((s) => s.id)).size).toBe(5);
    expect(merged.parts?.map((p) => [p.meetingId, p.offsetSeconds])).toEqual([['a', 0], ['b', 459], ['c', 2364]]);
    expect(merged.startTime).toBe(T0);
    expect(merged.endTime).toBe(T0 + 2_364_000 + 2_773_000);
    expect(merged.manualNotes).toBe('Agenda\n\n---\n\nFollow up');
    expect(merged.summary).toBeUndefined();
  });

  it('notes each gap where nothing was recorded on the timeline', () => {
    const merged = buildMergedMeeting([a, b, c], { id: 'm', title: '', now: 1 });
    const gaps = merged.timeline.filter((t) => t.id.startsWith('gap-'));
    expect(gaps.map((g) => [g.timeFormatted, g.label])).toEqual([
      ['02:12', 'Recording paused for 5 min'],
      ['34:03', 'Recording paused for 5 min'],
    ]);
    expect(merged.title).toBe('Meeting Title');
  });

  it('needs at least two meetings', () => {
    expect(() => buildMergedMeeting([a], { id: 'm', title: 'x', now: 1 })).toThrow('at least two');
  });
});

describe('meetingDurationSeconds', () => {
  it('trusts start and end times over a duration inflated by the old timer bug', () => {
    expect(meetingDurationSeconds(meeting('x', T0, { endTime: T0 + 2_773_000, durationSeconds: 8316 }))).toBe(2773);
  });
});

describe('finishing and merging stored recordings', () => {
  beforeEach(async () => {
    await Promise.all([db.meetings.clear(), db.blobs.clear(), db.audioChunks.clear(), db.speechJobs.clear()]);
  });

  const addChunks = async (recordingId: string, startedAt: number, count: number) => {
    for (let i = 0; i < count; i++) {
      await db.audioChunks.put({ id: `${recordingId}-${i}`, recordingId, sequence: i, data: new Blob([`chunk-${i}`], { type: 'audio/webm' }), createdAt: startedAt + i * 1000 });
    }
  };

  it('finishes an interrupted recording from its saved audio pieces, keeping the pieces', async () => {
    await db.meetings.put(meeting('b', T0, { durationSeconds: 8316, transcript: [seg('1', 30, 'Hi')] }));
    await addChunks('audio-b', T0 + 1000, 120);
    const stored = (await db.meetings.get('b'))!;
    expect(isUnfinishedRecording(stored)).toBe(true);

    const finished = await finishInterruptedRecording('b');
    expect(finished.endTime).toBe(T0 + 120_000);
    expect(finished.durationSeconds).toBe(120);
    const audio = await db.blobs.get('audio-b');
    expect(await audio!.data.text()).toBe(Array.from({ length: 120 }, (_, i) => `chunk-${i}`).join(''));
    expect(await db.audioChunks.where('recordingId').equals('audio-b').count()).toBe(120);
    expect(isUnfinishedRecording((await db.meetings.get('b'))!)).toBe(false);
  });

  it('refuses to finish a recording that saved audio in the last two minutes', async () => {
    await db.meetings.put(meeting('live', Date.now() - 60_000));
    await addChunks('audio-live', Date.now() - 30_000, 3);
    await expect(finishInterruptedRecording('live')).rejects.toThrow('last 2 minutes');
  });

  it('merges recordings into one meeting, hides the originals, and unmerges without losing anything', async () => {
    await db.meetings.put(meeting('a', T0, { transcript: [seg('1', 4, 'Hello')] }));
    await addChunks('audio-a', T0 + 1000, 130);
    await db.meetings.put(meeting('b', T0 + 459_000, { endTime: T0 + 2_043_000, transcript: [seg('1', 0, 'Back again')] }));
    await db.blobs.put({ id: 'audio-b', data: new Blob(['b-audio'], { type: 'audio/webm' }), mimeType: 'audio/webm', createdAt: T0 });

    const mergedId = await mergeMeetings(['b', 'a'], 'Exception desk sync');
    const merged = (await db.meetings.get(mergedId))!;
    expect(merged.title).toBe('Exception desk sync');
    expect(merged.transcript.map((s) => s.text)).toEqual(['Hello', 'Back again']);
    expect(merged.parts?.map((p) => p.audioBlobId)).toEqual(['audio-a', 'audio-b']);
    expect((await db.meetings.get('a'))!.mergedInto).toBe(mergedId);
    expect((await db.meetings.get('a'))!.endTime).toBe(T0 + 130_000);
    expect(await db.blobs.get('audio-a')).toBeTruthy();

    const listed = (await db.meetings.toArray()).filter((m) => !m.mergedInto).map((m) => m.id);
    expect(listed).toEqual([mergedId]);
    await expect(mergeMeetings([mergedId, 'a'], 'again')).rejects.toThrow();

    const restored = await unmergeMeeting(mergedId);
    expect(restored.sort()).toEqual(['a', 'b']);
    expect(await db.meetings.get(mergedId)).toBeUndefined();
    expect((await db.meetings.get('a'))!.mergedInto).toBeUndefined();
    expect(await db.blobs.count()).toBe(2);
  });
});
