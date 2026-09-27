import React, { useState } from 'react';
import type { Note } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Search, Plus, FileText, Calendar, Tag as TagIcon, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

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
    <div className="w-full border-r border-slate-200 dark:border-zinc-850 flex flex-col h-full bg-white dark:bg-zinc-950 shrink-0 select-none transition-colors duration-500">
      {/* Search and Create Header */}
      <div className="p-4 border-b border-slate-200 dark:border-zinc-850 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
            Notes ({notes.length})
          </span>
          <Button size="sm" variant="primary" onClick={onCreateNote}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </Button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700"
          />
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap font-medium ${
                !activeTag
                  ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-white'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-950 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap flex items-center gap-1 font-medium ${
                  activeTag === tag
                    ? 'bg-slate-900 text-white dark:bg-zinc-800 dark:text-white'
                    : 'bg-slate-100 text-slate-700 hover:text-slate-950 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-850">
        {filteredNotes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-500">
            {notes.length === 0 ? 'No notes yet. Create your first note.' : 'No notes match your filter.'}
          </div>
        ) : (
          filteredNotes.map((item) => {
            const isSelected = selectedNoteId === item.id;
            const updatedDate = new Date(item.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const previewSnippet =
              item.content.replace(/[#*`_>\[\]-]/g, '').trim().slice(0, 75) || 'Empty note';

            return (
              <div
                key={item.id}
                onClick={() => onSelectNote(item.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-zinc-900/90 text-slate-950 dark:text-white border-l-2 border-slate-900 dark:border-white'
                    : 'hover:bg-slate-50 dark:hover:bg-zinc-900/40 text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-950 dark:text-zinc-100 truncate pr-2">
                    {item.title || 'Untitled Note'}
                  </h4>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 shrink-0 font-medium">{updatedDate}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2">
                  {previewSnippet}
                </p>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800"
                      >
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">+{item.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
