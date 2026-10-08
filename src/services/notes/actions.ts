import { db } from '../../db';

export async function createEmptyNote(): Promise<string> {
  const id = `note-${crypto.randomUUID()}`;
  const now = Date.now();
  await db.notes.put({ id, title: 'Untitled Note', content: '', tags: [], versions: [], createdAt: now, updatedAt: now });
  return id;
}
