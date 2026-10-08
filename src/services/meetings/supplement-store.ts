import { db } from '../../db';
import type { Meeting, TranscriptSegment } from '../../types';

/** Replace a meeting's transcript with the supplemented one, keeping the original for Restore */
export async function saveSupplementedTranscript(
  meetingId: string,
  transcript: TranscriptSegment[],
  info: NonNullable<Meeting['transcriptSupplement']>
): Promise<void> {
  await db.transaction('rw', db.meetings, async () => {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting) throw new Error('This meeting no longer exists.');
    await db.meetings.update(meetingId, {
      // Supplementing twice still restores to the very first transcript
      originalTranscript: meeting.originalTranscript ?? meeting.transcript,
      transcript,
      transcriptSupplement: info,
    });
  });
}

/** Put back the transcript from before it was supplemented */
export async function restoreOriginalTranscript(meetingId: string): Promise<void> {
  await db.transaction('rw', db.meetings, async () => {
    const meeting = await db.meetings.get(meetingId);
    if (!meeting?.originalTranscript) throw new Error('There is no original transcript to restore.');
    await db.meetings.update(meetingId, { transcript: meeting.originalTranscript, originalTranscript: undefined, transcriptSupplement: undefined });
  });
}
