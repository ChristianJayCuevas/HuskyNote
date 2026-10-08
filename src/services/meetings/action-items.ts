import { db } from '../../db';
import type { Meeting } from '../../types';

export interface OpenActionItem {
  meetingId: string;
  meetingTitle: string;
  meetingStart: number;
  /** Position in the meeting's action item list, used to mark it done */
  index: number;
  task: string;
  owner?: string;
}

/** Action items not yet marked done, newest meeting first */
export function collectOpenActionItems(meetings: Meeting[]): OpenActionItem[] {
  return [...meetings]
    .sort((a, b) => b.startTime - a.startTime)
    .flatMap((meeting) =>
      (meeting.summary?.actionItems ?? []).flatMap((item, index) =>
        item.done || !item.task?.trim()
          ? []
          : [{ meetingId: meeting.id, meetingTitle: meeting.title, meetingStart: meeting.startTime, index, task: item.task, owner: item.owner }]
      )
    );
}

/** Saves an action item's done state on its meeting */
export async function setActionItemDone(meetingId: string, index: number, done: boolean): Promise<void> {
  await db.transaction('rw', db.meetings, async () => {
    const meeting = await db.meetings.get(meetingId);
    const items = meeting?.summary?.actionItems;
    if (!meeting?.summary || !items?.[index]) return;
    const actionItems = items.map((item, i) => (i === index ? { ...item, done } : item));
    await db.meetings.update(meetingId, { summary: { ...meeting.summary, actionItems } });
  });
}
