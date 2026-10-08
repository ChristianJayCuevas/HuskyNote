import { db, type HuskyNoteDatabase } from '../../db';
import type { Note } from '../../types';

export interface NoteDraftState {
  note: Note;
  status: 'saved' | 'unsaved' | 'saving' | 'error';
  error: string;
}

export async function persistNoteDraft(note: Note, database: HuskyNoteDatabase = db): Promise<Note> {
  return database.transaction('rw', database.notes, async () => {
    const stored = await database.notes.get(note.id);
    if (!stored) throw new Error('This note no longer exists. Export your draft before leaving.');
    const now = Date.now();
    const versions = [...stored.versions];
    const last = versions[versions.length - 1];
    if (!last || now - last.timestamp > 60000) {
      versions.push({ id: `v-${now}`, timestamp: now, title: note.title, content: note.content, changeSummary: 'Autosave checkpoint' });
    }
    const saved = { ...stored, title: note.title, content: note.content, tags: [...note.tags], updatedAt: now, versions: versions.slice(-20) };
    await database.notes.put(saved);
    return saved;
  });
}

/** Serializes saves and retains failed drafts in memory while the app stays open. */
export class NoteDraft {
  private state: NoteDraftState;
  private revision = 0;
  private savedRevision = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<boolean> | undefined;
  private discarded = false;

  constructor(note: Note, private persist: (note: Note) => Promise<Note> = persistNoteDraft) {
    this.state = { note, status: 'saved', error: '' };
  }
  getSnapshot = (): NoteDraftState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  hasUnsavedChanges = () => !this.discarded && this.revision !== this.savedRevision;
  private emit(state: NoteDraftState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  update(fields: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) {
    if (this.discarded) return;
    const next = { ...this.state.note, ...fields };
    if (next.title === this.state.note.title && next.content === this.state.note.content && JSON.stringify(next.tags) === JSON.stringify(this.state.note.tags)) return;
    this.revision += 1;
    this.emit({ note: next, status: 'unsaved', error: '' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, 1200);
  }
  flush = (): Promise<boolean> => {
    clearTimeout(this.timer);
    if (this.discarded) return Promise.resolve(true);
    if (this.inFlight) return this.inFlight;
    if (!this.hasUnsavedChanges()) return Promise.resolve(true);
    this.inFlight = Promise.resolve().then(async () => {
      while (this.hasUnsavedChanges()) {
        const revision = this.revision;
        const snapshot = { ...this.state.note, tags: [...this.state.note.tags] };
        this.emit({ ...this.state, status: 'saving', error: '' });
        try {
          const saved = await this.persist(snapshot);
          if (this.discarded) return true;
          this.savedRevision = revision;
          this.emit({ note: { ...this.state.note, updatedAt: saved.updatedAt, versions: saved.versions }, status: this.hasUnsavedChanges() ? 'unsaved' : 'saved', error: '' });
        } catch (error) {
          if (this.discarded) return true;
          this.emit({ ...this.state, status: 'error', error: error instanceof Error && error.name === 'QuotaExceededError'
            ? 'Device storage is full. Free space, then retry. Your draft is still here.'
            : 'Could not save this note. Your draft is still here. Retry or export it before closing the app.' });
          return false;
        }
      }
      return true;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  };
  async discard() {
    this.discarded = true;
    clearTimeout(this.timer);
    await this.inFlight;
  }
  resume() {
    this.discarded = false;
    this.emit({ ...this.state, status: this.hasUnsavedChanges() ? 'unsaved' : 'saved' });
  }
}
