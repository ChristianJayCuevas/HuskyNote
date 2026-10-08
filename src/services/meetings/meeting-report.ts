import type { Meeting, TranscriptSegment } from '../../types';

// Placeholder overviews saved before summaries recorded whether an AI wrote them
const LEGACY_PLACEHOLDERS = [
  'Local AI not connected',
  'AI analysis could not be parsed',
  'Meeting ended with manual notes.',
];

/** The meeting has something to summarize but no AI-written report */
export function isAiReportMissing(meeting: Pick<Meeting, 'summary' | 'transcript' | 'manualNotes'>): boolean {
  const hasContent = meeting.transcript.length > 0 || Boolean(meeting.manualNotes?.trim());
  if (!hasContent) return false;
  const summary = meeting.summary;
  if (!summary) return true;
  if (summary.aiGenerated !== undefined) return !summary.aiGenerated;
  return LEGACY_PLACEHOLDERS.some((text) => summary.overview.includes(text));
}

/**
 * How long the meeting ran. Meetings stopped from the always-on-top window were
 * saved with a 0:00 duration, so fall back to the start and end times or the
 * last transcript timestamp.
 */
export function meetingDurationSeconds(meeting: Pick<Meeting, 'durationSeconds' | 'startTime' | 'endTime' | 'transcript'>): number {
  const recorded = meeting.durationSeconds || 0;
  const span = meeting.endTime && meeting.endTime > meeting.startTime ? (meeting.endTime - meeting.startTime) / 1000 : 0;
  const lastSpeech = meeting.transcript.reduce((max, s) => Math.max(max, s.timestampSeconds || 0), 0);
  // With real start and end times, trust the clock: an old recorder timer bug
  // counted seconds two or three times, inflating the recorded duration
  if (span > 0) return Math.round(Math.max(span, lastSpeech));
  return Math.round(Math.max(recorded, lastSpeech));
}

export interface TranscriptTurn {
  speaker: string;
  startSeconds: number;
  text: string;
}

/** Joins consecutive phrases from the same speaker into one readable turn */
export function groupTranscriptTurns(transcript: TranscriptSegment[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const seg of transcript) {
    const text = seg.text.trim();
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.text = `${last.text} ${text}`;
    } else {
      turns.push({ speaker: seg.speaker, startSeconds: seg.timestampSeconds, text });
    }
  }
  return turns;
}

/** Reads the topic list an AI returned, tolerating code fences and stray prose */
export function parseTopicList(response: string): string[] {
  const match = response.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('The AI did not return a topic list.');
  const parsed: unknown = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error('The AI did not return a topic list.');
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    // Strip list markers ("- ", "• ", "1. ", "2) ") but not leading numbers like "24-hour"
    const topic = item.trim().replace(/^(?:[-•*]|\d+[.)])\s+/, '').replace(/\.$/, '').trim();
    const key = topic.toLowerCase();
    if (topic && !seen.has(key)) {
      seen.add(key);
      topics.push(topic);
    }
  }
  if (topics.length === 0) throw new Error('The AI returned an empty topic list.');
  return topics;
}
