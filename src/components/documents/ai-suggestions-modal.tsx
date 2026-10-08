import React, { useState } from 'react';
import type { SuggestedAnnotation, Annotation } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
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
      // design-exception: annotation colors are document content drawn on the page
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
      // design-exception: annotation colors are document content drawn on the page
      color: s.category === 'Warning' ? '#ef4444' : '#eab308',
      text: s.text,
      label: s.category,
      createdAt: Date.now(),
    }));

    onAcceptAnnotations(newAnnotations);
    onClose();
  };

  const categoryVariants: Record<SuggestedAnnotation['category'], 'destructive' | 'info' | 'secondary' | 'warning' | 'success'> = {
    Warning: 'destructive',
    Requirement: 'info',
    Step: 'secondary',
    Important: 'warning',
    Definition: 'success',
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
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <Sparkles className="mb-3 size-6 text-muted-foreground/70" strokeWidth={1.5} />
            <p className="max-w-sm text-sm text-muted-foreground">
              No specific steps, warnings, or definitions were automatically detected on this page.
            </p>
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {suggestions.map((sugg) => (
              <div
                key={sugg.id}
                className={cn(
                  'rounded-lg border px-3.5 py-3 transition-colors duration-100',
                  sugg.status === 'accepted' && 'border-ring/40 bg-accent/50',
                  sugg.status === 'rejected' && 'opacity-50'
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Badge variant={categoryVariants[sugg.category]}>{sugg.category}</Badge>

                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggleStatus(sugg.id, 'accepted')}
                      aria-pressed={sugg.status === 'accepted'}
                      className={cn(
                        'text-muted-foreground',
                        sugg.status === 'accepted' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      )}
                      title="Accept suggestion"
                      aria-label="Accept suggestion"
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggleStatus(sugg.id, 'rejected')}
                      aria-pressed={sugg.status === 'rejected'}
                      className={cn(
                        'text-muted-foreground',
                        sugg.status === 'rejected' && 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                      )}
                      title="Reject suggestion"
                      aria-label="Reject suggestion"
                    >
                      <X />
                    </Button>
                  </div>
                </div>

                <p className="text-sm leading-6 text-foreground">{sugg.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button size="sm" variant="outline" onClick={handleAcceptAll}>
            <CheckCheck />
            <span>Accept All ({suggestions.length})</span>
          </Button>

          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply Selected
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
