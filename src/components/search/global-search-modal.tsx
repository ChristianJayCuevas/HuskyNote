import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { Modal } from '../ui/modal';
import { Input } from '../ui/input';
import { Search, FileText, Mic, FileUp, Video, CornerDownLeft } from 'lucide-react';

const GROUPS: Array<{ type: SearchResultType; heading: string; icon: typeof FileText }> = [
  { type: 'note', heading: 'Notes', icon: FileText },
  { type: 'meeting', heading: 'Meetings', icon: Mic },
  { type: 'document', heading: 'Documents', icon: FileUp },
  { type: 'manual', heading: 'Guides', icon: Video },
];

type SearchResultType = 'note' | 'meeting' | 'document' | 'manual';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  targetId: string;
}

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    setActiveView,
    setActiveNoteId,
    setActiveMeetingId,
    setActiveDocumentId,
    setActiveManualId,
  } = useWorkspace();

  const [query, setQuery] = useState('');

  const rawNotes = useLiveQuery(() => db.notes.toArray(), []);
  const rawMeetings = useLiveQuery(() => db.meetings.filter((m) => !m.mergedInto).toArray(), []);
  const rawDocuments = useLiveQuery(() => db.documents.toArray(), []);
  const rawManuals = useLiveQuery(() => db.manuals.toArray(), []);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      return [];
    }

    const q = query.toLowerCase();
    const hits: SearchResult[] = [];
    const notes = rawNotes || [];
    const meetings = rawMeetings || [];
    const documents = rawDocuments || [];
    const manuals = rawManuals || [];

    // Search Notes
    notes.forEach((n) => {
      if (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        hits.push({
          id: `res-note-${n.id}`,
          type: 'note',
          title: n.title || 'Untitled Note',
          snippet: n.content.replace(/[#*`_>\[\]-]/g, '').slice(0, 100) + '...',
          targetId: n.id,
        });
      }
    });

    // Search Meetings
    meetings.forEach((m) => {
      const transcriptMatch = m.transcript.find((t) => t.text.toLowerCase().includes(q));
      if (
        m.title.toLowerCase().includes(q) ||
        m.manualNotes.toLowerCase().includes(q) ||
        transcriptMatch
      ) {
        hits.push({
          id: `res-meeting-${m.id}`,
          type: 'meeting',
          title: m.title || 'Meeting Session',
          snippet: transcriptMatch
            ? `Transcript: "${transcriptMatch.text.slice(0, 100)}..."`
            : m.summary?.overview?.slice(0, 100) || 'Meeting notes and timeline',
          targetId: m.id,
        });
      }
    });

    // Search Documents
    documents.forEach((d) => {
      const pageMatch = d.extractedPages.find((p) => p.text.toLowerCase().includes(q));
      if (d.title.toLowerCase().includes(q) || pageMatch) {
        hits.push({
          id: `res-doc-${d.id}`,
          type: 'document',
          title: d.title || 'Document',
          snippet: pageMatch
            ? `Page ${pageMatch.pageNumber}: "${pageMatch.text.slice(0, 100)}..."`
            : `${d.pageCount} page document`,
          targetId: d.id,
        });
      }
    });

    // Search Manuals
    manuals.forEach((m) => {
      const stepMatch = m.steps.find(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
      if (m.title.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q) || stepMatch) {
        hits.push({
          id: `res-manual-${m.id}`,
          type: 'manual',
          title: m.title || 'Operation Manual',
          snippet: stepMatch ? `Step ${stepMatch.stepNumber}: ${stepMatch.description.slice(0, 80)}...` : m.purpose,
          targetId: m.id,
        });
      }
    });

    return hits;
  }, [query, rawNotes, rawMeetings, rawDocuments, rawManuals]);

  const handleSelect = (hit: SearchResult) => {
    setIsSearchOpen(false);
    if (hit.type === 'note') {
      setActiveNoteId(hit.targetId);
      setActiveView('notes');
    } else if (hit.type === 'meeting') {
      setActiveMeetingId(hit.targetId);
      setActiveView('meetings');
    } else if (hit.type === 'document') {
      setActiveDocumentId(hit.targetId);
      setActiveView('documents');
    } else if (hit.type === 'manual') {
      setActiveManualId(hit.targetId);
      setActiveView('manuals');
    }
  };

  return (
    <Modal
      isOpen={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      maxWidth="2xl"
      title="Search workspace"
      description="Find notes, meetings, documents, and guides in this profile."
    >
      <div className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search across all notes, meetings, documents, and manuals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            data-dialog-autofocus
            aria-label="Search workspace content"
            className="h-9 pl-8"
          />
        </div>

        <div className="-mx-2 max-h-96 overflow-y-auto px-0.5">
          {query.trim() && results.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No matches found for "{query}".</div>
          ) : !query.trim() ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Type to search titles, text, transcripts, and pages.</p>
          ) : (
            GROUPS.map((group) => {
              const hits = results.filter((hit) => hit.type === group.type);
              if (hits.length === 0) return null;
              const Icon = group.icon;
              return (
                <div key={group.type} className="py-1">
                  <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">{group.heading}</div>
                  {hits.map((hit) => (
                    <button
                      type="button"
                      key={hit.id}
                      onClick={() => handleSelect(hit)}
                      className="group flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors duration-100 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{hit.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{hit.snippet}</span>
                      </span>
                      <CornerDownLeft aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
