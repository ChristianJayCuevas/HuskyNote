import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HuskyNoteDatabase } from '../src/db';
import { NoteDraft, persistNoteDraft } from '../src/services/notes/note-draft';
import type { Note } from '../src/types';

const note: Note = { id: 'draft-test', title: 'Original', content: 'Original content', tags: [], versions: [], createdAt: 1, updatedAt: 1 };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('note draft persistence', () => {
  it('retains a failed draft and retries the latest content without claiming success', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError')).mockImplementation(async value => value);
    const draft = new NoteDraft(note, persist);
    draft.update({ content: 'Draft retained' });
    expect(draft.getSnapshot().status).toBe('unsaved');
    expect(await draft.flush()).toBe(false);
    expect(draft.getSnapshot().status).toBe('error');
    expect(draft.getSnapshot().note.content).toBe('Draft retained');
    expect(draft.hasUnsavedChanges()).toBe(true);
    draft.update({ content: 'Latest retry' });
    expect(await draft.flush()).toBe(true);
    expect(persist.mock.lastCall?.[0].content).toBe('Latest retry');
    expect(draft.getSnapshot().status).toBe('saved');
    expect(draft.hasUnsavedChanges()).toBe(false);
  });

  it('serializes overlapping edits and never marks a newer edit saved by an older write', async () => {
    let release!: (value: Note) => void;
    const first = new Promise<Note>(resolve => { release = resolve; });
    const persist = vi.fn().mockReturnValueOnce(first).mockImplementation(async value => value);
    const draft = new NoteDraft(note, persist);
    const savedContents: string[] = [];
    draft.subscribe(() => { if (draft.getSnapshot().status === 'saved') savedContents.push(draft.getSnapshot().note.content); });
    draft.update({ content: 'First edit' });
    const saving = draft.flush();
    await Promise.resolve();
    draft.update({ content: 'Second edit' });
    expect(persist).toHaveBeenCalledTimes(1);
    release({ ...note, content: 'First edit' });
    expect(await saving).toBe(true);
    expect(persist.mock.calls.map(([value]) => value.content)).toEqual(['First edit', 'Second edit']);
    expect(savedContents).toEqual(['Second edit']);
    expect(draft.getSnapshot().note.content).toBe('Second edit');
  });

  it('flushes pending changes immediately and cancels the later debounce', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async value => value);
    const draft = new NoteDraft(note, persist);
    draft.update({ title: 'Leaving editor' });
    await draft.flush();
    await vi.advanceTimersByTimeAsync(1500);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].id).toBe(note.id);
  });

  it('does not persist a discarded draft after deletion', async () => {
    vi.useFakeTimers();
    const persist = vi.fn(async value => value);
    const draft = new NoteDraft(note, persist);
    draft.update({ content: 'Deleted draft' });
    await draft.discard();
    await vi.advanceTimersByTimeAsync(1500);
    await draft.flush();
    expect(persist).not.toHaveBeenCalled();
    expect(draft.hasUnsavedChanges()).toBe(false);
  });

  it('preserves stored history and refuses to resurrect a missing note', async () => {
    const database = new HuskyNoteDatabase(`note-draft-${crypto.randomUUID()}`);
    try {
      const stored = { ...note, versions: [{ id: 'old', timestamp: 1, title: 'Earlier', content: 'History' }] };
      await database.notes.put(stored);
      const saved = await persistNoteDraft({ ...note, content: 'Fresh content' }, database);
      expect(saved.versions[0].content).toBe('History');
      expect((await database.notes.get(note.id))?.content).toBe('Fresh content');
      await database.notes.delete(note.id);
      await expect(persistNoteDraft(note, database)).rejects.toThrow('no longer exists');
      expect(await database.notes.count()).toBe(0);
    } finally { await database.delete(); }
  });

  it('allows editing and retry after deletion is cancelled by a failed write', async () => {
    const persist = vi.fn(async value => value);
    const draft = new NoteDraft(note, persist);
    draft.update({ content: 'Draft before deletion' });
    await draft.discard();
    draft.resume();
    draft.update({ content: 'Draft after failed deletion' });
    expect(await draft.flush()).toBe(true);
    expect(persist.mock.lastCall?.[0].content).toBe('Draft after failed deletion');
  });
});
