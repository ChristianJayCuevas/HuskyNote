import { describe, it, expect } from 'vitest';
import { groupTranscriptTurns, isAiReportMissing, meetingDurationSeconds, parseTopicList } from '../src/services/meetings/meeting-report';
import type { MeetingSummary, TranscriptSegment } from '../src/types';

const transcript = [{ id: 's1', timestampSeconds: 0, speaker: 'You', text: 'Mic test.' }] as TranscriptSegment[];
const summary = (extra: Partial<MeetingSummary>): MeetingSummary => ({
  overview: 'Reviewed the release.',
  decisions: [],
  actionItems: [],
  topics: [],
  followUpTasks: [],
  ...extra,
});

describe('isAiReportMissing', () => {
  it('offers a report when the AI never wrote one', () => {
    expect(isAiReportMissing({ transcript, manualNotes: '', summary: undefined })).toBe(true);
    expect(isAiReportMissing({ transcript, manualNotes: '', summary: summary({ aiGenerated: false, aiError: 'No key' }) })).toBe(true);
  });

  it('treats an AI-written report as present, even with no decisions', () => {
    expect(isAiReportMissing({ transcript, manualNotes: '', summary: summary({ aiGenerated: true }) })).toBe(false);
  });

  it('recognizes placeholders saved by older versions', () => {
    const legacy = summary({ overview: 'Meeting recorded with 3 speech segment(s). (Local AI not connected to extract deeper synthesis).' });
    expect(isAiReportMissing({ transcript, manualNotes: '', summary: legacy })).toBe(true);
    expect(isAiReportMissing({ transcript, manualNotes: '', summary: summary({}) })).toBe(false);
  });

  it('has nothing to offer when the meeting has no transcript or notes', () => {
    expect(isAiReportMissing({ transcript: [], manualNotes: '  ', summary: undefined })).toBe(false);
    expect(isAiReportMissing({ transcript: [], manualNotes: 'Follow up with Elena', summary: undefined })).toBe(true);
  });
});

describe('meetingDurationSeconds', () => {
  const base = { startTime: 1_000_000, transcript };
  it('uses the recorded duration when it is set', () => {
    expect(meetingDurationSeconds({ ...base, durationSeconds: 2040 })).toBe(2040);
  });

  it('falls back to the start and end times or the last phrase for meetings saved as 0:00', () => {
    expect(meetingDurationSeconds({ ...base, durationSeconds: 0, endTime: 1_000_000 + 2_049_000 })).toBe(2049);
    const late = [{ id: 's9', timestampSeconds: 2077.4, speaker: 'You', text: 'Bye.' }] as TranscriptSegment[];
    expect(meetingDurationSeconds({ startTime: 0, durationSeconds: 0, transcript: late })).toBe(2077);
  });
});

describe('groupTranscriptTurns', () => {
  it('joins consecutive phrases from the same speaker and keeps the first timestamp', () => {
    const turns = groupTranscriptTurns([
      { id: '1', timestampSeconds: 8, speaker: 'Jack', text: 'Good morning.' },
      { id: '2', timestampSeconds: 9.64, speaker: 'Jack', text: ' Quick overview. ' },
      { id: '3', timestampSeconds: 12, speaker: 'CJ', text: 'Okay.' },
      { id: '4', timestampSeconds: 13, speaker: 'CJ', text: '   ' },
      { id: '5', timestampSeconds: 15, speaker: 'Jack', text: 'Next.' },
    ] as TranscriptSegment[]);
    expect(turns).toEqual([
      { speaker: 'Jack', startSeconds: 8, text: 'Good morning. Quick overview.' },
      { speaker: 'CJ', startSeconds: 12, text: 'Okay.' },
      { speaker: 'Jack', startSeconds: 15, text: 'Next.' },
    ]);
  });
});

describe('parseTopicList', () => {
  it('reads a fenced JSON array, trims bullets and periods, and drops duplicates', () => {
    const reply = 'Here you go:\n```json\n["- 24-hour SLA per stage.", "Billing API 403", "24-hour SLA per stage", 7, ""]\n```';
    expect(parseTopicList(reply)).toEqual(['24-hour SLA per stage', 'Billing API 403']);
  });

  it('rejects replies without a usable list so the old topics are kept', () => {
    expect(() => parseTopicList('Sorry, I cannot help with that.')).toThrow('did not return a topic list');
    expect(() => parseTopicList('[]')).toThrow('empty topic list');
  });
});
