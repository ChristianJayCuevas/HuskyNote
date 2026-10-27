import type { TranscriptSegment } from '../../types';

/** One spoken line from an imported transcript */
export interface ImportedCue {
  startSeconds: number;
  speaker: string;
  text: string;
}

const UNKNOWN_SPEAKER = 'Speaker';

/** "01:02:03.450", "02:03.450", "0:0:3.25" or "1:05" -> seconds */
export function parseTimestamp(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d+))?$/);
  if (!match) return null;
  const [, h, m, s, frac] = match;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + (frac ? Number(`0.${frac}`) : 0);
}

const cleanText = (text: string) => text
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Parse a WebVTT transcript. Teams writes the speaker as a voice tag
 * (`<v Ana Cruz>Hello</v>`); Zoom and others write "Ana Cruz: Hello".
 */
export function parseVtt(text: string): ImportedCue[] {
  const cues: ImportedCue[] = [];
  const blocks = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex < 0) continue;
    const start = parseTimestamp(lines[timingIndex].split('-->')[0]);
    if (start === null) continue;
    const body = lines.slice(timingIndex + 1).join(' ');
    if (!body) continue;
    let speaker = UNKNOWN_SPEAKER;
    const voice = body.match(/<v(?:\.[^\s>]+)?\s+([^>]+)>/);
    let spoken = body;
    if (voice) speaker = voice[1].trim();
    else {
      const prefixed = body.match(/^([^:<>]{1,60}):\s+(.+)$/);
      if (prefixed && !/^\d/.test(prefixed[1])) { speaker = prefixed[1].trim(); spoken = prefixed[2]; }
    }
    const clean = stripSpokenTimeLabel(cleanText(spoken), speaker);
    if (clean) cues.push({ startSeconds: start, speaker, text: clean });
  }
  return cues.sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * Parse the paragraphs of a Teams transcript .docx. Teams writes a header
 * line ("Ana Cruz   0:03" or "0:00:03.250 --> 0:00:07.120") before each turn.
 */
export function parseTeamsDocxParagraphs(paragraphs: string[]): ImportedCue[] {
  const cues: ImportedCue[] = [];
  let current: ImportedCue | null = null;
  const flush = () => {
    const text = current ? stripSpokenTimeLabel(cleanText(current.text), current.speaker) : '';
    if (current && text) cues.push({ ...current, text });
    current = null;
  };
  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i].replace(/\s+/g, ' ').trim();
    if (!line) continue;
    // "Ana Cruz 0:03" or "Ana Cruz 1:02:03"
    const named = line.match(/^(.{1,80}?)[\s·•|–-]+(\d{1,2}:\d{2}(?::\d{2})?)$/);
    // "0:00:03.250 --> 0:00:07.120" followed by the speaker line
    const timed = line.match(/^(\d{1,2}:\d{1,2}:\d{1,2}(?:[.,]\d+)?)\s*-->/);
    if (named && !/[.!?]$/.test(named[1])) {
      flush();
      current = { startSeconds: parseTimestamp(named[2]) ?? 0, speaker: named[1].replace(/[\s·•|–-]+$/, '').trim(), text: '' };
    } else if (timed) {
      flush();
      const speaker = (paragraphs[i + 1] ?? '').trim();
      current = { startSeconds: parseTimestamp(timed[1]) ?? 0, speaker: speaker || UNKNOWN_SPEAKER, text: '' };
      i++;
    } else if (current) {
      current.text += ` ${line}`;
    }
  }
  flush();
  return cues;
}

const TIME_ONLY = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** The time read out for screen readers, which Teams copies too: "5 minutes 36 seconds", "1 hour 2 minutes" */
export const SPOKEN_TIME = /^(?=.*\d)(?:\d+ hours? ?)?(?:\d+ minutes? ?)?(?:\d+ seconds?)?$/i;

/**
 * Remove the screen-reader label Teams can copy in front of a line's words:
 * "Marco Reyes 5 minutes 36 seconds Mhm." -> "Mhm." Only removed when it
 * starts with the line's own speaker name, so real speech is never cut.
 */
export function stripSpokenTimeLabel(text: string, speaker: string): string {
  const name = speaker.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!name) return text;
  const label = text.match(new RegExp(`^${name}\\s+(?:\\d+\\s+(?:hours?|minutes?|seconds?)(?:\\s+|$)){1,3}`, 'i'));
  return label ? text.slice(label[0].length) : text;
}
/** Teams status lines that are not speech */
const NOT_SPEECH = /\b(started|stopped) transcription\b|^transcript$|^(show|hide) (transcript|speakers)$/i;

/**
 * Parse text copied from the Teams transcript panel. Teams copies each entry
 * as a name line, a time line and the words ("Ana Cruz" / "0:03" / "Hello"),
 * or as "Ana Cruz 0:03" then the words. Pasted WebVTT also works. Words before
 * the first name (the cut-off end of an entry above the selection) are skipped.
 */
export function parsePastedTranscript(text: string): ImportedCue[] {
  const raw = text.replace(/\r\n?/g, '\n');
  if (/^﻿?WEBVTT/.test(raw.trimStart())) return parseVtt(raw);
  const lines = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !NOT_SPEECH.test(l) && !SPOKEN_TIME.test(l));
  const joined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1];
    // Avatar initials ("AC") copied just before a speaker's name and time
    if (/^[A-Z]{1,3}$/.test(lines[i]) && next && TIME_ONLY.test(lines[i + 2] ?? '')) continue;
    if (next && TIME_ONLY.test(next) && !TIME_ONLY.test(lines[i]) && lines[i].length <= 80 && !/[.!?]$/.test(lines[i])) {
      joined.push(`${lines[i]} ${next}`);
      i++;
    } else if (TIME_ONLY.test(lines[i])) {
      joined.push(`Speaker ${lines[i]}`);
    } else {
      joined.push(lines[i]);
    }
  }
  return parseTeamsDocxParagraphs(joined);
}

const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?`;
/** "[00:01:02] ", "(0:03) - ", a bare "00:01:02 " before a speaker label, or a time on its own line */
const LEADING_TIME = new RegExp(`^(?:[[(](${TIME})[\\])]|(${TIME})(?=\\s+[^:]{1,60}:(?:\\s|$)|$))\\s*(?:[-–|]\\s*)?`);
/** "Ana Cruz: Hello", "Ana Cruz (0:03): Hello", "Ana Cruz [00:00:03]:" */
const SPEAKER_LABEL = new RegExp(`^([^\\s\\d:[(][^:!?,;]{0,59}?)\\s*(?:[[(](${TIME})[\\])])?\\s*:(?:\\s+(.*))?$`);
/** Seconds a line takes to say, at about 150 words a minute */
const spokenSeconds = (text: string) => Math.max(1, Math.round(text.split(' ').length / 2.5));

function readTextLine(line: string) {
  const lead = line.match(LEADING_TIME);
  const leadTime = lead ? parseTimestamp(lead[1] ?? lead[2]) : null;
  const rest = lead ? line.slice(lead[0].length) : line;
  const label = rest.match(SPEAKER_LABEL);
  const speaker = label && label[1].trim().split(' ').length <= 4 ? label[1].trim() : null;
  return { leadTime, rest, label: speaker ? { speaker, time: label?.[2] ? parseTimestamp(label[2]) : null, text: label?.[3] ?? '' } : null };
}

/**
 * Parse a transcript pasted as text from any app. WebVTT/SRT and Teams panel
 * copies are read as those. Otherwise "Ana: Hello" lines keep their speaker
 * (when enough lines have one, so a colon in a sentence is not a name), lines
 * without one continue the speaker above, and a leading "[00:01:02]" keeps its
 * time; lines without a time are placed after the one before.
 */
export function parseTranscriptText(text: string): ImportedCue[] {
  const raw = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  if (/^WEBVTT/.test(raw) || /^\S.*-->/m.test(raw)) {
    const cues = parseVtt(raw);
    if (cues.length) return cues;
  }
  const lines = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const read = lines.map(readTextLine);
  const labeled = read.filter((l) => l.label).length;
  const useLabels = labeled > 0 && labeled >= lines.length * 0.3;
  if (!useLabels) {
    // A Teams panel copy ("Ana Cruz" / "0:03" / "Hello"), only when it starts at the top so nothing above is dropped
    const teams = parsePastedTranscript(raw);
    const first = lines.find((l) => !/^[A-Z]{1,3}$/.test(l) && !NOT_SPEECH.test(l));
    if (teams.length && first?.startsWith(teams[0].speaker)) return teams;
  }

  const cues: ImportedCue[] = [];
  let pendingTime: number | null = null;
  let nextStart = 0;
  for (const { leadTime, rest, label } of read) {
    const spoken = useLabels ? label : null;
    const words = spoken ? spoken.text : rest;
    const time: number | null = spoken?.time ?? leadTime ?? pendingTime;
    // A time on its own line belongs to the line after it
    if (!words && !spoken) { pendingTime = time; continue; }
    pendingTime = null;
    const last = cues[cues.length - 1];
    if (useLabels && !spoken && last && time === null) last.text = last.text ? `${last.text} ${words}` : words;
    else cues.push({ startSeconds: time ?? nextStart, speaker: spoken?.speaker ?? (useLabels && last ? last.speaker : UNKNOWN_SPEAKER), text: words });
    const current = cues[cues.length - 1];
    nextStart = current.startSeconds + spokenSeconds(current.text);
  }
  return cues.filter((c) => c.text);
}

/**
 * Add newly pasted lines to those collected so far. Pieces may overlap: a line
 * pasted twice (same speaker and time) is kept once, in its longest form.
 */
export function stitchCues(existing: ImportedCue[], added: ImportedCue[]): ImportedCue[] {
  const byKey = new Map<string, ImportedCue>();
  for (const cue of [...existing, ...added]) {
    const key = `${cue.speaker.toLowerCase()}|${Math.round(cue.startSeconds)}`;
    const previous = byKey.get(key);
    if (!previous || cue.text.length > previous.text.length) byKey.set(key, cue);
  }
  return [...byKey.values()].sort((a, b) => a.startSeconds - b.startSeconds);
}

/**
 * Join consecutive lines from the same speaker into one turn (up to maxChars),
 * so a transcript of short Teams captions reads as speaker turns. Lines more
 * than maxGapSeconds apart stay separate, even from the same speaker.
 */
export function mergeCues(cues: ImportedCue[], maxChars = 600, maxGapSeconds = 15): ImportedCue[] {
  const merged: ImportedCue[] = [];
  let lastStart = -Infinity;
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === cue.speaker && cue.startSeconds - lastStart <= maxGapSeconds && last.text.length + cue.text.length < maxChars) {
      last.text = `${last.text} ${cue.text}`;
    } else merged.push({ ...cue });
    lastStart = cue.startSeconds;
  }
  return merged;
}

/** Imported cues as meeting transcript segments */
export function cuesToSegments(cues: ImportedCue[], idPrefix: string): TranscriptSegment[] {
  return cues.map((cue, i) => ({ id: `${idPrefix}-${i}`, timestampSeconds: cue.startSeconds, speaker: cue.speaker, text: cue.text }));
}

/** Kinds of file the import dialog accepts */
export type ImportKind = 'transcript-vtt' | 'transcript-docx' | 'recording' | 'unsupported';

export function importKindOf(file: { name: string; type?: string }): ImportKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.vtt')) return 'transcript-vtt';
  if (name.endsWith('.docx')) return 'transcript-docx';
  if (/\.(mp4|m4a|m4v|mov|mp3|wav|webm|ogg|oga|opus|aac|flac|3gp)$/.test(name)) return 'recording';
  if (file.type?.startsWith('audio/') || file.type?.startsWith('video/')) return 'recording';
  return 'unsupported';
}
