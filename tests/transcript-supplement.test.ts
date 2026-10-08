import { describe, expect, it } from 'vitest';
import {
  alignTranscripts, buildSupplementPrompt, buildWindows, mergeWithoutAi, parseSupplementReply, supplementTranscript,
} from '../src/services/meetings/transcript-supplement';
import type { ImportedCue } from '../src/services/meetings/transcript-import';
import type { TranscriptSegment } from '../src/types';

const ours = (t: number, text: string, speaker = 'Compass In'): TranscriptSegment => ({ id: `o${t}`, timestampSeconds: t, speaker, text });
const teams = (t: number, speaker: string, text: string): ImportedCue => ({ startSeconds: t, speaker, text });

// HuskyNote started recording 30 s after Teams did, and misheard a few words
const OURS = [
  ours(5, 'so in and compass on the non QM three point oh screen there is a section for exceptions'),
  ours(40, 'the committee approved the new escalation process for every stage owner'),
  ours(70, 'each stage owner has twenty four hours to decide or pass it forward'),
  ours(400, 'jack will raise that question at the committee meeting tomorrow afternoon'),
];
const TEAMS = [
  teams(35, 'Ana Cruz', 'So in the CRM on the onboarding 3.0 screen there is a section for exceptions.'),
  teams(70, 'Ana Cruz', 'The committee approved the new escalation process for every stage owner.'),
  teams(100, 'Jack Reyes', 'Each stage owner has 24 hours to decide or pass it forward.'),
  teams(250, 'Jack Reyes', 'While the recording was off we agreed to ship on Friday.'),
  teams(430, 'Jack Reyes', 'Jack will raise that question at the committee meeting tomorrow afternoon.'),
];

describe('alignTranscripts', () => {
  it('finds the offset between the two transcripts from shared phrases', () => {
    const alignment = alignTranscripts(OURS, TEAMS);
    expect(alignment?.offsetSeconds).toBe(-30);
    expect(alignment!.anchors).toBeGreaterThanOrEqual(3);
  });

  it('gives up when the transcripts have too little in common', () => {
    expect(alignTranscripts(OURS, [teams(1, 'X', 'completely different words about lunch plans today')])).toBeNull();
  });
});

describe('buildWindows and mergeWithoutAi', () => {
  it('puts each line in one window on HuskyNote\'s timeline', () => {
    const windows = buildWindows(OURS, TEAMS, -30, 180);
    expect(windows.map((w) => [w.start, w.ours.length, w.teams.length])).toEqual([[0, 3, 3], [180, 0, 1], [360, 1, 1]]);
    expect(windows[1].teams[0].startSeconds).toBe(220);
  });

  it('takes speaker names from Teams and fills in what HuskyNote missed', () => {
    const [first, gap] = buildWindows(OURS, TEAMS, -30, 180);
    expect(mergeWithoutAi(first).map((l) => [l.t, l.speaker, l.source])).toEqual([[5, 'Ana Cruz', 'ours'], [40, 'Ana Cruz', 'ours'], [70, 'Jack Reyes', 'ours']]);
    expect(mergeWithoutAi(gap)).toEqual([{ t: 220, speaker: 'Jack Reyes', text: 'While the recording was off we agreed to ship on Friday.', source: 'teams' }]);
  });
});

describe('parseSupplementReply', () => {
  const [window] = buildWindows(OURS, TEAMS, -30, 180);

  it('reads the AI answer and keeps lines inside the window', () => {
    const reply = 'Here you go:\n```json\n[{"t": 5, "speaker": "Ana Cruz", "text": "So in the CRM on the onboarding 3.0 screen there is a section for exceptions."},'
      + '{"t": 999, "speaker": "Ana Cruz", "text": "The committee approved the new escalation process for every stage owner."},'
      + '{"t": "70", "speaker": "", "text": "Each stage owner has 24 hours to decide or pass it forward."}]\n```';
    const lines = parseSupplementReply(reply, window)!;
    expect(lines.map((l) => [l.t, l.speaker])).toEqual([[5, 'Ana Cruz'], [70, 'Speaker'], [179.9, 'Ana Cruz']]);
  });

  it('rejects answers that are not a list or drop most of what was said', () => {
    expect(parseSupplementReply('I cannot help with that.', window)).toBeNull();
    expect(parseSupplementReply('[{"t": 5, "speaker": "Ana", "text": "Hello."}]', window)).toBeNull();
  });

  it('sends both transcripts, with Teams speaker names, in the prompt', () => {
    const prompt = buildSupplementPrompt(window);
    expect(prompt).toContain('TRANSCRIPT A');
    expect(prompt).toContain('Jack Reyes: Each stage owner has 24 hours');
    expect(prompt).not.toContain('Compass In');
  });
});

describe('supplementTranscript', () => {
  it('uses the AI where both have lines, falls back when its answer is unusable, and fills gaps from Teams', async () => {
    const calls: string[] = [];
    const generate = async (prompt: string) => {
      calls.push(prompt);
      if (prompt.includes('Jack will raise')) return 'not json';
      return JSON.stringify([
        { t: 5, speaker: 'Ana Cruz', text: 'So in the CRM on the onboarding 3.0 screen there is a section for exceptions.' },
        { t: 40, speaker: 'Ana Cruz', text: 'The committee approved the new escalation process for every stage owner.' },
        { t: 70, speaker: 'Jack Reyes', text: 'Each stage owner has 24 hours to decide or pass it forward.' },
      ]);
    };
    const progress: string[] = [];
    const result = await supplementTranscript(OURS, TEAMS, -30, generate, { idPrefix: 's', onProgress: (d, t) => progress.push(`${d}/${t}`) });
    expect(calls).toHaveLength(2);
    expect(result).toMatchObject({ windows: 3, aiWindows: 1, fallbackWindows: 1, addedFromTeams: 1 });
    expect(result.transcript.map((s) => [s.timestampSeconds, s.speaker])).toEqual([
      [5, 'Ana Cruz'], [40, 'Ana Cruz'], [70, 'Jack Reyes'], [220, 'Jack Reyes'], [400, 'Jack Reyes'],
    ]);
    expect(result.transcript[0].text).toContain('CRM');
    expect(progress.at(-1)).toBe('3/3');
  });

  it('works without the AI: speaker names and gaps only', async () => {
    const result = await supplementTranscript(OURS, TEAMS, -30, null, { idPrefix: 's' });
    expect(result.aiWindows).toBe(0);
    expect(result.transcript.map((s) => s.speaker)).toEqual(['Ana Cruz', 'Ana Cruz', 'Jack Reyes', 'Jack Reyes', 'Jack Reyes']);
    expect(result.transcript[0].text).toBe(OURS[0].text);
  });
});
