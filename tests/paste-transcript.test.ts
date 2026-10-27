import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { parseTranscriptText } from '../src/services/meetings/transcript-import';
import { addPastedTranscript, importTranscriptText } from '../src/services/meetings/meeting-import';
import type { Meeting } from '../src/types';

const rows = (text: string) => parseTranscriptText(text).map((c) => [c.startSeconds, c.speaker, c.text]);

describe('parseTranscriptText', () => {
  it('keeps "Name: text" speakers and joins unlabeled lines to the speaker above', () => {
    expect(rows('Ana Cruz: Good morning, everyone.\r\nLet\'s start.\n\nJack: Sure.\n')).toEqual([
      [0, 'Ana Cruz', "Good morning, everyone. Let's start."],
      [2, 'Jack', 'Sure.'],
    ]);
  });

  it('keeps leading and bracketed times', () => {
    expect(rows('[00:00:05] Ana: Hello\n00:01:02 Jack: Hi there\nMaria (1:10): Welcome\n[01:00:00]\nAna: Bye')).toEqual([
      [5, 'Ana', 'Hello'],
      [62, 'Jack', 'Hi there'],
      [70, 'Maria', 'Welcome'],
      [3600, 'Ana', 'Bye'],
    ]);
  });

  it('reads text without speakers as Speaker lines placed one after another', () => {
    const cues = parseTranscriptText('We reviewed the exception queue: five files are open.\nThe committee meets at 3:30\nNext steps were agreed.');
    expect(cues.map((c) => c.speaker)).toEqual(['Speaker', 'Speaker', 'Speaker']);
    expect(cues.map((c) => c.text)).toEqual([
      'We reviewed the exception queue: five files are open.',
      'The committee meets at 3:30',
      'Next steps were agreed.',
    ]);
    expect(cues[1].startSeconds).toBeGreaterThan(cues[0].startSeconds);
    expect(cues[2].startSeconds).toBeGreaterThan(cues[1].startSeconds);
  });

  it('reads pasted WebVTT, SRT and Teams panel copies', () => {
    expect(rows('WEBVTT\n\n00:00:03.250 --> 00:00:07.120\n<v Ana Cruz>Good morning.</v>\n')).toEqual([[3.25, 'Ana Cruz', 'Good morning.']]);
    expect(rows('1\n00:00:01,000 --> 00:00:04,000\nJack: Hello\n\n2\n00:00:05,500 --> 00:00:06,000\nBye')).toEqual([
      [1, 'Jack', 'Hello'],
      [5.5, 'Speaker', 'Bye'],
    ]);
    expect(rows('AC\nAna Cruz\n0:03\nGood morning.\nJack Reyes\n0:10\nMorning.')).toEqual([
      [3, 'Ana Cruz', 'Good morning.'],
      [10, 'Jack Reyes', 'Morning.'],
    ]);
  });

  it('returns nothing for blank text', () => {
    expect(parseTranscriptText('  \n\n ')).toEqual([]);
  });
});

const meeting = (id: string, extra: Partial<Meeting> = {}): Meeting => ({
  id, title: 'Recorded', startTime: 1, durationSeconds: 0, createdAt: 1, manualNotes: '',
  transcript: [], timeline: [], screenshots: [], ...extra,
});

describe('saving a pasted transcript', () => {
  beforeEach(async () => { await db.meetings.clear(); });

  it('creates a meeting whose transcript is saved like any other', async () => {
    const id = await importTranscriptText('Ana: Hello\nJack: Hi\nJack: Let\'s begin', { title: ' Weekly sync ', startTime: 1000, manualNotes: 'Agenda' });
    const saved = await db.meetings.get(id);
    expect(saved?.title).toBe('Weekly sync');
    expect(saved?.manualNotes).toBe('Agenda');
    expect(saved?.startTime).toBe(1000);
    expect(saved?.durationSeconds).toBeGreaterThan(0);
    expect(saved?.transcript.map((s) => [s.speaker, s.text])).toEqual([['Ana', 'Hello'], ['Jack', "Hi Let's begin"]]);
    expect(new Set(saved?.transcript.map((s) => s.id)).size).toBe(2);
  });

  it('rejects text with no transcript lines', async () => {
    await expect(importTranscriptText('   ', { title: 'x', startTime: 1 })).rejects.toThrow('No transcript lines');
    expect(await db.meetings.count()).toBe(0);
  });

  it('adds a transcript to a meeting that has none, keeping its other fields', async () => {
    await db.meetings.put(meeting('m1', { audioBlobId: 'blob-1', durationSeconds: 300, manualNotes: 'Notes' }));
    expect(await addPastedTranscript('m1', 'Ana: Hello\nJack: Hi')).toBe(2);
    const saved = await db.meetings.get('m1');
    expect(saved?.transcript.map((s) => [s.speaker, s.text])).toEqual([['Ana', 'Hello'], ['Jack', 'Hi']]);
    expect(saved?.durationSeconds).toBe(300);
    expect(saved?.audioBlobId).toBe('blob-1');
    expect(saved?.manualNotes).toBe('Notes');
  });

  it('never replaces an existing transcript', async () => {
    const transcript = [{ id: 's1', timestampSeconds: 0, speaker: 'You', text: 'Recorded words' }];
    await db.meetings.put(meeting('m2', { transcript }));
    await expect(addPastedTranscript('m2', 'Ana: Hello')).rejects.toThrow('already has a transcript');
    expect((await db.meetings.get('m2'))?.transcript).toEqual(transcript);
  });
});
