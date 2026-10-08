import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import type { Manual, ManualStep, Note } from '../types';
import { useWorkspace } from '../context/workspace-context';
import { useAI } from '../context/ai-context';
import { ai } from '../services/ai/active-provider';
import { screenAnnotator, grabFrameFromStreamOrVideo } from '../services/screen/annotator';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { EmptyState } from '../components/ui/empty-state';
import { Markdown } from '../components/ui/markdown';
import { PageContainer, PageHeader } from '../components/ui/page';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { AudioRecorder } from '../services/audio/recorder';
import { LiveSpeechTranscriber, type TranscriptSegment } from '../services/audio/transcriber';
import {
  Camera,
  Square,
  Play,
  Download,
  CameraOff,
  Sparkles,
  Monitor,
  CheckCircle,
  Copy,
  FileText,
  Crosshair,
  Mic,
  MicOff,
  ChevronLeft,
} from 'lucide-react';

interface RecordedKeyframeStep {
  id: string;
  stepNumber: number;
  timestampSeconds: number;
  title: string;
  description: string;
  screenshotDataUrl: string;
  coords: { x: number; y: number };
}

export const StudioView: React.FC = () => {
  const { addToast, setActiveView, setActiveManualId } = useWorkspace();
  const { isConnected, selectedModel } = useAI();

  const [isRecording, setIsRecording] = useState(false);
  const [hasScreenStream, setHasScreenStream] = useState(false);
  const [enableWebcam, setEnableWebcam] = useState(false);
  const [autoAnnotateEnabled, setAutoAnnotateEnabled] = useState(true);
  const [autoIntervalSec, setAutoIntervalSec] = useState(8);
  const [sessionTitle, setSessionTitle] = useState('Standard Operating Procedure');
  const [capturedSteps, setCapturedSteps] = useState<RecordedKeyframeStep[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number } | null>(null);
  const [enableMic, setEnableMic] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<TranscriptSegment[]>([]);
  const [currentInterimSpeech, setCurrentInterimSpeech] = useState<string>('');

  // Documentation preview modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);
  const timerRef = useRef<any>(null);
  const autoCaptureTimerRef = useRef<any>(null);
  const lastConsumedSpeechIdxRef = useRef<number>(0);

  // Initialize audio recorder & speech transcriber
  useEffect(() => {
    audioRecorderRef.current = new AudioRecorder();
    speechTranscriberRef.current = new LiveSpeechTranscriber();

    return () => {
      audioRecorderRef.current?.stop();
      speechTranscriberRef.current?.stop();
    };
  }, []);

  // Reliably attach video stream whenever screen video element mounts
  useEffect(() => {
    if (hasScreenStream && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
      screenVideoRef.current.play().catch((e) => console.warn('[HuskyNote] Screen video play:', e));
    }
  }, [hasScreenStream]);

  // Reliably attach webcam stream whenever webcam element mounts
  useEffect(() => {
    if (enableWebcam && webcamVideoRef.current && webcamStreamRef.current) {
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
      webcamVideoRef.current.play().catch((e) => console.warn('[HuskyNote] Webcam video play:', e));
    }
  }, [enableWebcam]);

  // Timer counter
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Dynamic automatic annotation timer
  useEffect(() => {
    if (isRecording && autoAnnotateEnabled && autoIntervalSec > 0) {
      autoCaptureTimerRef.current = setInterval(() => {
        captureAnnotatedStep();
      }, autoIntervalSec * 1000);
    } else {
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    }
    return () => {
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    };
  }, [isRecording, autoAnnotateEnabled, autoIntervalSec, capturedSteps.length]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioRecorderRef.current?.stop();
      speechTranscriberRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    };
  }, []);

  // Request display media for screen capture
  const handleStartScreenStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });

      screenStreamRef.current = stream;
      setHasScreenStream(true);
      setIsRecording(true);
      setElapsedSeconds(0);
      setCapturedSteps([]);
      setLiveTranscript([]);
      setCurrentInterimSpeech('');
      lastConsumedSpeechIdxRef.current = 0;

      // Start microphone recording and real-time live transcription if enabled
      if (enableMic) {
        try {
          await audioRecorderRef.current?.start((lvl) => setAudioLevel(lvl));
          speechTranscriberRef.current?.setInputStream(audioRecorderRef.current?.getStream() ?? null);
          speechTranscriberRef.current?.start(
            (seg) => {
              setLiveTranscript((prev) => [...prev, seg]);
              setCurrentInterimSpeech('');
            },
            (interimText) => {
              setCurrentInterimSpeech(interimText);
            }
          );
        } catch (audioErr) {
          console.warn('[HuskyNote] Mic start optional fallback:', audioErr);
        }
      }

      // Stop automatically if user clicks native browser "Stop Sharing" button
      stream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

      addToast('Screen capture active. Real-time speech transcription & dynamic auto-annotation running.', 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Screen recording cancelled:', err?.message);
      addToast('Screen recording access was cancelled or not permitted.', 'warning');
    }
  };

  // Toggle webcam overlay
  const handleToggleWebcam = async () => {
    if (enableWebcam) {
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      setEnableWebcam(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: false,
        });
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play();
        }
        setEnableWebcam(true);
      } catch {
        addToast('Camera access denied or unavailable.', 'warning');
      }
    }
  };

  // Toggle mic mute/unmute
  const handleToggleMic = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    audioRecorderRef.current?.setMuted(nextMuted);
    addToast(nextMuted ? 'Microphone muted.' : 'Microphone unmuted.', 'info');
  };

  // Capture an annotated step (manual, automated, click-based, or simulated)
  const captureAnnotatedStep = async (explicitCoords?: { x: number; y: number }, customNote?: string) => {
    const stepNum = capturedSteps.length + 1;

    try {
      // 1. Safely acquire frame via ImageCapture from stream or video element
      let source: CanvasImageSource | null = null;
      if (screenStreamRef.current || screenVideoRef.current) {
        source = await grabFrameFromStreamOrVideo(
          screenStreamRef.current,
          screenVideoRef.current
        );
      }

      // 2. Burn dynamic annotations directly onto frame
      const { dataUrl, point } = screenAnnotator.captureAndAnnotate(source, {
        stepNumber: stepNum,
        point: explicitCoords,
        timestampSeconds: elapsedSeconds,
        label: `STEP ${stepNum}: ACTION`,
      });

      // 3. Priority 1: Gather REAL voice speech spoken since previous step
      const newSegments = liveTranscript.slice(lastConsumedSpeechIdxRef.current);
      const segmentTexts = newSegments.map((s) => s.text.trim()).filter(Boolean);
      if (currentInterimSpeech && currentInterimSpeech.trim()) {
        segmentTexts.push(currentInterimSpeech.trim());
      }
      lastConsumedSpeechIdxRef.current = liveTranscript.length;
      const realSpokenText = segmentTexts.join('. ').trim();

      let instruction = '';
      let stepTitle = `Action Point ${stepNum}`;

      if (customNote && customNote.trim()) {
        instruction = customNote.trim();
        stepTitle = customNote.trim().split(/\s+/).slice(0, 5).join(' ');
      } else if (realSpokenText) {
        // Use genuine voice transcript as the procedural description
        const cleanSpeech = realSpokenText.replace(/^(step\s*\d+[:.-]?\s*)/i, '').trim();
        instruction = cleanSpeech;
        const words = cleanSpeech.split(/\s+/);
        if (words.length <= 6) {
          stepTitle = cleanSpeech;
        } else {
          stepTitle = words.slice(0, 5).join(' ') + '...';
        }
      } else {
        // Priority 2: Real software action based on interaction coordinates (STRICTLY NO STATIC BOILERPLATE)
        let actionVerb = 'Interact with target element at';
        let categoryTitle = 'Action Point';

        if (point.y < 18) {
          actionVerb = 'Select top bar navigation / header control at';
          categoryTitle = 'Header Navigation';
        } else if (point.x < 25) {
          actionVerb = 'Open sidebar panel / menu item at';
          categoryTitle = 'Menu Selection';
        } else if (point.x > 75) {
          actionVerb = 'Adjust right panel utility / toggle control at';
          categoryTitle = 'Utility Settings';
        } else if (point.y > 80) {
          actionVerb = 'Execute action / confirm submission at';
          categoryTitle = 'Confirm Action';
        } else {
          const softwareActions = [
            { cat: 'Workspace Interaction', act: 'Focus and interact with active interface area at' },
            { cat: 'Data Input', act: 'Input information or select item in primary view at' },
            { cat: 'Execute Command', act: 'Trigger action sequence on workspace at' },
            { cat: 'Verify State', act: 'Review and confirm interface status at' },
          ];
          const chosen = softwareActions[(stepNum - 1) % softwareActions.length];
          categoryTitle = chosen.cat;
          actionVerb = chosen.act;
        }

        instruction = `${actionVerb} focal coordinate (${Math.round(point.x)}%, ${Math.round(point.y)}%).`;
        stepTitle = `${categoryTitle} ${stepNum}`;

        // Priority 3: If Ollama is available, generate a direct software instruction with STRICT anti-boilerplate rules
        if (isConnected && selectedModel) {
          try {
            const prompt = `You are an automated software documentation assistant for a computer screen recording titled "${sessionTitle}".
Step: ${stepNum}
Coordinate: (${Math.round(point.x)}%, ${Math.round(point.y)}%)
Timestamp: ${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, '0')}

CRITICAL RULES:
- You are documenting a computer software application screen.
- NEVER mention "equipment", "maintenance", "good condition", "inspection", or "Follow these steps".
- Output exactly ONE concise sentence (under 12 words) describing a concrete software interaction.`;

            const res = await ai.generate(prompt, {
              model: selectedModel,
              temperature: 0.7,
            });

            const candidate = res?.trim().replace(/^"|"$/g, '');
            // Reject any response containing generic equipment boilerplate
            if (candidate && !/equipment|maintenance|condition before|follow these steps/i.test(candidate)) {
              instruction = candidate;
              stepTitle = candidate.split(/\s+/).slice(0, 4).join(' ');
            }
          } catch {
            // Keep coordinate-based instruction
          }
        }
      }

      const newStep: RecordedKeyframeStep = {
        id: `step-${Date.now()}-${stepNum}`,
        stepNumber: stepNum,
        timestampSeconds: elapsedSeconds,
        title: stepTitle,
        description: instruction,
        screenshotDataUrl: dataUrl,
        coords: point,
      };

      setCapturedSteps((prev) => [...prev, newStep]);
      addToast(`Step ${stepNum} annotated and captured.`, 'info');
    } catch (err: any) {
      console.warn('[HuskyNote] Capture annotated step error:', err);
      addToast('Could not grab annotated frame.', 'error');
    }
  };

  // Simulate a demonstration workflow with 4 pristine annotated keyframes
  const handleSimulateWorkflow = () => {
    const demoSteps: RecordedKeyframeStep[] = [
      {
        id: `step-demo-1`,
        stepNumber: 1,
        timestampSeconds: 0,
        title: 'Initialize System Environment',
        description: 'Step 1: Open workspace settings and authenticate local hardware permissions.',
        coords: { x: 30, y: 35 },
        screenshotDataUrl: screenAnnotator.captureAndAnnotate(null, {
          stepNumber: 1,
          point: { x: 30, y: 35 },
          timestampSeconds: 0,
          label: 'STEP 1: CONFIG',
        }).dataUrl,
      },
      {
        id: `step-demo-2`,
        stepNumber: 2,
        timestampSeconds: 8,
        title: 'Verify Local Security Guardrails',
        description: 'Step 2: Confirm all voice recordings and screen snapshots are encrypted locally.',
        coords: { x: 65, y: 40 },
        screenshotDataUrl: screenAnnotator.captureAndAnnotate(null, {
          stepNumber: 2,
          point: { x: 65, y: 40 },
          timestampSeconds: 8,
          label: 'STEP 2: ENCRYPT',
        }).dataUrl,
      },
      {
        id: `step-demo-3`,
        stepNumber: 3,
        timestampSeconds: 16,
        title: 'Execute Action Sequences',
        description: 'Step 3: Trigger automated SOP workflow pipeline and compile focal coordinates.',
        coords: { x: 45, y: 60 },
        screenshotDataUrl: screenAnnotator.captureAndAnnotate(null, {
          stepNumber: 3,
          point: { x: 45, y: 60 },
          timestampSeconds: 16,
          label: 'STEP 3: EXECUTE',
        }).dataUrl,
      },
      {
        id: `step-demo-4`,
        stepNumber: 4,
        timestampSeconds: 24,
        title: 'Review SOP Documentation',
        description: 'Step 4: Inspect generated Standard Operating Procedure markdown report.',
        coords: { x: 50, y: 30 },
        screenshotDataUrl: screenAnnotator.captureAndAnnotate(null, {
          stepNumber: 4,
          point: { x: 50, y: 30 },
          timestampSeconds: 24,
          label: 'STEP 4: VERIFY',
        }).dataUrl,
      },
    ];

    setCapturedSteps(demoSteps);
    addToast('Simulated 4 dynamically annotated SOP keyframes.', 'success');
  };

  // Interactive click on video to capture exact coordinate
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!isRecording || !screenVideoRef.current) return;

    const rect = screenVideoRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    setClickIndicator({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setClickIndicator(null), 1000);

    captureAnnotatedStep({ x: clickX, y: clickY });
  };

  // Stop recording and open documentation generator modal
  const handleStopRecording = () => {
    setIsRecording(false);
    if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioRecorderRef.current?.stop();
    speechTranscriberRef.current?.stop();
    setHasScreenStream(false);
    setEnableWebcam(false);

    if (capturedSteps.length > 0) {
      // Synthesize full Markdown SOP
      const md = screenAnnotator.generateSopMarkdown({
        title: sessionTitle || 'Standard Operating Procedure',
        purpose: `Automated operation procedure manual generated via HuskyNote Studio recording. Captured ${capturedSteps.length} dynamically annotated procedural keyframes.`,
        requirements: ['Verified environment credentials', 'Administrative operational authorization'],
        steps: capturedSteps.map((s) => ({
          stepNumber: s.stepNumber,
          title: s.title,
          description: s.description,
          timestampMs: s.timestampSeconds * 1000,
          targetCoords: s.coords,
          screenshotDataUrl: s.screenshotDataUrl,
        })),
      });

      setGeneratedMarkdown(md);
      setShowDocModal(true);
      addToast('Screen capture finished. SOP documentation ready for review.', 'success');
    } else {
      addToast('Screen capture ended without any keyframe steps.', 'warning');
    }
  };

  // Save SOP to database (Manuals and Notes)
  const handleSaveDocumentation = async () => {
    if (capturedSteps.length === 0) return;
    setIsSavingDoc(true);

    try {
      const manualId = `manual-sop-${Date.now()}`;
      const noteId = `note-sop-${Date.now()}`;

      const manualSteps: ManualStep[] = capturedSteps.map((s) => ({
        id: `mstep-${s.stepNumber}`,
        stepNumber: s.stepNumber,
        title: s.title,
        description: s.description,
        screenshotDataUrl: s.screenshotDataUrl,
        annotations: [
          {
            id: `ann-${s.id}`,
            documentId: manualId,
            pageNumber: 1,
            type: 'marker',
            coords: { x: s.coords.x, y: s.coords.y, width: 4, height: 4 },
            // design-exception: marker color is stored annotation data, not UI styling
            color: '#ffffff',
            label: `Step ${s.stepNumber}`,
            stepNumber: s.stepNumber,
            createdAt: Date.now(),
          },
        ],
        timestampMs: s.timestampSeconds * 1000,
      }));

      const newManual: Manual = {
        id: manualId,
        title: sessionTitle.trim() || 'Standard Operating Procedure',
        purpose: `Standard Operating Procedure generated via HuskyNote Studio recording. Captured ${capturedSteps.length} procedural keyframes with dynamic annotations.`,
        requirements: ['Browser display access', 'Standard computer operational privileges'],
        steps: manualSteps,
        warnings: ['Verify configurations before committing changes.'],
        expectedResult: 'Screen operation captured and verified.',
        troubleshooting: ['Review step screenshot annotations if UI elements differ.'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      const newNote: Note = {
        id: noteId,
        title: `${sessionTitle.trim() || 'Operation'} SOP Documentation`,
        content: generatedMarkdown,
        tags: ['sop', 'manual', 'screen-recording'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [
          {
            id: `v-${Date.now()}`,
            title: `${sessionTitle.trim() || 'Operation'} SOP Documentation`,
            content: generatedMarkdown,
            timestamp: Date.now(),
          },
        ],
      };

      await db.manuals.put(newManual);
      await db.notes.put(newNote);

      addToast('Documentation saved to Manuals and Notes.', 'success');
      setShowDocModal(false);
      setActiveManualId(manualId);
      setActiveView('manuals');
    } catch {
      addToast('Failed to save documentation.', 'error');
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    const blob = new Blob([generatedMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sop.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Markdown SOP downloaded.', 'success');
  };

  // Copy Markdown to clipboard
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(generatedMarkdown);
      addToast('SOP Documentation copied to clipboard.', 'success');
    } catch {
      addToast('Could not copy to clipboard.', 'error');
    }
  };

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <PageContainer width="wide">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setActiveView('manuals')}
        className="-ml-2.5 mb-3 text-muted-foreground"
      >
        <ChevronLeft />
        Manuals
      </Button>

      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            Screen Recording Studio
            <Badge variant="outline" className="font-normal text-muted-foreground">
              Step recorder
            </Badge>
          </span>
        }
        description="Record your screen step-by-step with automatic screenshots and create helpful how-to guides."
        className="mb-6"
      />

      {/* Session controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isRecording ? (
          <>
            <Badge variant="destructive" dot className="h-7 px-2">
              Recording <span className="font-mono tabular-nums">{formatTimer(elapsedSeconds)}</span>
            </Badge>

            {/* Auto-annotate toggle */}
            <Button
              variant="outline"
              size="sm"
              aria-pressed={autoAnnotateEnabled}
              onClick={() => setAutoAnnotateEnabled(!autoAnnotateEnabled)}
              className={cn(!autoAnnotateEnabled && 'text-muted-foreground')}
            >
              <Crosshair />
              <span>Auto-annotate: {autoAnnotateEnabled ? `on (${autoIntervalSec}s)` : 'off'}</span>
            </Button>

            {/* Mic toggle and audio level */}
            <Button
              variant="outline"
              size="sm"
              aria-pressed={!isMicMuted}
              onClick={handleToggleMic}
              className={cn(isMicMuted && 'text-muted-foreground')}
              title={isMicMuted ? 'Unmute microphone narration' : 'Mute microphone narration'}
            >
              {!isMicMuted ? <Mic /> : <MicOff />}
              <span>Mic: {!isMicMuted ? 'live' : 'muted'}</span>
              {!isMicMuted && (
                <span aria-hidden="true" className="flex h-3 w-1 items-end overflow-hidden rounded-full bg-muted">
                  <span
                    className="w-full rounded-full bg-foreground transition-[height] duration-100"
                    style={{ height: `${Math.max(25, Math.min(100, audioLevel))}%` }}
                  />
                </span>
              )}
            </Button>

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button variant="outline" size="sm" onClick={() => captureAnnotatedStep()}>
                <Camera />
                <span>Snap Step ({capturedSteps.length})</span>
              </Button>

              <Button variant="outline" size="sm" onClick={handleToggleWebcam} aria-pressed={enableWebcam}>
                {enableWebcam ? <CameraOff /> : <Camera />}
                <span>PIP Camera</span>
              </Button>

              <Button variant="destructive" size="sm" onClick={handleStopRecording}>
                <Square className="fill-current" />
                <span>Stop & Generate Documentation</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Input
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Procedure Session Title..."
              aria-label="Procedure session title"
              className="w-full sm:w-56"
            />

            <Button
              variant="outline"
              aria-pressed={enableMic}
              onClick={() => setEnableMic(!enableMic)}
              className={cn(!enableMic && 'text-muted-foreground')}
              title={enableMic ? 'Microphone audio enabled' : 'Microphone audio disabled'}
            >
              {enableMic ? <Mic /> : <MicOff />}
              <span>{enableMic ? 'Mic on' : 'Mic off'}</span>
            </Button>

            <Button onClick={handleStartScreenStream}>
              <Monitor />
              <span>Start Screen Capture</span>
            </Button>
          </>
        )}
      </div>

      {/* Studio stage */}
      <div className="relative flex min-h-[460px] items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
        {hasScreenStream ? (
          // design-exception: media stage is black in both themes so recorded footage keeps its true colors
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            {/* Interactive video stream with click-to-annotate */}
            <video
              ref={(el) => {
                (screenVideoRef as any).current = el;
                if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                  el.muted = true;
                  el.srcObject = screenStreamRef.current;
                  el.play().catch(() => {});
                }
              }}
              className="max-h-[600px] w-auto max-w-full cursor-crosshair"
              autoPlay
              muted
              playsInline
              onClick={handleVideoClick}
              title="Click anywhere on screen stream to capture and annotate this point"
            />

            {/* Live speech transcription subtitle bar */}
            {!isMicMuted && (
              // design-exception: caption bar over video uses a dark scrim with light text in both themes
              <div className="absolute bottom-4 left-1/2 z-20 w-[92%] max-w-xl -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2.5 text-center text-white shadow-lg">
                <div className="mb-1 flex items-center justify-center gap-2 text-xs opacity-75">
                  <span
                    // design-exception: speaking indicator on the dark caption scrim
                    className={cn('size-2 rounded-full', audioLevel > 15 ? 'bg-success animate-pulse motion-reduce:animate-none' : 'bg-white/40')}
                  />
                  <span className="font-medium">Live Speech Narration</span>
                  <span aria-hidden="true">•</span>
                  <span className="tabular-nums">Audio Level: {audioLevel}%</span>
                </div>
                <p className="line-clamp-2 text-sm font-medium">
                  {currentInterimSpeech ? (
                    `"${currentInterimSpeech}..."`
                  ) : liveTranscript.length > 0 ? (
                    `"${liveTranscript[liveTranscript.length - 1].text}"`
                  ) : (
                    <span className="italic opacity-60">Speak into microphone to narrate action points in real time...</span>
                  )}
                </p>
              </div>
            )}

            {/* Visual click reticle feedback */}
            {clickIndicator && (
              <div
                className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                style={{ left: clickIndicator.x, top: clickIndicator.y }}
              >
                <span className="relative flex size-10 items-center justify-center">
                  {/* design-exception: click reticle drawn over live video */}
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-50" />
                  {/* design-exception: click reticle drawn over live video */}
                  <span className="relative inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-black/80 font-mono text-xs text-white">
                    {capturedSteps.length + 1}
                  </span>
                </span>
              </div>
            )}

            {/* Instruction overlay pill */}
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg">
              <Crosshair className="size-3.5 text-muted-foreground" />
              <span>Click stream to stamp annotation marker</span>
              <span aria-hidden="true" className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Auto-captures every {autoIntervalSec}s</span>
            </div>

            {/* Picture-in-picture webcam */}
            {enableWebcam && (
              // design-exception: camera preview sits on a black media background
              <div className="absolute bottom-6 right-6 z-20 h-36 w-48 overflow-hidden rounded-lg border bg-black shadow-lg">
                <video ref={webcamVideoRef} className="h-full w-full object-cover" autoPlay muted />
                {/* design-exception: label over camera video */}
                <span className="absolute left-2 top-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white/80">
                  CAM PIP
                </span>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            icon={Monitor}
            title="Screen Recording Studio"
            description="Start recording your screen or window. As you demonstrate tasks, HuskyNote automatically captures steps and screenshots into an easy-to-follow guide."
            className="py-12"
          >
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={handleStartScreenStream}>
                <Play />
                <span>Start Screen Recording</span>
              </Button>
              <Button variant="outline" onClick={handleSimulateWorkflow}>
                <Sparkles />
                <span>Try Sample Guide</span>
              </Button>
            </div>
          </EmptyState>
        )}
      </div>

      {/* Captured keyframes */}
      {capturedSteps.length > 0 && (
        <section className="mt-10 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Captured Steps <span className="font-normal tabular-nums text-muted-foreground">({capturedSteps.length})</span>
            </h2>
            <span className="text-xs text-muted-foreground">Edit titles & notes before saving</span>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {capturedSteps.map((step, idx) => (
              <div key={step.id} className="space-y-2 rounded-lg border bg-card p-2.5">
                <div className="flex items-center justify-between px-0.5 text-xs">
                  <span className="font-medium text-foreground">STEP {step.stepNumber}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{formatTimer(step.timestampSeconds)}</span>
                </div>
                <img
                  src={step.screenshotDataUrl}
                  alt={`Step ${step.stepNumber}`}
                  className="h-28 w-full rounded-md border object-cover"
                />
                <Input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setCapturedSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, title: newTitle } : s)));
                  }}
                  aria-label={`Step ${step.stepNumber} title`}
                  className="h-7 text-sm font-medium"
                  placeholder="Step title..."
                />
                <Textarea
                  value={step.description}
                  onChange={(e) => {
                    const newDesc = e.target.value;
                    setCapturedSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, description: newDesc } : s)));
                  }}
                  rows={3}
                  aria-label={`Step ${step.stepNumber} instruction`}
                  className="min-h-0 resize-none px-2 py-1.5 text-xs leading-5"
                  placeholder="Step instruction..."
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Generated documentation */}
      <Dialog open={showDocModal} onOpenChange={(open) => !open && setShowDocModal(false)}>
        <DialogContent size="3xl" className="gap-0 p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              Generated Standard Operating Documentation
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review the generated documentation, then copy, download, or save it to Manuals and Notes.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="mx-0 space-y-4 px-6 py-5">
            <Alert variant="success">
              <CheckCircle />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-foreground">
                <span>Captured {capturedSteps.length} steps with dynamic coordinate callouts.</span>
                <span className="text-xs text-muted-foreground">Status: Ready to Export</span>
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-card px-5 py-4">
              <SopPreview markdown={generatedMarkdown} />
            </div>
          </DialogBody>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                <Copy />
                <span>Copy Markdown</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download />
                <span>Download .md</span>
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDocModal(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleSaveDocumentation} disabled={isSavingDoc}>
                <CheckCircle />
                <span>{isSavingDoc ? 'Saving...' : 'Save to Manuals & Notes'}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

/**
 * Renders the generated SOP Markdown. Step screenshots are embedded as data: URLs, which the
 * shared Markdown renderer drops as unsafe, so they are split out and shown as images here.
 */
const SOP_IMAGE = /!\[([^\]]*)\]\((data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+)\)/g;

function SopPreview({ markdown }: { markdown: string }) {
  const parts = React.useMemo(() => {
    const out: Array<{ kind: 'md'; text: string } | { kind: 'img'; alt: string; src: string }> = [];
    let last = 0;
    for (const match of markdown.matchAll(SOP_IMAGE)) {
      const index = match.index ?? 0;
      if (index > last) out.push({ kind: 'md', text: markdown.slice(last, index) });
      out.push({ kind: 'img', alt: match[1], src: match[2] });
      last = index + match[0].length;
    }
    if (last < markdown.length) out.push({ kind: 'md', text: markdown.slice(last) });
    return out;
  }, [markdown]);

  return (
    <div className="space-y-4">
      {parts.map((part, i) =>
        part.kind === 'md' ? (
          part.text.trim() ? (
            <Markdown key={i} size="sm">
              {part.text}
            </Markdown>
          ) : null
        ) : (
          <img key={i} src={part.src} alt={part.alt} className="w-full max-w-lg rounded-md border" />
        )
      )}
    </div>
  );
}
