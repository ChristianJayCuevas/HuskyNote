import React, { useState } from 'react';
import type { DocumentEvidenceNote } from '../../services/documents/auto-annotator';
import { autoAnnotator } from '../../services/documents/auto-annotator';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import { Markdown } from '../ui/markdown';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { FileText, Download, Copy, Save, Trash2, ChevronDown, ChevronUp, Sparkles, Eye, EyeOff } from 'lucide-react';

interface DocumentNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  notes: DocumentEvidenceNote[];
  onRemoveNote: (id: string) => void;
  onClearNotes: () => void;
}

export const DocumentNotesModal: React.FC<DocumentNotesModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  notes,
  onRemoveNote,
  onClearNotes,
}) => {
  const { addToast, setActiveNoteId, setActiveView } = useWorkspace();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showScreenshots, setShowScreenshots] = useState(true);

  const toggleExpanded = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNotes(new Set(notes.map((n) => n.id)));
  };

  const collapseAll = () => {
    setExpandedNotes(new Set());
  };

  const handleDownloadMarkdown = () => {
    const md = autoAnnotator.compileNotesToMarkdown(notes, documentTitle);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Markdown notes downloaded.', 'success');
  };

  const handleDownloadPdf = () => {
    try {
      autoAnnotator.compileNotesToPdf(notes, documentTitle);
      addToast('PDF notes compiled and downloaded.', 'success');
    } catch {
      addToast('Failed to compile PDF.', 'error');
    }
  };

  const handleCopyMarkdown = async () => {
    const md = autoAnnotator.compileNotesToMarkdown(notes, documentTitle);
    try {
      await navigator.clipboard.writeText(md);
      addToast('Notes Markdown copied to clipboard.', 'success');
    } catch {
      addToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleSaveToWorkspace = async () => {
    if (notes.length === 0) return;

    try {
      const noteId = `note-doc-${Date.now()}`;
      const md = autoAnnotator.compileNotesToMarkdown(notes, documentTitle);

      await db.notes.put({
        id: noteId,
        title: `Notes: ${documentTitle}`,
        content: md,
        tags: ['document', 'auto-notes'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [
          {
            id: `v-${Date.now()}`,
            title: `Notes: ${documentTitle}`,
            content: md,
            timestamp: Date.now(),
          },
        ],
      });

      addToast('Saved compiled notes to workspace.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
      onClose();
    } catch {
      addToast('Failed to save notes to workspace.', 'error');
    }
  };

  // design-exception: these match the box colors the auto-annotator draws on each note's screenshot
  const stepColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="4xl" className="gap-0 p-0">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b px-6 py-4 pr-14 sm:flex-row sm:items-center sm:justify-between">
          <DialogHeader className="min-w-0 gap-0.5 pr-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              Document Notes
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {documentTitle} -- {notes.length} {notes.length === 1 ? 'note' : 'notes'} captured
            </DialogDescription>
          </DialogHeader>

          <div className="flex shrink-0 items-center gap-1">
            {notes.length > 1 && (
              <>
                <Button variant="ghost" size="xs" onClick={expandAll} className="text-muted-foreground">
                  Expand All
                </Button>
                <Button variant="ghost" size="xs" onClick={collapseAll} className="text-muted-foreground">
                  Collapse
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowScreenshots(!showScreenshots)}
              aria-pressed={showScreenshots}
              className="text-muted-foreground"
              title={showScreenshots ? 'Hide screenshots' : 'Show screenshots'}
              aria-label={showScreenshots ? 'Hide screenshots' : 'Show screenshots'}
            >
              {showScreenshots ? <Eye /> : <EyeOff />}
            </Button>
            {notes.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={onClearNotes}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <DialogBody className="mx-0 space-y-2 px-6 py-5">
          {notes.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
              <Sparkles className="mb-4 size-8 text-muted-foreground/70" strokeWidth={1.5} />
              <p className="text-base font-medium text-foreground">No Notes Captured Yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Click "Summarize Page", "Main Steps", or ask a question.
                HuskyNote will locate the referenced text, box it out, take a screenshot, and compile it here.
              </p>
            </div>
          ) : (
            notes.map((note, idx) => {
              const isExpanded = expandedNotes.has(note.id);
              const stepColor = stepColors[idx % stepColors.length];

              return (
                <div key={note.id} className="overflow-hidden rounded-lg border bg-card">
                  {/* Note header (click to expand/collapse) */}
                  <div className="flex items-center gap-1 pr-2 transition-colors duration-100 hover:bg-accent/50">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(note.id)}
                      aria-expanded={isExpanded}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold tabular-nums text-foreground"
                        style={{ borderColor: stepColor }}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{note.query}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">Page {note.pageNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{new Date(note.timestamp).toLocaleTimeString()}</span>
                        </span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemoveNote(note.id)}
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remove note"
                      aria-label="Remove note"
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  {/* Expandable content */}
                  {isExpanded && (
                    <div className="animate-fade-in space-y-4 border-t px-4 py-4">
                      {/* Referenced excerpt */}
                      {note.excerpt && (
                        <div className="space-y-1">
                          <span className="block text-xs font-medium text-muted-foreground">Referenced Excerpt</span>
                          <blockquote className="border-l-2 border-border pl-3 text-sm italic leading-6 text-foreground">
                            "{note.excerpt}"
                          </blockquote>
                        </div>
                      )}

                      {/* AI explanation */}
                      <div className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">Analysis</span>
                        <Markdown size="sm">{note.aiSummary}</Markdown>
                      </div>

                      {/* Annotated screenshot preview */}
                      {showScreenshots && note.screenshotDataUrl && (
                        <div className="space-y-1.5">
                          <span className="block text-xs font-medium text-muted-foreground">
                            Annotated Screenshot (Page {note.pageNumber})
                          </span>
                          <div className="flex max-h-72 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                            <img
                              src={note.screenshotDataUrl}
                              alt={`Page ${note.pageNumber} annotation`}
                              className="h-auto max-h-72 w-full object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </DialogBody>

        {/* Footer actions */}
        {notes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download />
                <span>Download .md</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download />
                <span>Download .pdf</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                <Copy />
                <span>Copy</span>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={handleSaveToWorkspace}>
                <Save />
                <span>Save to Notes</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
