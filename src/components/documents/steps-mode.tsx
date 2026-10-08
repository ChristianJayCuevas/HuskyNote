import React, { useState } from 'react';
import type { DocumentStep, Manual } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Spinner } from '../ui/spinner';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';
import { ai } from '../../services/ai/active-provider';
import { Sparkles, BookOpen } from 'lucide-react';

interface StepsModeProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  sourcePage: number;
  sourceText: string;
}

export const StepsModeModal: React.FC<StepsModeProps> = ({
  isOpen,
  onClose,
  documentTitle,
  sourcePage,
  sourceText,
}) => {
  const { selectedModel, isConnected } = useAI();
  const { addToast, setActiveView, setActiveManualId } = useWorkspace();

  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState<DocumentStep[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateSteps = async () => {
    if (!sourceText.trim()) return;
    setIsLoading(true);

    if (isConnected && selectedModel) {
      const prompt = `Convert the following document excerpt into a strict sequence of practical steps.
Do not invent steps that are not in the source text. Every step must have a concise title, an explanation, and source reference.

DOCUMENT EXCERPT (Source: Page ${sourcePage}):
${sourceText}

Respond ONLY with valid JSON in this exact structure, with no additional text:
{
  "steps": [
    {
      "stepNumber": 1,
      "title": "Concise imperative action title",
      "explanation": "Clear factual description of the operation step",
      "sourcePage": ${sourcePage},
      "sourceText": "Exact or near-exact sentence from the excerpt"
    }
  ]
}`;

      try {
        const res = await ai.generate(prompt, {
          model: selectedModel,
          temperature: 0.1,
        });

        const jsonMatch = res.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.steps)) {
            setSteps(parsed.steps);
            setHasGenerated(true);
            setIsLoading(false);
            return;
          }
        }
      } catch (err: any) {
        console.warn('[HuskyNote] AI step generation error:', err?.message);
      }
    }

    // Deterministic fallback from source sentences if AI unavailable
    const sentences = sourceText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    const fallbackSteps: DocumentStep[] = sentences.slice(0, 6).map((sent, idx) => ({
      stepNumber: idx + 1,
      title: `Step ${idx + 1}: ${sent.slice(0, 35)}...`,
      explanation: sent,
      sourcePage,
      sourceText: sent,
    }));

    setSteps(fallbackSteps);
    setHasGenerated(true);
    setIsLoading(false);
  };

  const handleSaveAsManual = async () => {
    try {
      const manualId = `manual-${Date.now()}`;
      const newManual: Manual = {
        id: manualId,
        title: `Procedure: ${documentTitle} (Page ${sourcePage})`,
        purpose: `Step-by-step operating procedure derived from ${documentTitle} (Page ${sourcePage}).`,
        requirements: ['Standard system access'],
        steps: steps.map((s) => ({
          id: `mstep-${s.stepNumber}`,
          stepNumber: s.stepNumber,
          title: s.title,
          description: s.explanation,
          notes: `Source: Page ${s.sourcePage}`,
        })),
        warnings: [],
        expectedResult: 'Operation procedure completed as specified.',
        troubleshooting: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await db.manuals.put(newManual);
      addToast('Saved steps as a new Operation Manual.', 'success');
      setActiveManualId(manualId);
      setActiveView('manuals');
      onClose();
    } catch {
      addToast('Failed to save manual.', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Turn into Steps"
      description={`Extract procedural operations from Page ${sourcePage} of "${documentTitle}"`}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Source Text Preview */}
        <div className="rounded-lg bg-muted px-4 py-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Source Excerpt (Page {sourcePage})</div>
          <p className="max-h-28 overflow-y-auto text-sm italic leading-6 text-foreground">"{sourceText.slice(0, 300)}..."</p>
        </div>

        {!hasGenerated ? (
          <div className="flex justify-center py-8">
            <Button onClick={generateSteps} disabled={isLoading}>
              {isLoading ? <Spinner className="text-current" aria-hidden="true" /> : <Sparkles />}
              <span>{isLoading ? 'Analyzing Procedure...' : 'Generate Step-by-Step Sequence'}</span>
            </Button>
          </div>
        ) : (
          <ol className="max-h-[50vh] space-y-1 overflow-y-auto">
            {steps.map((step) => (
              <li key={step.stepNumber} className="flex gap-3 rounded-lg px-1 py-3">
                <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground">
                  {step.stepNumber}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">
                      <span className="sr-only">Step {step.stepNumber}: </span>
                      {step.title}
                    </span>
                    <Badge variant="outline" className="tabular-nums text-muted-foreground">
                      Source: Page {step.sourcePage}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-foreground">{step.explanation}</p>
                  <p className="text-xs italic text-muted-foreground">Excerpt: "{step.sourceText}"</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {hasGenerated && (
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleSaveAsManual}>
              <BookOpen />
              <span>Create Operation Manual from Steps</span>
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
