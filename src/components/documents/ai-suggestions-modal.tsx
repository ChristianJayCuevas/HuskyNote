import React, { useState } from 'react';
import type { SuggestedAnnotation, Annotation } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Check, X, Sparkles, CheckCheck } from 'lucide-react';

interface AISuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  currentPage: number;
  pageText: string;
  onAcceptAnnotations: (annotations: Annotation[]) => void;
}

export const AISuggestionsModal: React.FC<AISuggestionsModalProps> = ({
  isOpen,
  onClose,
  documentId,
  currentPage,
  pageText,
  onAcceptAnnotations,
}) => {
  // Extract heuristic or AI-based suggestions from page text
  const [suggestions, setSuggestions] = useState<SuggestedAnnotation[]>(() => {
    const list: SuggestedAnnotation[] = [];
    const lines = pageText.split(/(?<=[.!?])\s+|\n+/).filter((l) => l.trim().length > 15);

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();
      let category: SuggestedAnnotation['category'] | null = null;

      if (lower.includes('warning') || lower.includes('caution') || lower.includes('danger')) {
        category = 'Warning';
      } else if (lower.includes('step') || /^\d+[\.\)]/.test(line.trim())) {
        category = 'Step';
      } else if (lower.includes('require') || lower.includes('must') || lower.includes('prerequisite')) {
        category = 'Requirement';
      } else if (lower.includes('important') || lower.includes('note:') || lower.includes('notice')) {
        category = 'Important';
      } else if (lower.includes('is defined as') || lower.includes('means')) {
        category = 'Definition';
      }

      if (category && list.length < 6) {
        list.push({
          id: `sugg-${idx}-${Date.now()}`,
          pageNumber: currentPage,
          category,
          text: line.trim(),
          coords: {
            x: 8,
            y: Math.min(85, 12 + list.length * 14),
            width: 84,
            height: 8,
          },
          status: 'pending',
        });
      }
    });

    return list;
  });

  const handleToggleStatus = (id: string, status: 'accepted' | 'rejected') => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleApply = () => {
    const accepted = suggestions.filter((s) => s.status === 'accepted');
    const newAnnotations: Annotation[] = accepted.map((s, i) => ({
      id: `ann-${Date.now()}-${i}`,
      documentId,
      pageNumber: s.pageNumber,
      type: s.category === 'Warning' ? 'rectangle' : 'highlight',
      coords: s.coords,
      color: s.category === 'Warning' ? '#ef4444' : '#eab308',
      text: s.text,
      label: s.category,
      createdAt: Date.now(),
    }));

    onAcceptAnnotations(newAnnotations);
    onClose();
  };

  const handleAcceptAll = () => {
    const newAnnotations: Annotation[] = suggestions.map((s, i) => ({
      id: `ann-${Date.now()}-${i}`,
      documentId,
      pageNumber: s.pageNumber,
      type: s.category === 'Warning' ? 'rectangle' : 'highlight',
      coords: s.coords,
      color: s.category === 'Warning' ? '#ef4444' : '#eab308',
      text: s.text,
      label: s.category,
      createdAt: Date.now(),
    }));

    onAcceptAnnotations(newAnnotations);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Proposed Document Annotations"
      description={`AI analysis of Page ${currentPage}. Review, accept, or reject suggested callouts.`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-500">
            No specific steps, warnings, or definitions were automatically detected on this page.
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {suggestions.map((sugg) => {
              const colors = {
                Warning: 'text-red-400 bg-red-950/40 border-red-800/40',
                Requirement: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
                Step: 'text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700',
                Important: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
                Definition: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
              };

              return (
                <div
                  key={sugg.id}
                  className={`p-3.5 rounded-lg border text-xs transition-colors ${
                    sugg.status === 'accepted'
                      ? 'bg-slate-50/90 dark:bg-zinc-900/90 border-slate-300 dark:border-zinc-700'
                      : sugg.status === 'rejected'
                      ? 'opacity-40 bg-white dark:bg-zinc-950 dark:border-zinc-850'
                      : 'bg-white dark:bg-zinc-950 dark:border-zinc-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        colors[sugg.category]
                      }`}
                    >
                      {sugg.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(sugg.id, 'accepted')}
                        className={`p-1 rounded transition-colors ${
                          sugg.status === 'accepted'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-black'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Accept suggestion"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(sugg.id, 'rejected')}
                        className={`p-1 rounded transition-colors ${
                          sugg.status === 'rejected'
                            ? 'bg-slate-100 dark:bg-zinc-800 text-red-400'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Reject suggestion"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-zinc-300 leading-relaxed">{sugg.text}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t dark:border-zinc-850 flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={handleAcceptAll}>
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Accept All ({suggestions.length})</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleApply}>
              Apply Selected
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
