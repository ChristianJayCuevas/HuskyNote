import { db } from '../../db';
import Dexie from 'dexie';
import type { SpeechJob } from './job-types';
import type { TranscriptSegment } from '../../types';
import { speechEngine, isNonSpeech, toWhisperLanguage } from './speech-engine';
import { getTranscriptionEngine } from './transcription-engines';

const running = new Map<string, Promise<void>>();
const paused = new Set<string>();

export function pauseMeetingTranscription(meetingId: string): void { paused.add(meetingId); }

export async function enqueueSpeechJob(job: SpeechJob): Promise<void> {
  await db.transaction('rw', db.meetings, db.speechJobs, async () => {
    const meeting = await db.meetings.get(job.meetingId);
    // Deletion wins over late capture events.
    if (meeting?.audioBlobId) await db.speechJobs.put(job);
  });
}

/** Atomic, idempotent completion. Deleted jobs/meetings can never be resurrected. */
export async function completeSpeechJob(job: SpeechJob, segments: TranscriptSegment[]): Promise<boolean> {
  return db.transaction('rw', db.meetings, db.speechJobs, async () => {
    const meeting = await db.meetings.get(job.meetingId);
    if (!meeting || !await db.speechJobs.get(job.id)) return false;
    const ids = new Set(segments.map((s) => s.id));
    const transcript = [...meeting.transcript.filter((s) => !ids.has(s.id)), ...segments]
      .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    await db.meetings.update(meeting.id, { transcript });
    await db.speechJobs.delete(job.id);
    return true;
  });
}

export function processMeetingJobs(meetingId: string, onSegment?: (segment: TranscriptSegment) => void, retry = false): Promise<void> {
  const existing = running.get(meetingId);
  if (existing) return existing;
  paused.delete(meetingId);
  const run = (async () => {
    while (!paused.has(meetingId)) {
      const job = await db.speechJobs.where('[meetingId+sequence]').between([meetingId, Dexie.minKey], [meetingId, Dexie.maxKey]).first();
      if (!job) return;
      if (job.error && !retry) return;
      try {
        await speechEngine.load(getTranscriptionEngine(job.engineId));
        if (paused.has(meetingId)) return;
        const result = await speechEngine.transcribe(job.audio, toWhisperLanguage(job.language));
        const segments = result.filter((p) => p.text && !isNonSpeech(p.text)).map((p, i) => ({
          id: `${job.id}-segment-${i}`, timestampSeconds: Math.max(0, job.startSeconds + p.start),
          speaker: job.speaker, text: p.text, sourceLanguage: job.language,
        }));
        if (await completeSpeechJob(job, segments)) segments.forEach((s) => onSegment?.(s));
      } catch (error) {
        await db.speechJobs.update(job.id, { error: error instanceof Error ? error.message : String(error), attempts: job.attempts + 1 });
        return; // Keep audio for an explicit retry, never spin/download indefinitely.
      }
    }
  })().finally(() => { running.delete(meetingId); });
  running.set(meetingId, run);
  return run;
}
