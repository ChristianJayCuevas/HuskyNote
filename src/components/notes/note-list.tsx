import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Plus, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { ListItem, ListPane, ListPaneBody, ListPaneEmpty, ListPaneHeader, ListPaneSearch } from '../ui/list-pane';
import { tourTarget } from '@/features/guided-tour/tours/targets';

const tagChipClass =
  'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground';

interface NoteListProps {
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

export const NoteList: React.FC<NoteListProps> = ({
  selectedNoteId,
  onSelectNote,
  onCreateNote,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const notes = useLiveQuery(async () => {
    return await db.notes.orderBy('updatedAt').reverse().toArray();
  }, []) || [];

  // Compute unique tags
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags || [])));

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !activeTag || (n.tags && n.tags.includes(activeTag));
    return matchesSearch && matchesTag;
  });

  return (
    <ListPane>
      <ListPaneHeader
        title="Notes"
        count={notes.length}
        actions={
          <Button size="sm" variant="default" onClick={onCreateNote} {...tourTarget('new-note')}>
            <Plus />
            <span>New Note</span>
          </Button>
        }
      />
      <ListPaneSearch
        placeholder="Filter notes..."
        aria-label="Filter notes"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={() => setSearchQuery('')}
      />

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-3 pb-2">
          <button
            type="button"
            aria-pressed={!activeTag}
            onClick={() => setActiveTag(null)}
            className={tagChipClass}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              type="button"
              key={tag}
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={tagChipClass}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* List items */}
      <ListPaneBody>
        {filteredNotes.length === 0 ? (
          <ListPaneEmpty
            icon={<FileText />}
            title={notes.length === 0 ? 'No notes yet. Create your first note.' : 'No notes match your filter.'}
          />
        ) : (
          filteredNotes.map((item) => {
            const updatedDate = new Date(item.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const previewSnippet =
              item.content.replace(/[#*`_>\[\]]/g, '').replace(/(^|\s)[-+](?=\s)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 75) || 'Empty note';

            return (
              <ListItem
                key={item.id}
                selected={selectedNoteId === item.id}
                onClick={() => onSelectNote(item.id)}
                title={item.title || 'Untitled Note'}
                trailing={updatedDate}
                meta={previewSnippet}
                description={
                  item.tags && item.tags.length > 0 ? (
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-sm bg-secondary px-1 text-secondary-foreground">
                          #{tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && <span>+{item.tags.length - 3}</span>}
                    </span>
                  ) : undefined
                }
              />
            );
          })
        )}
      </ListPaneBody>
    </ListPane>
  );
};
