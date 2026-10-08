import React, { useState, useEffect } from 'react';
import type { Manual, ManualStep } from '../../types';
import { db } from '../../db';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Spinner } from '../ui/spinner';
import { Toolbar, ToolbarGroup } from '../ui/toolbar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { exportManualToPdf } from '../../services/export/pdf';
import { exportManualToMarkdown } from '../../services/export/markdown';
import { downloadJsonFile } from '../../services/export/json';
import { useWorkspace } from '../../context/workspace-context';
import { useAI } from '../../context/ai-context';
import { ai } from '../../services/ai/active-provider';
import { Download, Plus, Trash2, ChevronUp, ChevronDown, ChevronLeft, FileCode, FileText, Sparkles } from 'lucide-react';

interface ManualBuilderProps {
  manualId: string;
  onDeleted?: () => void;
  /** Phones: return to the manuals list (the button is hidden from md up) */
  onBack?: () => void;
}

export const ManualBuilder: React.FC<ManualBuilderProps> = ({ manualId, onDeleted, onBack }) => {
  const { addToast } = useWorkspace();
  const { isConnected, selectedModel } = useAI();
  const [manual, setManual] = useState<Manual | null>(null);
  const [title, setTitle] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [steps, setSteps] = useState<ManualStep[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expectedResult, setExpectedResult] = useState('');
  const [troubleshooting, setTroubleshooting] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState('');
  const [warnInput, setWarnInput] = useState('');
  const [troubleInput, setTroubleInput] = useState('');

  // Load from DB
  useEffect(() => {
    let isMounted = true;
    async function load() {
      const data = await db.manuals.get(manualId);
      if (data && isMounted) {
        setManual(data);
        setTitle(data.title);
        setPurpose(data.purpose);
        setRequirements(data.requirements || []);
        setSteps(data.steps || []);
        setWarnings(data.warnings || []);
        setExpectedResult(data.expectedResult || '');
        setTroubleshooting(data.troubleshooting || []);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [manualId]);

  // Persist modifications
  const saveManualChanges = async (updates: Partial<Manual>) => {
    if (!manual) return;
    const nextManual: Manual = {
      ...manual,
      ...updates,
      updatedAt: Date.now(),
      version: manual.version + 1,
    };
    await db.manuals.put(nextManual);
    setManual(nextManual);
    addToast('Manual changes saved.', 'info');
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const nextSteps = [...steps];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nextSteps.length) return;

    const temp = nextSteps[index];
    nextSteps[index] = nextSteps[targetIdx];
    nextSteps[targetIdx] = temp;

    // Recalculate step numbers
    nextSteps.forEach((s, idx) => {
      s.stepNumber = idx + 1;
    });

    setSteps(nextSteps);
    saveManualChanges({ steps: nextSteps });
  };

  const deleteStep = (index: number) => {
    const nextSteps = steps.filter((_, idx) => idx !== index);
    nextSteps.forEach((s, idx) => {
      s.stepNumber = idx + 1;
    });
    setSteps(nextSteps);
    saveManualChanges({ steps: nextSteps });
  };

  const addEmptyStep = () => {
    const nextNum = steps.length + 1;
    const nextSteps = [
      ...steps,
      {
        id: `mstep-${Date.now()}`,
        stepNumber: nextNum,
        title: `Step ${nextNum}`,
        description: 'Describe the operation action here...',
      },
    ];
    setSteps(nextSteps);
    saveManualChanges({ steps: nextSteps });
  };

  const addRequirement = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && reqInput.trim()) {
      e.preventDefault();
      const next = [...requirements, reqInput.trim()];
      setRequirements(next);
      setReqInput('');
      saveManualChanges({ requirements: next });
    }
  };

  const addWarning = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && warnInput.trim()) {
      e.preventDefault();
      const next = [...warnings, warnInput.trim()];
      setWarnings(next);
      setWarnInput('');
      saveManualChanges({ warnings: next });
    }
  };

  const addTrouble = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && troubleInput.trim()) {
      e.preventDefault();
      const next = [...troubleshooting, troubleInput.trim()];
      setTroubleshooting(next);
      setTroubleInput('');
      saveManualChanges({ troubleshooting: next });
    }
  };

  const handleExportPdf = () => {
    if (!manual) return;
    exportManualToPdf({
      ...manual,
      title,
      purpose,
      requirements,
      steps,
      warnings,
      expectedResult,
      troubleshooting,
    });
    addToast('Exported manual to PDF.', 'success');
  };

  const handleExportMarkdown = () => {
    if (!manual) return;
    const md = exportManualToMarkdown({
      ...manual,
      title,
      purpose,
      requirements,
      steps,
      warnings,
      expectedResult,
      troubleshooting,
    });
    const filename = `${(title || 'manual').toLowerCase().replace(/\s+/g, '_')}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Exported manual to Markdown.', 'success');
  };

  const handleExportJson = () => {
    if (!manual) return;
    const currentData = {
      ...manual,
      title,
      purpose,
      requirements,
      steps,
      warnings,
      expectedResult,
      troubleshooting,
    };
    downloadJsonFile(
      `${(title || 'manual').toLowerCase().replace(/\s+/g, '_')}.json`,
      JSON.stringify(currentData, null, 2)
    );
    addToast('Exported manual to JSON.', 'success');
  };

  const handleDeleteManual = async () => {
    if (confirm('Permanently delete this operation manual?')) {
      await db.manuals.delete(manualId);
      addToast('Manual deleted.', 'info');
      if (onDeleted) onDeleted();
    }
  };

  const handlePolishSteps = async () => {
    setIsPolishing(true);
    addToast('Refining step instructions and replacing static boilerplate...', 'info');

    const updatedSteps = [...steps];
    for (let i = 0; i < updatedSteps.length; i++) {
      const step = updatedSteps[i];
      const hasBoilerplate =
        /equipment|condition before|follow these steps|initial setup|check the equipment/i.test(
          step.description
        );

      if (hasBoilerplate || !step.description.trim()) {
        let cleanDesc = '';
        if (isConnected && selectedModel) {
          try {
            const prompt = `Step ${step.stepNumber} of software manual "${title || 'Operation'}".
Step Title: "${step.title}".
CRITICAL RULE:
- NEVER mention "equipment", "maintenance", "condition before", or "Follow these steps".
- Output ONE direct software action sentence (max 12 words) describing what the user clicks or does on screen.`;
            const res = await ai.generate(prompt, { model: selectedModel, temperature: 0.6 });
            const cand = res?.trim().replace(/^"|"$/g, '');
            if (cand && !/equipment|maintenance|condition before|follow these steps/i.test(cand)) {
              cleanDesc = cand;
            }
          } catch {
            // fallback
          }
        }

        if (!cleanDesc) {
          const softwareVerbs = [
            'Click target element to configure interaction parameters.',
            'Select designated option from the active interface panel.',
            'Enter required information and confirm input action.',
            'Review interface response and proceed with next operation.',
            'Execute primary action button to apply changes.',
            'Verify updated workflow state on screen.',
            'Confirm final settings and conclude procedure.',
          ];
          cleanDesc = softwareVerbs[i % softwareVerbs.length];
        }

        updatedSteps[i] = {
          ...step,
          description: cleanDesc,
        };
      }
    }

    setSteps(updatedSteps);
    await saveManualChanges({ steps: updatedSteps });
    setIsPolishing(false);
    addToast('All steps polished with real software action instructions!', 'success');
  };

  if (!manual) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden="true" />
        Loading manual...
      </div>
    );
  }

  // Borderless, document-style fields (Notion-like inline editing)
  const inlineField =
    'w-full resize-none rounded-md bg-transparent outline-none transition-colors duration-100 placeholder:text-muted-foreground/60 hover:bg-accent/50 focus-visible:bg-accent/40 focus-visible:outline-none';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Detail header */}
      <Toolbar className="gap-1 px-2 sm:px-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-1 text-muted-foreground md:hidden" title="Back to manuals list">
            <ChevronLeft />
            <span>Manuals</span>
          </Button>
        )}
        <span className="hidden min-w-0 truncate text-xs tabular-nums text-muted-foreground sm:inline">
          Version {manual.version} • Updated {new Date(manual.updatedAt).toLocaleDateString()}
        </span>

        <ToolbarGroup className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePolishSteps}
            disabled={isPolishing}
            title="Clean and polish step descriptions (replaces any static boilerplate)"
          >
            {isPolishing ? <Spinner className="text-current" aria-hidden="true" /> : <Sparkles />}
            <span>{isPolishing ? 'Polishing...' : 'Polish Steps'}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download />
                <span>Export</span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={handleExportPdf}>
                <Download />
                <span>Export PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportMarkdown}>
                <FileText />
                <span>Export MD</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportJson}>
                <FileCode />
                <span>Export JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDeleteManual}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete Manual"
            aria-label="Delete Manual"
          >
            <Trash2 />
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {/* Document body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8 lg:px-12 lg:py-10">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveManualChanges({ title })}
            aria-label="Manual title"
            className={cn(inlineField, '-mx-2 px-2 py-1 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl')}
            placeholder="Manual Title..."
          />
          <p className="mt-2 text-xs tabular-nums text-muted-foreground sm:hidden">
            Version {manual.version} • Updated {new Date(manual.updatedAt).toLocaleDateString()}
          </p>

          {/* Purpose */}
          <div className="mt-6 space-y-1">
            <label htmlFor={`manual-purpose-${manualId}`} className="text-xs font-medium text-muted-foreground">
              Purpose & Objective
            </label>
            <textarea
              id={`manual-purpose-${manualId}`}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              onBlur={() => saveManualChanges({ purpose })}
              rows={2}
              className={cn(inlineField, '-mx-2 px-2 py-1.5 text-base leading-7 text-muted-foreground [field-sizing:content]')}
              placeholder="State the objective of this operation procedure..."
            />
          </div>

          {/* Requirements & prerequisites */}
          <section className="mt-10 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Prerequisites & Requirements</h2>
            {requirements.length > 0 && (
              <ul className="space-y-0.5">
                {requirements.map((req, i) => (
                  <li
                    key={i}
                    className="group -mx-2 flex min-h-8 items-center gap-2.5 rounded-md px-2 text-sm text-foreground transition-colors duration-100 hover:bg-accent/50"
                  >
                    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span className="min-w-0 flex-1">{req}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        const next = requirements.filter((_, idx) => idx !== i);
                        setRequirements(next);
                        saveManualChanges({ requirements: next });
                      }}
                      className="size-6 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 coarse:opacity-100"
                      title="Remove prerequisite"
                      aria-label={`Remove prerequisite: ${req}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Input
              type="text"
              placeholder="Type prerequisite and press Enter..."
              aria-label="Add prerequisite"
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
              onKeyDown={addRequirement}
            />
          </section>

          {/* Reorderable steps */}
          <section className="mt-10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Operation Steps <span className="font-normal tabular-nums text-muted-foreground">({steps.length})</span>
              </h2>
              <Button size="sm" variant="ghost" onClick={addEmptyStep}>
                <Plus />
                <span>Add Step</span>
              </Button>
            </div>

            <ol className="space-y-1">
              {steps.map((step, idx) => (
                <li key={step.id} className="group -mx-2 flex gap-4 rounded-lg px-2 py-4">
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground">
                    {step.stepNumber}
                  </span>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = steps.map((s, i) => (i === idx ? { ...s, title: val } : s));
                          setSteps(next);
                        }}
                        onBlur={() => saveManualChanges({ steps })}
                        aria-label={`Step ${step.stepNumber} title`}
                        className={cn(inlineField, '-mx-1.5 min-w-0 flex-1 px-1.5 py-0.5 text-base font-semibold text-foreground')}
                      />

                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100 coarse:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={idx === 0}
                          onClick={() => moveStep(idx, 'up')}
                          className="text-muted-foreground"
                          title="Move Up"
                          aria-label="Move Up"
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={idx === steps.length - 1}
                          onClick={() => moveStep(idx, 'down')}
                          className="text-muted-foreground"
                          title="Move Down"
                          aria-label="Move Down"
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteStep(idx)}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete Step"
                          aria-label="Delete Step"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    {step.screenshotDataUrl && (
                      <div className="max-w-md overflow-hidden rounded-md border bg-muted/40">
                        <img src={step.screenshotDataUrl} alt={`Step ${step.stepNumber}`} className="h-auto w-full object-cover" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label htmlFor={`manual-step-${step.id}`} className="text-xs font-medium text-muted-foreground">
                        Instruction Description
                      </label>
                      <Textarea
                        id={`manual-step-${step.id}`}
                        value={step.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = steps.map((s, i) => (i === idx ? { ...s, description: val } : s));
                          setSteps(next);
                        }}
                        onBlur={() => saveManualChanges({ steps })}
                        rows={2}
                        className="min-h-0 resize-none leading-6 [field-sizing:content]"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Expected result */}
          <section className="mt-8 space-y-2">
            <label htmlFor={`manual-result-${manualId}`} className="block text-base font-semibold text-foreground">
              Verification & Expected Result
            </label>
            <Textarea
              id={`manual-result-${manualId}`}
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              onBlur={() => saveManualChanges({ expectedResult })}
              rows={2}
              className="min-h-0 resize-none leading-6 [field-sizing:content]"
              placeholder="How to verify the procedure succeeded..."
            />
          </section>
        </div>
      </div>
    </div>
  );
};
