import React, { useState, useRef, useEffect } from 'react';
import { db } from '../db';
import type { Manual, ManualStep, Note } from '../types';
import { useWorkspace } from '../context/workspace-context';
import { useSound } from '../context/sound-context';
import { useAI } from '../context/ai-context';
import { ai } from '../services/ai/active-provider';
import { screenAnnotator, grabFrameFromStreamOrVideo } from '../services/screen/annotator';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { AudioRecorder } from '../services/audio/recorder';
import { LiveSpeechTranscriber, type TranscriptSegment } from '../services/audio/transcriber';
import {
  Video,
  Camera,
  Square,
  Play,
  Download,
  CameraOff,
  Sparkles,
  ArrowRight,
  Monitor,
  CheckCircle,
  Copy,
  FileText,
  Clock,
  Crosshair,
  Sliders,
  X,
  Mic,
  MicOff,
  Volume2,
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
  const { playThock, playChime, playPop } = useSound();
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
      playPop();
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
      playThock();
    } else {
      try {
        playPop();
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
    playThock(1.2);
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
    playPop();
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
    playChime();
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
    playPop();
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
    playPop();
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
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-canvas text-slate-900 dark:text-white p-6 sm:p-8 overflow-y-auto max-w-6xl mx-auto w-full select-none font-sans transition-colors duration-500">
      {/* Top Header Controls Card */}
      <div className="border-b border-slate-200 dark:border-zinc-850 pb-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-slate-900 dark:text-white" />
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
              Screen Recording Studio
            </h1>
            <Badge variant="outline">STEP RECORDER</Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
            Record your screen step-by-step with automatic screenshots and create helpful how-to guides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isRecording ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-950/80 border border-red-800 text-red-400 font-mono text-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>REC {formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Auto-Annotate Toggle */}
              <button
                onClick={() => setAutoAnnotateEnabled(!autoAnnotateEnabled)}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-all flex items-center gap-1.5 ${
                  autoAnnotateEnabled
                    ? 'bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-emerald-400 shadow-sm'
                    : 'bg-white dark:bg-zinc-950 dark:border-zinc-850 text-slate-500 dark:text-zinc-500'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>AUTO-ANNOTATE: {autoAnnotateEnabled ? `ON (${autoIntervalSec}s)` : 'OFF'}</span>
              </button>

              {/* Mic Toggle & Audio Level */}
              <button
                onClick={handleToggleMic}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-all flex items-center gap-1.5 ${
                  !isMicMuted
                    ? 'bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-950 dark:text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-950 dark:border-zinc-850 text-slate-500 dark:text-zinc-500'
                }`}
                title={isMicMuted ? 'Unmute microphone narration' : 'Mute microphone narration'}
              >
                {!isMicMuted ? <Mic className="w-3.5 h-3.5 text-slate-950 dark:text-white" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>MIC: {!isMicMuted ? 'LIVE' : 'MUTED'}</span>
                {!isMicMuted && (
                  <span className="flex items-center gap-0.5 ml-1">
                    <span
                      className="w-1 rounded-full bg-slate-900 dark:bg-white transition-all"
                      style={{ height: `${Math.max(4, Math.min(12, (audioLevel / 100) * 12))}px` }}
                    />
                  </span>
                )}
              </button>

              <Button variant="outline" size="sm" onClick={() => captureAnnotatedStep()}>
                <Camera className="w-3.5 h-3.5" />
                <span>Snap Step ({capturedSteps.length})</span>
              </Button>

              <Button variant="outline" size="sm" onClick={handleToggleWebcam}>
                {enableWebcam ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                <span>PIP Camera</span>
              </Button>

              <Button variant="danger" size="sm" onClick={handleStopRecording}>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Generate Documentation</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Procedure Session Title..."
                className="px-3 py-1.5 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-950 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-300 dark:focus:border-zinc-600 w-56"
              />

              <button
                onClick={() => setEnableMic(!enableMic)}
                className={`px-2.5 py-1.5 rounded text-xs font-mono border transition-all flex items-center gap-1.5 ${
                  enableMic
                    ? 'bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-950 dark:text-white'
                    : 'bg-white dark:bg-zinc-950 dark:border-zinc-850 text-slate-500 dark:text-zinc-500'
                }`}
                title={enableMic ? 'Microphone audio enabled' : 'Microphone audio disabled'}
              >
                {enableMic ? <Mic className="w-3.5 h-3.5 text-slate-950 dark:text-white" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>MIC {enableMic ? 'ON' : 'OFF'}</span>
              </button>

              <Button variant="primary" size="md" onClick={handleStartScreenStream}>
                <Monitor className="w-4 h-4" />
                <span>Start Screen Capture</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Canvas & Stream Box */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-2xl min-h-[460px] flex items-center justify-center">
        {hasScreenStream ? (
          <div className="relative w-full h-full flex items-center justify-center bg-slate-50 dark:bg-black">
            {/* Interactive Video Stream with Click-to-Annotate */}
            <video
              ref={(el) => {
                (screenVideoRef as any).current = el;
                if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                  el.muted = true;
                  el.srcObject = screenStreamRef.current;
                  el.play().catch(() => {});
                }
              }}
              className="max-h-[600px] w-auto max-w-full rounded-lg cursor-crosshair"
              autoPlay
              muted
              playsInline
              onClick={handleVideoClick}
              title="Click anywhere on screen stream to capture and annotate this point"
            />

            {/* Live speech transcription subtitle bar */}
            {!isMicMuted && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-xl w-[92%] px-4 py-2.5 rounded-xl bg-black/90 backdrop-blur-md border border-slate-900/20 dark:border-white/20 text-center z-20 shadow-2xl transition-all">
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-slate-600 dark:text-zinc-400 mb-1">
                  <span className={`w-2 h-2 rounded-full ${audioLevel > 15 ? 'bg-emerald-400 animate-ping' : 'bg-slate-400 dark:bg-zinc-500'}`} />
                  <span className="uppercase tracking-widest text-slate-700 dark:text-zinc-300 font-semibold">Live Speech Narration</span>
                  <span className="text-slate-400 dark:text-zinc-600">•</span>
                  <span className="text-[9px] text-slate-600 dark:text-zinc-400">Audio Level: {audioLevel}%</span>
                </div>
                <p className="text-xs text-slate-950 dark:text-white line-clamp-2 font-medium">
                  {currentInterimSpeech
                    ? `"${currentInterimSpeech}..."`
                    : liveTranscript.length > 0
                    ? `"${liveTranscript[liveTranscript.length - 1].text}"`
                    : <span className="text-slate-500 dark:text-zinc-500 italic">Speak into microphone to narrate action points in real time...</span>}
                </p>
              </div>
            )}

            {/* Visual Click Reticle Feedback */}
            {clickIndicator && (
              <div
                className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-30"
                style={{ left: clickIndicator.x, top: clickIndicator.y }}
              >
                <span className="flex h-10 w-10 relative items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 dark:bg-white opacity-50" />
                  <span className="relative inline-flex rounded-full h-6 w-6 border-2 border-white bg-black/80 text-[10px] text-white font-mono items-center justify-center">
                    {capturedSteps.length + 1}
                  </span>
                </span>
              </div>
            )}

            {/* Instruction Overlay Pill */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded-full text-xs font-mono shadow-xl flex items-center gap-2 backdrop-blur-md">
              <Crosshair className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Click stream to stamp annotation marker</span>
              <span className="text-slate-400 dark:text-zinc-600">•</span>
              <span className="text-slate-600 dark:text-zinc-400">Auto-captures every {autoIntervalSec}s</span>
            </div>

            {/* Picture-in-Picture Webcam Box */}
            {enableWebcam && (
              <div className="absolute bottom-6 right-6 w-48 h-36 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-black overflow-hidden shadow-2xl z-20">
                <video
                  ref={webcamVideoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                />
                <span className="absolute top-1.5 left-2 text-[9px] font-mono text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
                  CAM PIP
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center max-w-md space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 mx-auto">
              <Monitor className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              Screen Recording Studio
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Start recording your screen or window. As you demonstrate tasks,
              HuskyNote automatically captures steps and screenshots into an easy-to-follow guide.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <Button variant="primary" size="md" onClick={handleStartScreenStream}>
                <Play className="w-4 h-4" />
                <span>Start Screen Recording</span>
              </Button>
              <Button variant="outline" size="md" onClick={handleSimulateWorkflow}>
                <Sparkles className="w-4 h-4" />
                <span>Try Sample Guide</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Captured Keyframes Strip */}
      {capturedSteps.length > 0 && (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-zinc-400 uppercase">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Captured Steps ({capturedSteps.length})</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-500">Edit titles & notes before saving</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-x-auto pb-2">
            {capturedSteps.map((step, idx) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 space-y-2 shadow-lg transition-transform hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-zinc-400 border-b dark:border-zinc-850 pb-1">
                  <span className="font-bold text-slate-950 dark:text-white">STEP {step.stepNumber}</span>
                  <span className="text-slate-500 dark:text-zinc-500">{formatTimer(step.timestampSeconds)}</span>
                </div>
                <img
                  src={step.screenshotDataUrl}
                  alt={`Step ${step.stepNumber}`}
                  className="w-full h-24 object-cover rounded border dark:border-zinc-850"
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setCapturedSteps((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, title: newTitle } : s))
                    );
                  }}
                  className="w-full bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-950 dark:text-white focus:outline-none focus:border-slate-300 dark:focus:border-zinc-600 truncate"
                  placeholder="Step title..."
                />
                <textarea
                  value={step.description}
                  onChange={(e) => {
                    const newDesc = e.target.value;
                    setCapturedSteps((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, description: newDesc } : s))
                    );
                  }}
                  rows={2}
                  className="w-full bg-slate-50/40 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800/80 rounded p-1.5 text-[10px] text-slate-700 dark:text-zinc-300 font-mono focus:outline-none focus:border-slate-300 dark:focus:border-zinc-600 resize-none leading-tight"
                  placeholder="Step instruction..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentation Generation Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b dark:border-zinc-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-950 dark:text-white" />
                <h3 className="font-bold text-sm text-slate-950 dark:text-white">
                  Generated Standard Operating Documentation
                </h3>
              </div>
              <button
                onClick={() => setShowDocModal(false)}
                className="p-1 rounded text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content / Markdown View */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
              <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Captured {capturedSteps.length} steps with dynamic coordinate callouts.</span>
                </div>
                <span className="text-slate-500 dark:text-zinc-500 font-mono">Status: Ready to Export</span>
              </div>

              <div className="bg-slate-50 dark:bg-black border dark:border-zinc-850 rounded-xl p-4 font-mono text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap max-h-[420px] overflow-y-auto leading-relaxed">
                {generatedMarkdown}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t dark:border-zinc-850 bg-slate-50/60 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDocModal(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveDocumentation}
                  disabled={isSavingDoc}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isSavingDoc ? 'Saving...' : 'Save to Manuals & Notes'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
