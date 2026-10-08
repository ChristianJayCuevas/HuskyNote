import React, { useState } from 'react';
import type { AIContextChip } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { FileText, Mic, FileUp, Plus, X } from 'lucide-react';

interface ContextSelectorProps {
  selectedChips: AIContextChip[];
  onAddChip: (chip: AIContextChip) => void;
  onRemoveChip: (chipId: string) => void;
}

const icons = {
  note: FileText,
  meeting: Mic,
  document: FileUp,
};

const groups: Array<{ type: AIContextChip['type']; heading: string }> = [
  { type: 'note', heading: 'Notes' },
  { type: 'meeting', heading: 'Meetings' },
  { type: 'document', heading: 'Documents' },
];

/**
 * Context chips for the AI Workspace composer plus an "Add context" picker
 * (a popover with a searchable list of notes, meetings and documents).
 */
export const ContextSelector: React.FC<ContextSelectorProps> = ({
  selectedChips,
  onAddChip,
  onRemoveChip,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const notes = useLiveQuery(() => db.notes.toArray(), []) || [];
  const meetings = useLiveQuery(() => db.meetings.filter((m) => !m.mergedInto).toArray(), []) || [];
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
    <div className="flex flex-wrap items-center gap-1 px-2 pt-2">
      <Popover
        open={isPickerOpen}
        onOpenChange={(open) => {
          setIsPickerOpen(open);
          if (!open) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" className="text-muted-foreground" title="Attach Workspace Context">
            <Plus />
            <span>Add context</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-80 p-0"
          aria-label="Attach Workspace Context"
        >
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              placeholder="Search workspace entities..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {availableItems.length === 0
                  ? 'No notes, meetings, or documents in workspace yet.'
                  : 'No additional items match your query.'}
              </CommandEmpty>
              {groups.map(({ type, heading }) => {
                const items = filtered.filter((item) => item.type === type);
                if (items.length === 0) return null;
                const Icon = icons[type];
                return (
                  <CommandGroup key={type} heading={heading}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => {
                          onAddChip(item);
                          setIsPickerOpen(false);
                          setSearch('');
                        }}
                      >
                        <Icon />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedChips.map((chip) => {
        const Icon = icons[chip.type];
        return (
          <span
            key={chip.id}
            className="inline-flex h-6 max-w-[14rem] items-center gap-1 rounded-md bg-secondary pl-1.5 pr-0.5 text-xs font-medium text-secondary-foreground"
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{chip.title}</span>
            <button
              type="button"
              onClick={() => onRemoveChip(chip.id)}
              aria-label={`Remove ${chip.title} from context`}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
};
