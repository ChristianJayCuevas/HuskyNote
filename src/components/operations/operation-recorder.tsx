import React, { useState, useRef, useEffect } from 'react';
import type { OperationStep, Manual, Note } from '../../types';
import { screenCapture } from '../../services/screen/capture';
import { screenAnnotator } from '../../services/screen/annotator';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';
import { ai } from '../../services/ai/active-provider';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Video,
  Square,
  Camera,
  BookOpen,
  Clock,
  Trash2,
  Sparkles,
  ArrowRight,
  Crosshair,
} from 'lucide-react';

interface OperationRecorderProps {
  onManualCreated: (manualId: string) => void;
  onCancel?: () => void;
}

export const OperationRecorder: React.FC<OperationRecorderProps> = ({
  onManualCreated,
  onCancel,
}) => {
  const { isConnected, selectedModel } = useAI();
  const { addToast } = useWorkspace();

  const [isRecording, setIsRecording] = useState(false);
  const [autoAnnotate, setAutoAnnotate] = useState(true);
  const [steps, setSteps] = useState<OperationStep[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Deployment Configuration Procedure');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);

  const timerRef = useRef<any>(null);
  const autoAnnotateTimerRef = useRef<any>(null);

  const handleStartCapture = async () => {
    const ok = await screenCapture.startCapture();
    if (!ok) {
      addToast('Screen capture was cancelled or not permitted.', 'warning');
      return;
    }

    setIsRecording(true);
    setSteps([]);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    addToast('Screen capture active. Dynamic auto-annotation will record key milestones.', 'info');
  };

  // Auto-annotate interval
  useEffect(() => {
    if (isRecording && autoAnnotate) {
      autoAnnotateTimerRef.current = setInterval(() => {
        handleCaptureStep();
      }, 8000);
    } else {
      if (autoAnnotateTimerRef.current) clearInterval(autoAnnotateTimerRef.current);
    }
    return () => {
      if (autoAnnotateTimerRef.current) clearInterval(autoAnnotateTimerRef.current);
    };
  }, [isRecording, autoAnnotate, steps.length]);

  const handleCaptureStep = async () => {
    const videoEl = screenCapture.getVideoElement();
    const stepNum = steps.length + 1;

    let snapshotDataUrl: string | null = null;
    let point = { x: 50, y: 50 };

    if (videoEl && videoEl.videoWidth) {
      const annotated = screenAnnotator.captureAndAnnotate(videoEl, {
        stepNumber: stepNum,
        timestampSeconds: elapsedSeconds,
        label: `STEP ${stepNum}`,
      });
      snapshotDataUrl = annotated.dataUrl;
      point = annotated.point;
    } else {
      snapshotDataUrl = screenCapture.takeSnapshot();
    }

    if (!snapshotDataUrl) {
      addToast('Could not grab video frame.', 'error');
      return;
    }

    let actionDescription = `Step ${stepNum}: Verify interaction at focal coordinate (${Math.round(point.x)}%, ${Math.round(point.y)}%).`;

    // If local Ollama is connected, query for a concise instructional description
    if (isConnected && selectedModel) {
      try {
        const descPrompt = `Provide a concise, formal single-sentence instruction for Step ${stepNum} in an operational manual titled "${sessionTitle}". Keep it direct and procedural.`;
        const res = await ai.generate(descPrompt, {
          model: selectedModel,
          temperature: 0.2,
        });
        if (res && res.trim()) {
          actionDescription = res.trim().replace(/^"|"$/g, '');
        }
      } catch {
        // use fallback
      }
    }

    const newStep: OperationStep = {
      id: `opstep-${Date.now()}-${stepNum}`,
      stepNumber: stepNum,
      timestamp: elapsedSeconds,
      screenshotDataUrl: snapshotDataUrl,
      actionDescription,
      annotations: [
        {
          id: `ann-${Date.now()}`,
          documentId: 'operation',
          pageNumber: 1,
          type: 'marker',
          coords: { x: point.x, y: point.y, width: 4, height: 4 },
          color: '#ffffff',
          label: `Step ${stepNum}`,
          stepNumber: stepNum,
          createdAt: Date.now(),
        },
      ],
    };

    setSteps((prev) => [...prev, newStep]);
    addToast(`Captured and annotated Step ${stepNum}.`, 'info');
  };

  const handleStopCapture = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoAnnotateTimerRef.current) clearInterval(autoAnnotateTimerRef.current);
    screenCapture.stopCapture();
    setIsRecording(false);
  };

  const handleBuildManual = async () => {
    if (steps.length === 0) {
      addToast('Capture at least one step to build a manual.', 'warning');
      return;
    }

    setIsGeneratingManual(true);
    try {
      const manualId = `manual-${Date.now()}`;
      const newManual: Manual = {
        id: manualId,
        title: sessionTitle.trim() || 'Standard Operating Manual',
        purpose: `Automated operation procedure manual generated from recorded session (${steps.length} steps).`,
        requirements: ['Verified environment credentials', 'Administrative authorization'],
        steps: steps.map((s) => ({
          id: `mstep-${s.stepNumber}`,
          stepNumber: s.stepNumber,
          title: `Step ${s.stepNumber}`,
          description: s.actionDescription,
          screenshotDataUrl: s.screenshotDataUrl,
        })),
        warnings: ['Verify configurations before committing changes.'],
        expectedResult: 'System procedure executed successfully.',
        troubleshooting: ['Review step screenshot annotations if UI elements differ.'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const md = screenAnnotator.generateSopMarkdown({
        title: sessionTitle.trim() || 'Standard Operating Manual',
        purpose: `Automated operation procedure manual generated from recorded session (${steps.length} steps).`,
        requirements: ['Verified environment credentials', 'Administrative authorization'],
        steps: steps.map((s) => ({
          stepNumber: s.stepNumber,
          title: `Step ${s.stepNumber}`,
          description: s.actionDescription,
          timestampMs: s.timestamp * 1000,
          screenshotDataUrl: s.screenshotDataUrl,
        })),
      });

      const newNote: Note = {
        id: `note-sop-${Date.now()}`,
        title: `${sessionTitle.trim() || 'Operation'} SOP Documentation`,
        content: md,
        tags: ['sop', 'manual', 'screen-capture'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [
          {
            id: `v-${Date.now()}`,
            title: `${sessionTitle.trim() || 'Operation'} SOP Documentation`,
            content: md,
            timestamp: Date.now(),
          },
        ],
      };

      await db.manuals.put(newManual);
      await db.notes.put(newNote);
      addToast('Operation manual and SOP documentation generated.', 'success');
      onManualCreated(manualId);
    } catch {
      addToast('Failed to create manual.', 'error');
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      {/* Header Controls Card */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              disabled={isRecording}
              className="bg-transparent text-xl font-bold text-white tracking-tight focus:outline-none placeholder-zinc-600 w-full"
              placeholder="Operation Session Name..."
            />
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              </span>
              <span>•</span>
              <span>{steps.length} steps recorded</span>
              <span>•</span>
              <span>Privacy: Local screen capture</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isRecording ? (
              <Badge variant="recording" dot>
                SCREEN SHARING ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline">STANDBY</Badge>
            )}

            {!isRecording ? (
              <div className="flex items-center gap-2">
                <Button variant="primary" size="md" onClick={handleStartCapture}>
                  <Video className="w-4 h-4" />
                  <span>Start Screen Capture</span>
                </Button>
                {onCancel && (
                  <Button variant="ghost" size="md" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoAnnotate(!autoAnnotate)}
                  className={`px-3 py-1.5 rounded text-xs font-mono border transition-all flex items-center gap-1.5 ${
                    autoAnnotate
                      ? 'bg-zinc-900 border-zinc-700 text-emerald-400'
                      : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>AUTO-ANNOTATE: {autoAnnotate ? 'ON' : 'OFF'}</span>
                </button>
                <Button variant="primary" size="md" onClick={handleCaptureStep}>
                  <Camera className="w-4 h-4" />
                  <span>Capture Step</span>
                </Button>
                <Button variant="danger" size="md" onClick={handleStopCapture}>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Sharing</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {isRecording && (
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex items-center justify-between">
            <span>
              Perform your operation on the shared window. Click <strong>"Capture Step"</strong> at each meaningful milestone to take a screenshot and generate instructions.
            </span>
          </div>
        )}
      </div>

      {/* Captured Steps Timeline */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Captured Steps ({steps.length})
          </h3>
          {steps.length > 0 && !isRecording && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleBuildManual}
              disabled={isGeneratingManual}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Generate Finished Manual</span>
            </Button>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-850 rounded-xl text-xs text-zinc-500">
            {isRecording
              ? 'Click "Capture Step" whenever you reach a meaningful action or screen state.'
              : 'Start screen capture to begin recording step screenshots.'}
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className="bg-zinc-950 border border-zinc-850 rounded-xl p-5 flex flex-col md:flex-row items-start gap-5"
              >
                {step.screenshotDataUrl && (
                  <div className="relative w-full md:w-64 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
                    <img
                      src={step.screenshotDataUrl}
                      alt={`Step ${step.stepNumber}`}
                      className="w-full h-auto object-cover"
                    />
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center shadow border border-black">
                      {step.stepNumber}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-100">
                      Step {step.stepNumber}
                    </span>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Delete step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <textarea
                    value={step.actionDescription}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSteps((prev) =>
                        prev.map((s) => (s.id === step.id ? { ...s, actionDescription: val } : s))
                      );
                    }}
                    rows={2}
                    className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 leading-relaxed font-mono resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
