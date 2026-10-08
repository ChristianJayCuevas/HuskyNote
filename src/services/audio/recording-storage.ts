import { db } from '../../db';
import { activeRecordingIds } from './recorder';
import { pauseMeetingTranscription } from './speech-jobs';

export interface RecordingEntry {
  id: string;
  title: string;
  createdAt: number;
  size: number;
  mimeType: string;
  meetingId?: string;
  durationSeconds?: number;
  partial?: boolean;
  pendingJobs?: number;
  processingBytes?: number;
}

/** Return metadata only, including audio left behind by interrupted saves. */
export async function listRecordings(): Promise<RecordingEntry[]> {
  const meetings = await db.meetings.toArray();
  const byAudio = new Map(meetings.filter((m) => m.audioBlobId).map((m) => [m.audioBlobId, m]));
  const entries: RecordingEntry[] = [];
  await db.blobs.each((blob) => {
    const meeting = byAudio.get(blob.id);
    if (!meeting && !blob.mimeType.startsWith('audio/')) return;
    entries.push({
      id: blob.id, title: meeting?.title || 'Unlinked recording',
      createdAt: meeting?.startTime ?? blob.createdAt,
      size: blob.data.size, mimeType: blob.mimeType,
      meetingId: meeting?.id, durationSeconds: meeting?.durationSeconds,
    });
  });
  const partial = new Map<string, RecordingEntry>();
  await db.audioChunks.each((chunk) => {
    if (entries.some((e) => e.id === chunk.recordingId)) return;
    const meeting = byAudio.get(chunk.recordingId);
    const entry = partial.get(chunk.recordingId) ?? {
      id: chunk.recordingId, title: meeting?.title || 'Interrupted recording', createdAt: meeting?.startTime ?? chunk.createdAt,
      size: 0, mimeType: chunk.data.type, meetingId: meeting?.id, durationSeconds: meeting?.durationSeconds, partial: true,
    };
    entry.size += chunk.data.size;
    partial.set(entry.id, entry);
  });
  entries.push(...partial.values());
  const byMeeting = new Map(entries.filter((e) => e.meetingId).map((e) => [e.meetingId, e]));
  await db.speechJobs.each((job) => {
    let entry = byMeeting.get(job.meetingId);
    if (!entry) {
      const meeting = meetings.find((m) => m.id === job.meetingId);
      if (!meeting?.audioBlobId) return;
      entry = { id: meeting.audioBlobId, title: meeting.title, createdAt: meeting.startTime, size: 0, mimeType: 'audio/webm', meetingId: meeting.id, partial: true };
      entries.push(entry); byMeeting.set(job.meetingId, entry);
    }
    entry.pendingJobs = (entry.pendingJobs ?? 0) + 1;
    entry.processingBytes = (entry.processingBytes ?? 0) + job.audio.byteLength;
  });
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}

/** Remove only audio, retaining transcripts, notes, and summaries atomically. */
export async function deleteRecording(blobId: string): Promise<void> {
  if (activeRecordingIds.has(blobId)) throw new Error('Stop this recording before deleting it.');
  await db.transaction('rw', db.meetings, db.blobs, db.audioChunks, db.speechJobs, async () => {
    const meetings = await db.meetings.filter((m) => m.audioBlobId === blobId).toArray();
    for (const meeting of meetings) {
      pauseMeetingTranscription(meeting.id);
      await db.speechJobs.where('meetingId').equals(meeting.id).delete();
    }
    await db.meetings.filter((m) => m.audioBlobId === blobId)
      .modify((meeting) => { delete meeting.audioBlobId; });
    await db.blobs.delete(blobId);
    await db.audioChunks.where('recordingId').equals(blobId).delete();
  });
}

export async function getRecordingAudio(id: string): Promise<Blob> {
  if (activeRecordingIds.has(id)) throw new Error('Stop the recording before opening its audio.');
  const stored = await db.blobs.get(id);
  if (stored) return stored.data;
  const chunks = await db.audioChunks.where('recordingId').equals(id).sortBy('sequence');
  if (!chunks.length) throw new Error('No playable audio is available.');
  // MediaRecorder fragments are ordered parts of one container, not separate files.
  // An interrupted container may require an external media repair tool to play.
  return new Blob(chunks.map((c) => c.data), { type: chunks[0].data.type });
}

export async function deleteMeetingRecording(meetingId: string): Promise<void> {
  const meeting = await db.meetings.get(meetingId);
  if (meeting?.audioBlobId && activeRecordingIds.has(meeting.audioBlobId)) throw new Error('Recording is active.');
  pauseMeetingTranscription(meetingId);
  await db.transaction('rw', db.meetings, db.blobs, db.audioChunks, db.speechJobs, async () => {
    const current = await db.meetings.get(meetingId);
    await db.speechJobs.where('meetingId').equals(meetingId).delete();
    await db.meetings.delete(meetingId);
    if (current?.audioBlobId && !(await db.meetings.filter((m) => m.audioBlobId === current.audioBlobId).count())) {
      await db.blobs.delete(current.audioBlobId);
      await db.audioChunks.where('recordingId').equals(current.audioBlobId).delete();
    }
  });
}
