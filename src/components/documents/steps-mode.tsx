import React, { useState } from 'react';
import type { DocumentStep, Manual } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';
import { ai } from '../../services/ai/active-provider';
import { ListOrdered, Sparkles, Save, BookOpen } from 'lucide-react';

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
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-850 text-xs">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Source Excerpt (Page {sourcePage})
          </div>
          <p className="text-zinc-300 leading-relaxed max-h-28 overflow-y-auto italic">
            "{sourceText.slice(0, 300)}..."
          </p>
        </div>

        {!hasGenerated ? (
          <div className="py-8 text-center">
            <Button
              size="md"
              variant="primary"
              onClick={generateSteps}
              disabled={isLoading}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Analyzing Procedure...' : 'Generate Step-by-Step Sequence'}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {steps.map((step) => (
              <div
                key={step.stepNumber}
                className="p-4 rounded-lg bg-zinc-950 border border-zinc-850 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white tracking-wide">
                    STEP {step.stepNumber}: {step.title}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    Source: Page {step.sourcePage}
                  </span>
                </div>
                <p className="text-zinc-300 leading-relaxed">{step.explanation}</p>
                <div className="text-[11px] text-zinc-400 italic">
                  Excerpt: "{step.sourceText}"
                </div>
              </div>
            ))}
          </div>
        )}

        {hasGenerated && (
          <div className="pt-4 border-t border-zinc-850 flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveAsManual}>
              <BookOpen className="w-3.5 h-3.5" />
              <span>Create Operation Manual from Steps</span>
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
