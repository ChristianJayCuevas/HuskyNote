import { db } from '../../db';
import type { Meeting, MeetingPart, TimelineItem } from '../../types';
import { activeRecordingIds } from '../audio/recorder';
import { processMeetingJobs } from '../audio/speech-jobs';
import { formatSecondsToTime } from '../audio/transcriber';
import { meetingDurationSeconds } from './meeting-report';

/** Gaps shorter than this between parts are not called out on the timeline */
const GAP_NOTE_SECONDS = 30;
/** Audio saved this recently may still be recording in another window */
const STILL_RECORDING_MS = 2 * 60 * 1000;

/**
 * A recording that never got its end time: the page reloaded or Stop failed,
 * so its audio is still in 1-second pieces and its length was never measured.
 */
export function isUnfinishedRecording(meeting: Meeting): boolean {
  return !meeting.endTime && !meeting.parts?.length && Boolean(meeting.audioBlobId)
    && !activeRecordingIds.has(meeting.audioBlobId as string);
}

/**
 * Finish saving an interrupted recording: join its saved audio pieces into one
 * file and set its real end time and length (from the last saved audio).
 * The pieces are kept as well, so nothing is removed.
 */
export async function finishInterruptedRecording(meetingId: string): Promise<Meeting> {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) throw new Error('This meeting no longer exists.');
  if (meeting.endTime) return meeting;
  const audioId = meeting.audioBlobId;
  if (audioId && activeRecordingIds.has(audioId)) throw new Error('This recording is still running. Stop it first.');

  const chunks = audioId ? await db.audioChunks.where('recordingId').equals(audioId).sortBy('sequence') : [];
  const lastChunkAt = chunks.reduce((latest, c) => Math.max(latest, c.createdAt || 0), 0);
  if (lastChunkAt && Date.now() - lastChunkAt < STILL_RECORDING_MS) {
    throw new Error('This recording saved audio in the last 2 minutes. If it is still recording in another window, stop it there first.');
  }
  const lastSpeech = meeting.transcript.reduce((latest, s) => Math.max(latest, s.timestampSeconds || 0), 0);
  const endTime = Math.max(lastChunkAt, meeting.startTime + lastSpeech * 1000, meeting.startTime);
  const durationSeconds = Math.round((endTime - meeting.startTime) / 1000);

  await db.transaction('rw', db.meetings, db.blobs, async () => {
    if (audioId && chunks.length && !(await db.blobs.get(audioId))) {
      const audio = new Blob(chunks.map((c) => c.data), { type: chunks[0].data.type || 'audio/webm' });
      await db.blobs.put({ id: audioId, data: audio, mimeType: audio.type, createdAt: Date.now() });
    }
    await db.meetings.update(meetingId, { endTime, durationSeconds });
  });
  return { ...meeting, endTime, durationSeconds };
}

/** Combine recordings into one meeting: transcripts, notes, screenshots and timeline in time order */
export function buildMergedMeeting(meetings: Meeting[], options: { id: string; title: string; now: number }): Meeting {
  if (meetings.length < 2) throw new Error('Choose at least two meetings to merge.');
  const sorted = [...meetings].sort((a, b) => a.startTime - b.startTime);
  const first = sorted[0];

  const parts: MeetingPart[] = sorted.map((m) => {
    const durationSeconds = meetingDurationSeconds(m);
    const endTime = m.endTime && m.endTime > m.startTime ? m.endTime : m.startTime + durationSeconds * 1000;
    return {
      meetingId: m.id,
      startTime: m.startTime,
      endTime,
      audioBlobId: m.audioBlobId,
      offsetSeconds: Math.round((m.startTime - first.startTime) / 1000),
      durationSeconds,
    };
  });

  const transcript = sorted.flatMap((m, i) => m.transcript.map((segment) => ({
    ...segment,
    id: `${m.id}:${segment.id}`,
    timestampSeconds: segment.timestampSeconds + parts[i].offsetSeconds,
  })));

  const timeline: TimelineItem[] = sorted.flatMap((m, i) => m.timeline.map((item) => {
    const timestampSeconds = item.timestampSeconds + parts[i].offsetSeconds;
    return { ...item, id: `${m.id}:${item.id}`, timestampSeconds, timeFormatted: formatSecondsToTime(timestampSeconds) };
  }));
  for (let i = 1; i < parts.length; i++) {
    const gapSeconds = Math.round((parts[i].startTime - parts[i - 1].endTime) / 1000);
    if (gapSeconds < GAP_NOTE_SECONDS) continue;
    const at = Math.round((parts[i - 1].endTime - first.startTime) / 1000);
    timeline.push({
      id: `gap-${i}`,
      timestampSeconds: at,
      timeFormatted: formatSecondsToTime(at),
      label: `Recording paused for ${Math.max(1, Math.round(gapSeconds / 60))} min`,
      type: 'note',
    });
  }
  timeline.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  const screenshots = sorted.flatMap((m, i) => (m.screenshots ?? []).map((shot) => ({
    ...shot,
    id: `${m.id}:${shot.id}`,
    timestampSeconds: shot.timestampSeconds + parts[i].offsetSeconds,
  })));

  const manualNotes = sorted.map((m) => m.manualNotes?.trim()).filter(Boolean).join('\n\n---\n\n');
  const endTime = Math.max(...parts.map((p) => p.endTime));

  return {
    id: options.id,
    title: options.title.trim() || first.title,
    startTime: first.startTime,
    endTime,
    durationSeconds: Math.round((endTime - first.startTime) / 1000),
    transcript,
    manualNotes,
    timeline,
    screenshots,
    createdAt: options.now,
    spokenLanguage: first.spokenLanguage,
    translationLanguage: first.translationLanguage,
    parts,
  };
}

/**
 * Merge meetings into a new one. Interrupted recordings are finished first.
 * The originals are kept (hidden from lists) with their audio, so a merge can
 * always be undone with unmergeMeeting.
 */
export async function mergeMeetings(ids: string[], title: string): Promise<string> {
  const unique = [...new Set(ids)];
  if (unique.length < 2) throw new Error('Choose at least two meetings to merge.');

  // Phrases still waiting to be transcribed are finished first when possible
  await Promise.race([
    Promise.allSettled(unique.map((id) => processMeetingJobs(id, undefined, true))),
    new Promise((resolve) => setTimeout(resolve, 45000)),
  ]);

  for (const id of unique) {
    const meeting = await db.meetings.get(id);
    if (meeting && isUnfinishedRecording(meeting)) await finishInterruptedRecording(id);
  }

  const meetings = await db.meetings.bulkGet(unique);
  if (meetings.some((m) => !m)) throw new Error('One of the meetings no longer exists.');
  const found = meetings as Meeting[];
  if (found.some((m) => m.mergedInto)) throw new Error('One of these meetings is already part of a merged meeting.');
  if (found.some((m) => m.parts?.length)) throw new Error('Merged meetings cannot be merged again. Unmerge them first.');

  const merged = buildMergedMeeting(found, { id: crypto.randomUUID(), title, now: Date.now() });
  await db.transaction('rw', db.meetings, async () => {
    await db.meetings.put(merged);
    for (const m of found) await db.meetings.update(m.id, { mergedInto: merged.id });
  });
  return merged.id;
}

/** Undo a merge: the original recordings come back to the list and the merged meeting is removed */
export async function unmergeMeeting(mergedId: string): Promise<string[]> {
  return db.transaction('rw', db.meetings, async () => {
    const merged = await db.meetings.get(mergedId);
    if (!merged?.parts?.length) throw new Error('This is not a merged meeting.');
    const restored: string[] = [];
    for (const part of merged.parts) {
      const original = await db.meetings.get(part.meetingId);
      if (!original) continue;
      await db.meetings.update(part.meetingId, { mergedInto: undefined });
      restored.push(part.meetingId);
    }
    await db.meetings.delete(mergedId);
    return restored;
  });
}

/** Meetings to show in lists: merged-away recordings are hidden */
export const isListedMeeting = (meeting: Meeting): boolean => !meeting.mergedInto;
