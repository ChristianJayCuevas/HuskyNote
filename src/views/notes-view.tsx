import React, { useEffect } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { NoteList } from '../components/notes/note-list';
import { NoteEditor } from '../components/notes/note-editor';
import { EmptyState } from '../components/ui/empty-state';
import { ResizableListPanel } from '../components/ui/resizable-list-panel';
import { FileText } from 'lucide-react';

export const NotesView: React.FC = () => {
  const { activeNoteId, setActiveNoteId } = useWorkspace();

  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []) || [];

  // Auto-select first note if none selected and notes exist
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches && !activeNoteId && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId, setActiveNoteId]);

  const handleCreateNote = async () => {
    const noteId = `note-${Date.now()}`;
    await db.notes.put({
      id: noteId,
      title: 'Untitled Note',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [],
    });
    setActiveNoteId(noteId);
  };

  // Listen to Topbar trigger
  useEffect(() => {
    const handleNewNoteEvent = () => handleCreateNote();
    window.addEventListener('huskynote:new-note', handleNewNoteEvent);
    return () => window.removeEventListener('huskynote:new-note', handleNewNoteEvent);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ResizableListPanel storageKey="notes" label="Notes" hiddenOnMobile={!!activeNoteId}>
        <NoteList
          selectedNoteId={activeNoteId}
          onSelectNote={(id) => setActiveNoteId(id)}
          onCreateNote={handleCreateNote}
        />
      </ResizableListPanel>

      <div className={`${activeNoteId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col`}>
        {activeNoteId ? (
          <NoteEditor
            key={activeNoteId}
            noteId={activeNoteId}
            onBackToList={() => setActiveNoteId(null)}
            onDeleted={() => {
              const remaining = notes.filter((n) => n.id !== activeNoteId);
              setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={FileText}
              title="No note selected"
              description="Select a note from the sidebar or create a new markdown note to start writing."
              actionLabel="New Note"
              onAction={handleCreateNote}
            />
          </div>
        )}
      </div>
    </div>
  );
};
