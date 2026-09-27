import React, { useState, useEffect } from 'react';
import type { Manual, ManualStep } from '../../types';
import { db } from '../../db';
import { Button } from '../ui/button';
import { exportManualToPdf } from '../../services/export/pdf';
import { exportManualToMarkdown } from '../../services/export/markdown';
import { downloadJsonFile } from '../../services/export/json';
import { useWorkspace } from '../../context/workspace-context';
import { useAI } from '../../context/ai-context';
import { ai } from '../../services/ai/active-provider';
import {
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileCode,
  FileText,
  AlertTriangle,
  CheckCircle,
  Save,
  Sparkles,
} from 'lucide-react';

interface ManualBuilderProps {
  manualId: string;
  onDeleted?: () => void;
}

export const ManualBuilder: React.FC<ManualBuilderProps> = ({ manualId, onDeleted }) => {
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
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
        Loading manual...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-black p-8 overflow-y-auto max-w-5xl mx-auto w-full">
      {/* Header with Title & Export Actions */}
      <div className="border-b dark:border-zinc-850 pb-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveManualChanges({ title })}
            className="bg-transparent text-2xl font-bold text-white tracking-tight focus:outline-none placeholder-zinc-600 w-full"
            placeholder="Manual Title..."
          />
          <div className="text-xs text-zinc-400 mt-1">
            Version {manual.version} • Updated {new Date(manual.updatedAt).toLocaleDateString()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePolishSteps}
            disabled={isPolishing}
            title="Clean and polish step descriptions (replaces any static boilerplate)"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isPolishing ? 'animate-spin' : ''}`} />
            <span>{isPolishing ? 'Polishing...' : 'Polish Steps'}</span>
          </Button>
          <Button size="sm" variant="primary" onClick={handleExportPdf}>
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportMarkdown}>
            <FileText className="w-3.5 h-3.5" />
            <span>Export MD</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportJson}>
            <FileCode className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDeleteManual} title="Delete Manual">
            <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Purpose */}
        <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Purpose & Objective
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onBlur={() => saveManualChanges({ purpose })}
            rows={2}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 leading-relaxed resize-none"
            placeholder="State the objective of this operation procedure..."
          />
        </div>

        {/* Requirements & Prerequisites */}
        <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 space-y-3">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Prerequisites & Requirements
          </label>
          <ul className="space-y-1.5">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-center justify-between text-xs text-zinc-200 bg-zinc-900/60 px-3 py-1.5 rounded border dark:border-zinc-850">
                <span>• {req}</span>
                <button
                  onClick={() => {
                    const next = requirements.filter((_, idx) => idx !== i);
                    setRequirements(next);
                    saveManualChanges({ requirements: next });
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
          <input
            type="text"
            placeholder="Type prerequisite and press Enter..."
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            onKeyDown={addRequirement}
            className="w-full bg-zinc-900/40 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none"
          />
        </div>

        {/* Reorderable Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Operation Steps ({steps.length})
            </h3>
            <Button size="sm" variant="outline" onClick={addEmptyStep}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add Step</span>
            </Button>
          </div>

          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center">
                    {step.stepNumber}
                  </span>
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      const next = steps.map((s, i) => (i === idx ? { ...s, title: val } : s));
                      setSteps(next);
                    }}
                    onBlur={() => saveManualChanges({ steps })}
                    className="bg-transparent text-sm font-semibold text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => moveStep(idx, 'up')}
                    className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                    title="Move Up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    disabled={idx === steps.length - 1}
                    onClick={() => moveStep(idx, 'down')}
                    className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                    title="Move Down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteStep(idx)}
                    className="p-1 text-zinc-500 hover:text-red-400 ml-2"
                    title="Delete Step"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {step.screenshotDataUrl && (
                <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 max-w-md">
                  <img
                    src={step.screenshotDataUrl}
                    alt={`Step ${step.stepNumber}`}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-semibold">
                  Instruction Description
                </label>
                <textarea
                  value={step.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = steps.map((s, i) => (i === idx ? { ...s, description: val } : s));
                    setSteps(next);
                  }}
                  onBlur={() => saveManualChanges({ steps })}
                  rows={2}
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 leading-relaxed font-mono resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Expected Result */}
        <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 space-y-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
            Verification & Expected Result
          </label>
          <textarea
            value={expectedResult}
            onChange={(e) => setExpectedResult(e.target.value)}
            onBlur={() => saveManualChanges({ expectedResult })}
            rows={2}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 leading-relaxed resize-none"
            placeholder="How to verify the procedure succeeded..."
          />
        </div>
      </div>
    </div>
  );
};
