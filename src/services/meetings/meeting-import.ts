import { db } from '../../db';
import type { Meeting, TranscriptSegment } from '../../types';
import { decodeMediaFile } from '../audio/media-decode';
import { activeRecordingIds } from '../audio/recorder';
import { isNonSpeech, speechEngine, toWhisperLanguage } from '../audio/speech-engine';
import { normalizeSpeech } from '../audio/speech-dsp';
import { resolveTranscriptionEngine } from '../audio/transcription-engines';
import { WHISPER_SAMPLE_RATE } from '../audio/pcm-capture';
import { extractDocxParagraphs } from '../documents/universal-parser';
import { cuesToSegments, mergeCues, parseTeamsDocxParagraphs, parseTranscriptText, parseVtt, type ImportedCue } from './transcript-import';

const RECORDING_SPEAKER = 'Speaker';
/** Windows are cut at the quietest moment between 18 s and 25 s so words are not split */
const MAX_WINDOW_SECONDS = 25;
const MIN_WINDOW_SECONDS = 18;
/** Windows quieter than this are skipped instead of transcribed */
const SILENCE_RMS = 0.0025;

export interface ImportDetails {
  title: string;
  startTime: number;
  /** Notes typed before the transcript was pasted */
  manualNotes?: string;
}

function newMeeting(id: string, details: ImportDetails, durationSeconds: number, transcript: TranscriptSegment[], spokenLanguage?: string): Meeting {
  return {
    id,
    title: details.title.trim() || 'Imported meeting',
    startTime: details.startTime,
    endTime: details.startTime + Math.round(durationSeconds * 1000),
    durationSeconds: Math.round(durationSeconds),
    transcript,
    manualNotes: details.manualNotes ?? '',
    timeline: [],
    screenshots: [],
    createdAt: Date.now(),
    spokenLanguage,
  };
}

/** Read a Teams (or other) transcript file into speaker turns (or its raw lines with merge: false) */
export async function readTranscriptFile(file: File, options: { merge?: boolean } = {}): Promise<ImportedCue[]> {
  const lower = file.name.toLowerCase();
  const cues = lower.endsWith('.docx')
    ? parseTeamsDocxParagraphs(await extractDocxParagraphs(await file.arrayBuffer()))
    : parseVtt(await file.text());
  if (!cues.length) throw new Error('No transcript lines were found in this file. Download the transcript from the Teams recap as .vtt or .docx.');
  return options.merge === false ? cues : mergeCues(cues);
}

/** Create a meeting from a transcript file; returns its id */
export async function importTranscriptFile(file: File, details: ImportDetails): Promise<string> {
  return importTranscriptCues(await readTranscriptFile(file), details);
}

/** Create a meeting from transcript lines (from a file or pasted from Teams); returns its id */
export async function importTranscriptCues(lines: ImportedCue[], details: ImportDetails): Promise<string> {
  if (!lines.length) throw new Error('There are no transcript lines to import.');
  const cues = mergeCues(lines);
  const id = crypto.randomUUID();
  await db.meetings.put(newMeeting(id, details, transcriptSeconds(cues), cuesToSegments(cues, id)));
  return id;
}

/** From the start to the end of the last line, which has no end time of its own */
const transcriptSeconds = (cues: ImportedCue[]) => {
  const last = cues[cues.length - 1];
  return last.startSeconds + Math.min(30, Math.max(5, last.text.split(' ').length / 2.5));
};

function readTranscriptText(text: string): ImportedCue[] {
  const cues = parseTranscriptText(text);
  if (!cues.length) throw new Error('No transcript lines were found in the pasted text.');
  return cues;
}

/** Create a meeting from a transcript pasted as text; returns its id */
export async function importTranscriptText(text: string, details: ImportDetails): Promise<string> {
  return importTranscriptCues(readTranscriptText(text), details);
}

/** Give a meeting that has no transcript one pasted as text; returns the number of speaker turns */
export async function addPastedTranscript(meetingId: string, text: string): Promise<number> {
  const cues = mergeCues(readTranscriptText(text));
  return db.transaction('rw', db.meetings, async () => {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) throw new Error('This meeting no longer exists.');
    if (meeting.transcript.length) throw new Error('This meeting already has a transcript.');
    await db.meetings.update(meetingId, {
      transcript: cuesToSegments(cues, meetingId),
      durationSeconds: meeting.durationSeconds || Math.round(transcriptSeconds(cues)),
    });
    return cues.length;
  });
}

// ── Recording import job (one at a time, survives switching pages) ──────────

export interface RecordingImportState {
  meetingId?: string;
  title: string;
  phase: 'reading' | 'loading-model' | 'transcribing' | 'done' | 'cancelled' | 'error';
  /** 0..1 within the current phase */
  fraction: number;
  processedSeconds: number;
  totalSeconds: number;
  lines: number;
  error?: string;
}

let state: RecordingImportState | null = null;
let controller: AbortController | null = null;
const listeners = new Set<(state: RecordingImportState | null) => void>();
const publish = (next: RecordingImportState | null) => {
  state = next;
  listeners.forEach((listener) => listener(state));
};

export const getRecordingImport = () => state;
export function subscribeRecordingImport(listener: (state: RecordingImportState | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const cancelRecordingImport = () => controller?.abort();
export const clearRecordingImport = () => { if (state && !['reading', 'loading-model', 'transcribing'].includes(state.phase)) publish(null); };
export const isRecordingImportRunning = () => Boolean(state && ['reading', 'loading-model', 'transcribing'].includes(state.phase));

const rmsOf = (audio: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < audio.length; i += 4) sum += audio[i] * audio[i];
  return Math.sqrt(sum / Math.max(1, Math.ceil(audio.length / 4)));
};

/** End of the next window, cut at the quietest 0.3 s between MIN and MAX window length */
export function nextWindowEnd(audio: Float32Array, from: number, rate = WHISPER_SAMPLE_RATE): number {
  const hardEnd = Math.min(audio.length, from + MAX_WINDOW_SECONDS * rate);
  if (hardEnd === audio.length) return hardEnd;
  const frame = Math.round(0.3 * rate);
  const step = Math.round(0.1 * rate);
  let best = hardEnd;
  let bestEnergy = Infinity;
  for (let start = from + MIN_WINDOW_SECONDS * rate; start + frame <= hardEnd; start += step) {
    let energy = 0;
    for (let i = start; i < start + frame; i += 4) energy += audio[i] * audio[i];
    if (energy < bestEnergy) { bestEnergy = energy; best = start + Math.round(frame / 2); }
  }
  return best;
}

/**
 * Transcribe a recording file (for example a Teams recap video) on this
 * computer and save it as a meeting. The transcript is saved as it grows, so
 * cancelling or closing the app keeps everything transcribed so far.
 */
export async function startRecordingImport(file: File, details: ImportDetails & { language: string }): Promise<string> {
  if (isRecordingImportRunning()) throw new Error('Another recording is already being imported.');
  if (activeRecordingIds.size) throw new Error('Stop the current recording before importing.');
  if (speechEngine.isBusy()) throw new Error('Wait for the current transcription to finish, then import.');

  controller = new AbortController();
  const signal = controller.signal;
  const title = details.title.trim() || file.name.replace(/\.[^.]+$/, '');
  const progress: RecordingImportState = { title, phase: 'reading', fraction: 0, processedSeconds: 0, totalSeconds: 0, lines: 0 };
  publish({ ...progress });
  const transcript: TranscriptSegment[] = [];

  try {
    const { audio, durationSeconds } = await decodeMediaFile(file, (fraction) => publish({ ...progress, fraction }), signal);
    if (!audio.length) throw new Error('This file has no audio.');
    progress.totalSeconds = durationSeconds;

    const id = crypto.randomUUID();
    progress.meetingId = id;
    await db.meetings.put(newMeeting(id, { ...details, title }, durationSeconds, [], details.language));

    progress.phase = 'loading-model';
    publish({ ...progress, fraction: 0 });
    await speechEngine.load(resolveTranscriptionEngine(details.language));

    progress.phase = 'transcribing';
    let lastSave = Date.now();
    for (let from = 0; from < audio.length;) {
      if (signal.aborted) throw new DOMException('Import cancelled.', 'AbortError');
      const to = nextWindowEnd(audio, from);
      const window = audio.subarray(from, to);
      if (rmsOf(window) >= SILENCE_RMS) {
        const pieces = await speechEngine.transcribe(normalizeSpeech(window.slice()), toWhisperLanguage(details.language));
        const offset = from / WHISPER_SAMPLE_RATE;
        for (const piece of pieces) {
          if (!piece.text?.trim() || isNonSpeech(piece.text)) continue;
          transcript.push({ id: `${id}-${transcript.length}`, timestampSeconds: offset + Math.max(0, piece.start), speaker: RECORDING_SPEAKER, text: piece.text.trim(), sourceLanguage: details.language });
        }
      }
      from = to;
      progress.processedSeconds = to / WHISPER_SAMPLE_RATE;
      progress.lines = transcript.length;
      publish({ ...progress, fraction: to / audio.length });
      if (Date.now() - lastSave > 5000) {
        await db.meetings.update(id, { transcript: [...transcript] });
        lastSave = Date.now();
      }
    }
    await db.meetings.update(id, { transcript });
    publish({ ...progress, phase: 'done', fraction: 1 });
    return id;
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === 'AbortError';
    if (progress.meetingId) {
      // Keep everything transcribed so far; drop the meeting only if nothing was
      if (transcript.length) await db.meetings.update(progress.meetingId, { transcript: [...transcript] }).catch(() => {});
      else await db.meetings.delete(progress.meetingId).catch(() => {});
    }
    publish({ ...progress, phase: cancelled ? 'cancelled' : 'error', error: cancelled ? undefined : error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    controller = null;
  }
}
