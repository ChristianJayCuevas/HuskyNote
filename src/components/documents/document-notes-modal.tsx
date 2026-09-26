import React, { useState } from 'react';
import type { DocumentEvidenceNote } from '../../services/documents/auto-annotator';
import { autoAnnotator } from '../../services/documents/auto-annotator';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { useSound } from '../../context/sound-context';
import { Button } from '../ui/button';
import {
  FileText,
  Download,
  Copy,
  Save,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

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
  const { playPop, playThock } = useSound();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showScreenshots, setShowScreenshots] = useState(true);

  if (!isOpen) return null;

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
    playPop();
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
    playPop();
    try {
      autoAnnotator.compileNotesToPdf(notes, documentTitle);
      addToast('PDF notes compiled and downloaded.', 'success');
    } catch {
      addToast('Failed to compile PDF.', 'error');
    }
  };

  const handleCopyMarkdown = async () => {
    playPop();
    const md = autoAnnotator.compileNotesToMarkdown(notes, documentTitle);
    try {
      await navigator.clipboard.writeText(md);
      addToast('Notes Markdown copied to clipboard.', 'success');
    } catch {
      addToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleSaveToWorkspace = async () => {
    playThock(1.2);
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

  const stepColors = ['bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-zinc-850 flex items-center justify-center text-zinc-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Document Notes
              </h3>
              <p className="text-[11px] text-zinc-400">
                {documentTitle} -- {notes.length} {notes.length === 1 ? 'note' : 'notes'} captured
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notes.length > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="text-zinc-500 hover:text-zinc-200 text-[10px] px-2">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="text-zinc-500 hover:text-zinc-200 text-[10px] px-2">
                  Collapse
                </Button>
              </div>
            )}
            <button
              onClick={() => setShowScreenshots(!showScreenshots)}
              className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors"
              title={showScreenshots ? 'Hide screenshots' : 'Show screenshots'}
            >
              {showScreenshots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            {notes.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearNotes} className="text-zinc-500 hover:text-red-400">
                Clear All
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
          {notes.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 space-y-3 text-xs">
              <Sparkles className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-sm font-medium text-zinc-400">No Notes Captured Yet</p>
              <p className="max-w-md mx-auto text-zinc-500 leading-relaxed">
                Click "Summarize Page", "Main Steps", or ask a question.
                HuskyNote will locate the referenced text, box it out, take a screenshot, and compile it here.
              </p>
            </div>
          ) : (
            notes.map((note, idx) => {
              const isExpanded = expandedNotes.has(note.id);
              const colorClass = stepColors[idx % stepColors.length];

              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-zinc-850 bg-zinc-900/50 overflow-hidden shadow-lg transition-all duration-200"
                >
                  {/* Note Header (always visible, clickable to expand/collapse) */}
                  <button
                    onClick={() => toggleExpanded(note.id)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-900/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 h-5 rounded-full ${colorClass} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white truncate">{note.query}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-300">
                            PAGE {note.pageNumber}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(note.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveNote(note.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Remove note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60 pt-3 animate-fade-in">
                      {/* Referenced Excerpt Quote */}
                      {note.excerpt && (
                        <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-850 text-xs text-zinc-300 space-y-1">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                            Referenced Excerpt
                          </span>
                          <p className="italic leading-relaxed font-sans">
                            "{note.excerpt}"
                          </p>
                        </div>
                      )}

                      {/* AI Explanation */}
                      <div className="text-xs text-zinc-200 leading-relaxed space-y-1">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                          Analysis
                        </span>
                        <div className="whitespace-pre-wrap font-sans">{note.aiSummary}</div>
                      </div>

                      {/* Annotated Screenshot Preview */}
                      {showScreenshots && note.screenshotDataUrl && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                            Annotated Screenshot (Page {note.pageNumber})
                          </span>
                          <div className="rounded-lg border border-zinc-800 overflow-hidden bg-black max-h-72 flex items-center justify-center">
                            <img
                              src={note.screenshotDataUrl}
                              alt={`Page ${note.pageNumber} annotation`}
                              className="w-full h-auto max-h-72 object-contain"
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
        </div>

        {/* Footer Actions */}
        {notes.length > 0 && (
          <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download className="w-3.5 h-3.5" />
                <span>Download .pdf</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveToWorkspace}>
                <Save className="w-3.5 h-3.5" />
                <span>Save to Notes</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
