import { db } from '@/db';

/**
 * True when the active workspace holds nothing of the user's yet: no notes, meetings, documents,
 * manuals, screen recordings or schedule items. Built-in templates and default settings don't
 * count. The first-run tour only starts on its own then, so people upgrading with their work
 * already here are not interrupted (they find the tour in Help & about).
 */
export async function isWorkspaceEmpty(): Promise<boolean> {
  const counts = await Promise.all([
    db.notes.count(),
    db.meetings.count(),
    db.documents.count(),
    db.manuals.count(),
    db.operationSessions.count(),
    db.schedule.count(),
  ]);
  return counts.every((count) => count === 0);
}
