import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db';
import { completeSpeechJob, enqueueSpeechJob, processMeetingJobs } from '../src/services/audio/speech-jobs';
import { deleteRecording, getRecordingAudio, listRecordings } from '../src/services/audio/recording-storage';
import type { SpeechJob } from '../src/services/audio/job-types';
import { speechEngine } from '../src/services/audio/speech-engine';

const job: SpeechJob = { id: 'job1', meetingId: 'm1', sequence: 0, startSeconds: 4, language: 'fil-PH', speaker: 'Host', engineId: 'whisper-base', audio: new Float32Array(16000), attempts: 0 };
beforeEach(async () => {
  vi.restoreAllMocks(); await db.delete(); await db.open();
  await db.meetings.put({ id: 'm1', audioBlobId: 'audio1', title: 'Taglish meeting', createdAt: 1, startTime: 1, durationSeconds: 10, transcript: [], manualNotes: 'Keep notes', timeline: [], screenshots: [] });
});
afterAll(async () => { await db.delete(); });

describe('durable transcription', () => {
  it('retains failed PCM, retries it and commits timestamped results once', async () => {
    vi.spyOn(speechEngine, 'load').mockResolvedValue();
    const transcribe = vi.spyOn(speechEngine, 'transcribe').mockRejectedValueOnce(new Error('GPU failure')).mockResolvedValue([{ start: 1, text: 'Meeting natin bukas.' }]);
    await enqueueSpeechJob(job); await processMeetingJobs('m1');
    expect((await db.speechJobs.get(job.id))?.error).toBe('GPU failure');
    await processMeetingJobs('m1'); expect(transcribe).toHaveBeenCalledTimes(1);
    await processMeetingJobs('m1', undefined, true);
    expect(await db.speechJobs.count()).toBe(0);
    const meeting = await db.meetings.get('m1');
    expect(meeting?.transcript).toEqual([{ id: 'job1-segment-0', timestampSeconds: 5, text: 'Meeting natin bukas.', speaker: 'Host', sourceLanguage: 'fil-PH' }]);
    expect(await completeSpeechJob(job, meeting!.transcript)).toBe(false);
  });

  it('deletion removes audio chunks and pending PCM, and late results cannot restore them', async () => {
    await enqueueSpeechJob(job);
    await db.audioChunks.put({ id: 'c1', recordingId: 'audio1', sequence: 0, data: new Blob(['part'], { type: 'audio/webm' }), createdAt: 1 });
    expect((await listRecordings())[0]).toMatchObject({ partial: true, pendingJobs: 1, processingBytes: 64000 });
    await deleteRecording('audio1');
    expect(await db.audioChunks.count()).toBe(0); expect(await db.speechJobs.count()).toBe(0);
    expect(await completeSpeechJob(job, [])).toBe(false);
    await enqueueSpeechJob(job); expect(await db.speechJobs.count()).toBe(0);
    expect((await db.meetings.get('m1'))?.manualNotes).toBe('Keep notes');
  });

  it('reconstructs interrupted media in capture order', async () => {
    await db.audioChunks.bulkPut([
      { id: 'last', recordingId: 'audio1', sequence: 1, data: new Blob(['tail'], { type: 'audio/webm' }), createdAt: 2 },
      { id: 'first', recordingId: 'audio1', sequence: 0, data: new Blob(['head'], { type: 'audio/webm' }), createdAt: 1 },
    ]);
    expect(await (await getRecordingAudio('audio1')).text()).toBe('headtail');
  });
});
