/**
 * Supplement HuskyNote's own transcript with the Teams transcript of the same
 * meeting. HuskyNote's lines have good timing but unreliable speaker labels and
 * occasional misheard words; Teams has real speaker names but its own mistakes,
 * and it keeps going when a HuskyNote recording was cut off. The two are lined
 * up by phrases they share, then reconciled a few minutes at a time by the AI.
 */
import type { TranscriptSegment } from '../../types';
import type { ImportedCue } from './transcript-import';

/** Seconds of meeting reconciled per AI request */
export const WINDOW_SECONDS = 180;
/** Phrases this long that appear exactly once in both transcripts anchor the alignment */
const ANCHOR_WORDS = 4;
const SPEAKER_MATCH_SECONDS = 12;

const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);

export interface Alignment {
  /** Add to a Teams time to get the HuskyNote time */
  offsetSeconds: number;
  anchors: number;
}

/** Phrase -> times it starts at (only phrases inside one line are used) */
function phraseTimes(lines: { time: number; text: string }[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const line of lines) {
    const w = words(line.text);
    for (let i = 0; i + ANCHOR_WORDS <= w.length; i++) {
      const key = w.slice(i, i + ANCHOR_WORDS).join(' ');
      const list = map.get(key) ?? [];
      list.push(line.time);
      map.set(key, list);
    }
  }
  return map;
}

/**
 * Find the time offset between the two transcripts from phrases that occur
 * exactly once in each. Returns null when too few phrases match to be sure.
 */
export function alignTranscripts(ours: TranscriptSegment[], teams: ImportedCue[]): Alignment | null {
  const a = phraseTimes(ours.map((s) => ({ time: s.timestampSeconds, text: s.text })));
  const b = phraseTimes(teams.map((c) => ({ time: c.startSeconds, text: c.text })));
  const offsets: number[] = [];
  for (const [key, timesA] of a) {
    const timesB = b.get(key);
    if (timesA.length === 1 && timesB?.length === 1) offsets.push(timesA[0] - timesB[0]);
  }
  if (offsets.length < 3) return null;
  offsets.sort((x, y) => x - y);
  const median = offsets[Math.floor(offsets.length / 2)];
  // Keep the anchors that agree with the median; a few false matches are expected
  const agreeing = offsets.filter((o) => Math.abs(o - median) <= 20);
  if (agreeing.length < 3) return null;
  const mean = agreeing.reduce((sum, o) => sum + o, 0) / agreeing.length;
  return { offsetSeconds: Math.round(mean * 10) / 10, anchors: agreeing.length };
}

export interface SupplementWindow {
  start: number;
  end: number;
  ours: TranscriptSegment[];
  /** Teams lines with times already moved onto HuskyNote's timeline */
  teams: ImportedCue[];
}

/** Split both transcripts into windows of the meeting, each line in exactly one window */
export function buildWindows(ours: TranscriptSegment[], teams: ImportedCue[], offsetSeconds: number, windowSeconds = WINDOW_SECONDS): SupplementWindow[] {
  const shifted = teams.map((c) => ({ ...c, startSeconds: Math.max(0, c.startSeconds + offsetSeconds) }));
  const times = [...ours.map((s) => s.timestampSeconds), ...shifted.map((c) => c.startSeconds)];
  if (!times.length) return [];
  const last = Math.max(...times);
  const windows: SupplementWindow[] = [];
  for (let start = 0; start <= last; start += windowSeconds) {
    const end = start + windowSeconds;
    const inWindow = (t: number) => t >= start && t < end;
    const w = { start, end, ours: ours.filter((s) => inWindow(s.timestampSeconds)), teams: shifted.filter((c) => inWindow(c.startSeconds)) };
    if (w.ours.length || w.teams.length) windows.push(w);
  }
  return windows;
}

/** Without the AI: keep HuskyNote's wording, take speaker names from the nearest Teams line, add Teams-only lines */
export function mergeWithoutAi(window: SupplementWindow): { t: number; speaker: string; text: string; source: 'ours' | 'teams' }[] {
  const lines: { t: number; speaker: string; text: string; source: 'ours' | 'teams' }[] = window.ours.map((s) => {
    let nearest: ImportedCue | null = null;
    for (const c of window.teams) {
      if (Math.abs(c.startSeconds - s.timestampSeconds) <= SPEAKER_MATCH_SECONDS
        && (!nearest || Math.abs(c.startSeconds - s.timestampSeconds) < Math.abs(nearest.startSeconds - s.timestampSeconds))) nearest = c;
    }
    return { t: s.timestampSeconds, speaker: nearest?.speaker ?? s.speaker, text: s.text, source: 'ours' };
  });
  // Teams lines where HuskyNote heard nothing nearby (for example while a recording was cut off)
  for (const c of window.teams) {
    const covered = window.ours.some((s) => Math.abs(s.timestampSeconds - c.startSeconds) <= SPEAKER_MATCH_SECONDS);
    if (!covered) lines.push({ t: c.startSeconds, speaker: c.speaker, text: c.text, source: 'teams' });
  }
  return lines.sort((a, b) => a.t - b.t);
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** The request sent to the AI for one window */
export function buildSupplementPrompt(window: SupplementWindow): string {
  const a = window.ours.map((s) => `[${s.timestampSeconds.toFixed(1)}s ${fmt(s.timestampSeconds)}] ${s.text}`).join('\n');
  const b = window.teams.map((c) => `[${c.startSeconds.toFixed(1)}s ${fmt(c.startSeconds)}] ${c.speaker}: ${c.text}`).join('\n');
  return `You are reconciling two transcripts of the same part of a meeting (${fmt(window.start)} to ${fmt(window.end)}).

TRANSCRIPT A (HuskyNote's speech recognition): good timing, but it sometimes mishears words, and its speaker labels are unreliable so they are omitted.
${a || '(no lines)'}

TRANSCRIPT B (Microsoft Teams): reliable speaker names, but it can also mishear or drop words. Times are already lined up with A.
${b || '(no lines)'}

Write the most accurate transcript of this part of the meeting:
- Use the speaker names from B. For a line only A has, pick the most likely speaker from the surrounding B lines, or use "Speaker".
- For each thing that was said, choose the wording that makes the most sense in context. Where one transcript has words the other missed, keep them. Correct obvious mishearings (names, products, numbers) using the other transcript.
- Never add anything neither transcript supports, never summarize, and keep the language and wording as spoken.
- One entry per speaker turn or sentence, in time order. Use the time from A when both have the line, otherwise the time from B.

Return only a JSON array: [{"t": <seconds>, "speaker": "<name>", "text": "<what was said>"}]`;
}

/** Read the AI's reply; null when it is not a usable list */
export function parseSupplementReply(reply: string, window: SupplementWindow): { t: number; speaker: string; text: string }[] | null {
  const match = reply.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const lines: { t: number; speaker: string; text: string }[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const { t, speaker, text } = item as { t?: unknown; speaker?: unknown; text?: unknown };
    if (typeof text !== 'string' || !text.trim()) continue;
    const time = typeof t === 'number' && Number.isFinite(t) ? t : Number(t);
    lines.push({
      // Keep the AI from moving lines outside the window it was given
      t: Number.isFinite(time) ? Math.min(window.end - 0.1, Math.max(window.start, time)) : window.start,
      speaker: typeof speaker === 'string' && speaker.trim() ? speaker.trim() : 'Speaker',
      text: text.trim(),
    });
  }
  // An empty or wildly shorter answer means the model gave up; fall back for this window
  const sourceWords = Math.max(window.ours.reduce((n, s) => n + words(s.text).length, 0), window.teams.reduce((n, c) => n + words(c.text).length, 0));
  const replyWords = lines.reduce((n, l) => n + words(l.text).length, 0);
  if (!lines.length || (sourceWords > 30 && replyWords < sourceWords * 0.5)) return null;
  return lines.sort((x, y) => x.t - y.t);
}

export interface SupplementResult {
  transcript: TranscriptSegment[];
  windows: number;
  aiWindows: number;
  fallbackWindows: number;
  addedFromTeams: number;
}

/**
 * Reconcile every window. `generate` sends a prompt to the AI; pass null to
 * only take speaker names from Teams and fill gaps (no AI needed).
 */
export async function supplementTranscript(
  ours: TranscriptSegment[],
  teams: ImportedCue[],
  offsetSeconds: number,
  generate: ((prompt: string) => Promise<string>) | null,
  options: { idPrefix: string; onProgress?: (done: number, total: number) => void; signal?: AbortSignal; concurrency?: number }
): Promise<SupplementResult> {
  const windows = buildWindows(ours, teams, offsetSeconds);
  const results: { t: number; speaker: string; text: string; source?: string }[][] = new Array(windows.length);
  let aiWindows = 0;
  let fallbackWindows = 0;
  let done = 0;
  let next = 0;

  const work = async () => {
    while (next < windows.length) {
      if (options.signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
      const index = next++;
      const window = windows[index];
      // Only one side has lines here: nothing to reconcile
      if (!generate || !window.ours.length || !window.teams.length) {
        results[index] = mergeWithoutAi(window);
      } else {
        let lines: { t: number; speaker: string; text: string }[] | null = null;
        try { lines = parseSupplementReply(await generate(buildSupplementPrompt(window)), window); } catch { lines = null; }
        if (lines) { results[index] = lines; aiWindows++; }
        else { results[index] = mergeWithoutAi(window); fallbackWindows++; }
      }
      options.onProgress?.(++done, windows.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 2, windows.length)) }, work));

  const addedFromTeams = results.flat().filter((l) => l.source === 'teams').length;
  const transcript = results.flat().map((l, i) => ({
    id: `${options.idPrefix}-${i}`,
    timestampSeconds: Math.round(l.t * 100) / 100,
    speaker: l.speaker,
    text: l.text,
  }));
  return { transcript, windows: windows.length, aiWindows, fallbackWindows, addedFromTeams };
}
