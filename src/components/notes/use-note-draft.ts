import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { db } from '../../db';
import { NoteDraft, type NoteDraftState } from '../../services/notes/note-draft';

const sessions = new Map<string, NoteDraft>();
const keyFor = (id: string) => `${db.name}:${id}`;
const subscribeEmpty = () => () => {};
const getEmpty = () => null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if ([...sessions.values()].some(session => session.hasUnsavedChanges())) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

export function useNoteDraft(noteId: string, onSaveError: () => void) {
  const [session, setSession] = useState<NoteDraft | null>(null);
  useEffect(() => {
    let mounted = true;
    let loaded: NoteDraft | undefined;
    void (async () => {
      const key = keyFor(noteId);
      loaded = sessions.get(key);
      if (!loaded) {
        const note = await db.notes.get(noteId);
        if (!mounted || !note) return;
        loaded = sessions.get(key) ?? new NoteDraft(note);
        sessions.set(key, loaded);
      }
      if (mounted) setSession(loaded);
    })().catch(() => { if (mounted) onSaveError(); });
    return () => {
      mounted = false;
      if (loaded?.hasUnsavedChanges()) {
        void loaded.flush().then(saved => { if (!saved) onSaveError(); });
      } else if (loaded) {
        sessions.delete(keyFor(noteId));
      }
    };
  }, [noteId, onSaveError]);
  const state: NoteDraftState | null = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? getEmpty);
  const setTitle = useCallback((title: string) => session?.update({ title }), [session]);
  const setContent = useCallback((value: string | ((previous: string) => string)) => {
    if (!session) return;
    const content = typeof value === 'function' ? value(session.getSnapshot().note.content) : value;
    session.update({ content });
  }, [session]);
  const setTags = useCallback((tags: string[]) => session?.update({ tags }), [session]);
  const performSave = useCallback(async (title: string, content: string, tags: string[]) => {
    if (!session) return false;
    session.update({ title, content, tags });
    return session.flush();
  }, [session]);
  const discard = useCallback(async () => {
    await session?.discard();
    sessions.delete(keyFor(noteId));
  }, [session, noteId]);
  const resume = () => {
    if (!session) return;
    session.resume();
    sessions.set(keyFor(noteId), session);
  };
  return {
    note: state?.note ?? null, title: state?.note.title ?? '', content: state?.note.content ?? '', tags: state?.note.tags ?? [],
    saveStatus: state?.status ?? 'saved', saveError: state?.error ?? '', setTitle, setContent, setTags, performSave, discard, resume,
    retry: () => session?.flush(),
  };
}
