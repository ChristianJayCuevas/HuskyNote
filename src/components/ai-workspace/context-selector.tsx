import React, { useState } from 'react';
import type { AIContextChip } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { FileText, Mic, FileUp, Plus, X, Search, Check } from 'lucide-react';

interface ContextSelectorProps {
  selectedChips: AIContextChip[];
  onAddChip: (chip: AIContextChip) => void;
  onRemoveChip: (chipId: string) => void;
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({
  selectedChips,
  onAddChip,
  onRemoveChip,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const notes = useLiveQuery(() => db.notes.toArray(), []) || [];
  const meetings = useLiveQuery(() => db.meetings.toArray(), []) || [];
  const documents = useLiveQuery(() => db.documents.toArray(), []) || [];

  const availableItems: AIContextChip[] = [
    ...notes.map((n) => ({
      id: `note-${n.id}`,
      type: 'note' as const,
      title: n.title || 'Untitled Note',
      content: n.content,
    })),
    ...meetings.map((m) => ({
      id: `meeting-${m.id}`,
      type: 'meeting' as const,
      title: m.title || 'Meeting Session',
      content: `${m.summary?.overview || ''}\n${m.transcript.map((t) => t.text).join(' ')}`,
    })),
    ...documents.map((d) => ({
      id: `doc-${d.id}`,
      type: 'document' as const,
      title: d.title || 'Uploaded Document',
      content: d.extractedPages.map((p) => p.text).join('\n'),
    })),
  ];

  const filtered = availableItems.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) &&
      !selectedChips.some((sc) => sc.id === item.id)
  );

  return (
    <div className="flex items-center gap-2 flex-wrap py-2 border-b dark:border-zinc-850 bg-zinc-950 px-6">
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        Context:
      </span>

      {selectedChips.length === 0 ? (
        <span className="text-xs text-zinc-500 italic">No context attached.</span>
      ) : (
        selectedChips.map((chip) => {
          const icons = {
            note: FileText,
            meeting: Mic,
            document: FileUp,
          };
          const Icon = icons[chip.type];

          return (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border dark:border-zinc-750 text-xs text-zinc-200 font-medium"
            >
              <Icon className="w-3.5 h-3.5 text-zinc-400" />
              <span className="truncate max-w-[150px]">{chip.title}</span>
              <button
                onClick={() => onRemoveChip(chip.id)}
                className="text-zinc-500 hover:text-white p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsModalOpen(true)}
        className="h-7 text-xs ml-auto"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Attach Context</span>
      </Button>

      {/* Attach Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Attach Workspace Context"
          description="Select real notes, meeting transcripts, or documents to ground your AI queries."
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search workspace entities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  {availableItems.length === 0
                    ? 'No notes, meetings, or documents in workspace yet.'
                    : 'No additional items match your query.'}
                </div>
              ) : (
                filtered.map((item) => {
                  const icons = {
                    note: FileText,
                    meeting: Mic,
                    document: FileUp,
                  };
                  const Icon = icons[item.type];

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onAddChip(item);
                        setIsModalOpen(false);
                      }}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border dark:border-zinc-850 dark:hover:bg-zinc-850 hover:border-zinc-700 cursor-pointer transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-zinc-400" />
                        <div>
                          <div className="font-semibold text-zinc-200">{item.title}</div>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                            {item.type}
                          </span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-zinc-400" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
