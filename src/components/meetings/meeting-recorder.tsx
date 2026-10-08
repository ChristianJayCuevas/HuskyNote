import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSpeechStatus } from '../ui/speech-status-indicator';
import type { TranscriptSegment, Meeting, MeetingScreenshot, ScheduleEvent } from '../../types';
import { AudioRecorder } from '../../services/audio/recorder';
import {
  LiveSpeechTranscriber,
  formatSecondsToTime,
  synthesizeMeetingAI,
  polishAndDiarizeTranscript,
} from '../../services/audio/transcriber';
import { speakerHookManager, cleanSpeakerName } from '../../services/audio/speaker-detector';
import {
  startVisualParticipantScanner,
  detectVisionModel,
} from '../../services/audio/visual-participant-scanner';
import {
  detectEventFromSentence,
  detectAllEventsInText,
  createScheduleEventFromMatch,
} from '../../services/calendar/event-detector';
import { notifyDetectedEvent } from '../../services/calendar/notification';
import { CalendarEventPromptModal } from '../calendar/calendar-event-prompt-modal';
import { db } from '../../db';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { Button, buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { Toolbar, ToolbarGroup } from '../ui/toolbar';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { NativeSelect } from '../ui/native-select';
import { Field } from '../ui/field';
import { Spinner } from '../ui/spinner';
import { StatusDot } from '../ui/status-dot';
import { cn } from '@/lib/utils';
import { ScreenshotLightbox } from './screenshot-lightbox';
import { speakerColorMap, speakerDotClass } from './speaker-colors';
import { GoogleMeetGuideModal } from './google-meet-guide-modal';
import { FloatingMeetingController } from './floating-meeting-controller';
import { MicrophonePicker } from '../ui/microphone-picker';
import { openMicrophone } from '../../services/audio/microphone';
import { ScreenSnipperOverlay, type CropRect } from './screen-snipper-overlay';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATION_TARGETS,
  translateTextAI,
  translateTranscriptSegments,
  getLanguageName,
  normalizeLanguageCode,
  detectLikelyLanguage,
} from '../../services/ai/translation';
import {
  Mic,
  Square,
  Radio,
  FileText,
  Clock,
  Sparkles,
  Camera,
  X,
  Image,
  Users,
  Wand2,
  Languages,
  ExternalLink,
  HardDrive,
  ChevronDown,
} from 'lucide-react';

interface MeetingRecorderProps {
  onMeetingSaved: (meeting: Meeting) => void;
  onCancel?: () => void;
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ onMeetingSaved, onCancel }) => {
  const { selectedModel, isConnected } = useAI();
  const { addToast } = useWorkspace();

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [manualNotes, setManualNotes] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('Meeting Title');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isMeetModalOpen, setIsMeetModalOpen] = useState(false);
  const [screenshots, setScreenshots] = useState<MeetingScreenshot[]>([]);
  const [previewScreenshot, setPreviewScreenshot] = useState<MeetingScreenshot | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSnipping, setIsSnipping] = useState(false);
  const [recordSource, setRecordSource] = useState<'mic' | 'tab'>('mic');
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Scheduled events detected by Local AI / speech transcription
  const [detectedEvents, setDetectedEvents] = useState<ScheduleEvent[]>([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [pendingSavedMeeting, setPendingSavedMeeting] = useState<Meeting | null>(null);

  // Speaker attribution, auto-hooking & AI transcription polish
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('You / Host');
  const [speakerRoster, setSpeakerRoster] = useState<string[]>(['You / Host']);
  const [detectedMeetingApp, setDetectedMeetingApp] = useState<string | null>(null);
  const [isPolishingAI, setIsPolishingAI] = useState<boolean>(false);

  // Multilingual Speech Recognition & AI Translation
  const [spokenLanguage, setSpokenLanguage] = useState<string>('auto');
  const [translationTarget, setTranslationTarget] = useState<string>('en'); // 'en' default: translates foreign/Filipino/Asian/European speech to English
  const [transcriptViewMode, setTranscriptViewMode] = useState<'dual' | 'translated' | 'original'>('dual');
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [shouldAutoOpenPiP, setShouldAutoOpenPiP] = useState<boolean>(false);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const pendingSpeech = useLiveQuery(async () => {
    if (!meetingIdRef.current) return { count: 0, seconds: 0 };
    let count = 0; let seconds = 0;
    await db.speechJobs.where('meetingId').equals(meetingIdRef.current).each((job) => { count++; seconds += job.audio.length / 16000; });
    return { count, seconds };
  }, [isRecording]);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);
  const timerIntervalRef = useRef<any>(null);
  // The timer reads the wall clock: duplicate intervals once ticked it 2-3x too fast
  const clockStartRef = useRef(0);
  const pausedMsRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);
  const stopAndSaveRef = useRef<() => Promise<void>>(async () => {});
  const readElapsed = () => {
    if (!clockStartRef.current) return 0;
    const pausedNow = pauseStartedRef.current ? Date.now() - pauseStartedRef.current : 0;
    return Math.max(0, Math.floor((Date.now() - clockStartRef.current - pausedMsRef.current - pausedNow) / 1000));
  };
  const resetClock = () => {
    clockStartRef.current = Date.now();
    pausedMsRef.current = 0;
    pauseStartedRef.current = null;
  };
  const transcriptBottomRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Hardware/Audio level diarization between Host Mic and Meeting Tab Audio
  const activeAudioChannelRef = useRef<'host' | 'remote' | 'unknown'>('unknown');
  const diarizerContextRef = useRef<AudioContext | null>(null);
  // Host mic opened for tab capture; muted separately from the mixed recording
  const tabMicStreamRef = useRef<MediaStream | null>(null);
  // Latest transcript for saving after the final phrases finish transcribing
  const transcriptRef = useRef<TranscriptSegment[]>([]);
  const announcedEventKeysRef = useRef<Set<string>>(new Set());
  const speechEngine = useSpeechStatus();
  const diarizerIntervalRef = useRef<any>(null);

  // Visual Participant Scanner — works without Chrome extension
  const visualScannerStopRef = useRef<(() => void) | null>(null);

  // Subscribe to automatic speaker hook events from meeting apps & extension
  useEffect(() => {
    const unsubscribe = speakerHookManager.subscribe((roster, app, activeSpeaker) => {
      if (roster && roster.length > 0) {
        setSpeakerRoster((prev) => {
          const nonHostReal = roster.filter((r) => r.toLowerCase() !== 'you / host');
          if (nonHostReal.length > 0) {
            const realName = nonHostReal[0];
            // Retroactively replace any generic 'Participant 2', 'Speaker 2', or 'Remote Participant' in transcript with the discovered real name
            setTranscript((curr) =>
              curr.map((seg) =>
                seg.speaker === 'Participant 2' ||
                /^speaker\s*\d*$/i.test(seg.speaker) ||
                seg.speaker === 'Remote Participant' ||
                seg.speaker === 'Guest'
                  ? { ...seg, speaker: realName }
                  : seg
              )
            );
            return [...new Set(['You / Host', ...nonHostReal])];
          }
          return [...new Set(['You / Host', ...prev, ...roster])];
        });
      }
      if (app) {
        setDetectedMeetingApp(app);
      }
      if (activeSpeaker && activeSpeaker.trim()) {
        setCurrentSpeaker(activeSpeaker.trim());
        speechTranscriberRef.current?.setActiveSpeaker(activeSpeaker.trim());
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Poll /api/meeting-sync ALWAYS (pre-recording + during recording) to discover participants early.
  // Runs at 800ms for fast detection. Handles participants AND activeSpeaker independently.
  useEffect(() => {
    const syncInterval = setInterval(() => {
      fetch('/api/meeting-sync')
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((data) => {
          if (!data) return;
          // Always pass participants if we have them (pre-recording roster build)
          if (Array.isArray(data.participants) && data.participants.length > 0) {
            speakerHookManager.handleIncomingPayload({
              type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
              app: data.app || detectedMeetingApp || 'Google Meet',
              participants: data.participants,
              activeSpeaker: data.activeSpeaker ?? undefined,
            });
          } else if (data.activeSpeaker) {
            // Even without participants list, update active speaker immediately
            speakerHookManager.handleIncomingPayload({
              type: 'HUSKYNOTE_ACTIVE_SPEAKER',
              app: data.app || detectedMeetingApp || 'Google Meet',
              activeSpeaker: data.activeSpeaker,
            });
          }
        })
        .catch(() => {});
    }, 800);

    return () => {
      clearInterval(syncInterval);
    };
  }, [detectedMeetingApp]);

  // Load user default speechLanguage setting if present
  useEffect(() => {
    db.settings.get('current').then((settings) => {
      if (settings?.speechLanguage) {
        setSpokenLanguage(settings.speechLanguage);
        speechTranscriberRef.current?.setLanguage(settings.speechLanguage);
      }
    }).catch(() => {});
  }, []);

  const handleIncomingInterim = (interim: string) => {
    setLiveInterimText(interim);
    if (activeAudioChannelRef.current === 'remote') {
      // Prefer DOM-detected active speaker, then any non-host roster member
      const domActive = speakerHookManager.getActiveSpeaker();
      const nonHost = speakerRoster.find(
        (s) =>
          s.toLowerCase() !== 'you / host' &&
          s !== 'Participant 2' &&
          s !== 'Remote Participant' &&
          !/^(?:speaker|participant)\s*\d*$/i.test(s)
      );
      const bestGuess = domActive && domActive !== 'You / Host' ? domActive : nonHost;
      if (bestGuess && currentSpeaker !== bestGuess) {
        setCurrentSpeaker(bestGuess);
        speechTranscriberRef.current?.setActiveSpeaker(bestGuess);
      }
    } else if (activeAudioChannelRef.current === 'host') {
      if (currentSpeaker !== 'You / Host') {
        setCurrentSpeaker('You / Host');
      }
    }
  };

  /**
   * Records a detected event once per date and time. Side effects stay outside
   * the state updater, which React may run more than once.
   */
  const announceDetectedEvent = (ev: ScheduleEvent): boolean => {
    const key = `${ev.date} ${ev.time}`;
    if (announcedEventKeysRef.current.has(key)) return false;
    announcedEventKeysRef.current.add(key);
    setDetectedEvents((prev) => (prev.some((e) => e.date === ev.date && e.time === ev.time) ? prev : [...prev, ev]));
    notifyDetectedEvent(ev);
    return true;
  };

  const handleIncomingSegment = (seg: TranscriptSegment) => {
    setLiveInterimText('');
    const rawText = seg.text;

    const channelHint =
      activeAudioChannelRef.current === 'remote'
        ? 'remote'
        : activeAudioChannelRef.current === 'host'
        ? 'host'
        : undefined;

    // Automatic Speaker Name Hook:
    // Attributes to real participant names from meeting apps, self-introductions, or question handoffs
    const hookResult = speakerHookManager.processSegment(rawText, currentSpeaker, speakerRoster, channelHint);
    const resolvedSpeaker = hookResult.assignedSpeaker;

    if (hookResult.isNewDetection && resolvedSpeaker !== currentSpeaker) {
      setCurrentSpeaker(resolvedSpeaker);
      speechTranscriberRef.current?.setActiveSpeaker(resolvedSpeaker);
    }
    if (hookResult.updatedRoster.length > speakerRoster.length) {
      setSpeakerRoster(hookResult.updatedRoster);
    }

    // Retroactively update recent generic segments when a new real speaker is identified
    if (hookResult.isNewDetection && resolvedSpeaker !== 'You / Host' && resolvedSpeaker !== 'Remote Participant') {
      setTranscript((prev) => {
        if (prev.length === 0) return prev;
        const lastSeg = prev[prev.length - 1];
        if (
          lastSeg &&
          (/^speaker\s*\d*$/i.test(lastSeg.speaker) ||
            lastSeg.speaker === 'You / Host' ||
            lastSeg.speaker === 'Participant 2' ||
            lastSeg.speaker === 'Remote Participant') &&
          Math.abs(seg.timestampSeconds - lastSeg.timestampSeconds) < 45
        ) {
          return prev.map((s, idx) => (idx === prev.length - 1 ? { ...s, speaker: resolvedSpeaker } : s));
        }
        return prev;
      });
    }

    const sourceLang = spokenLanguage === 'auto'
      ? (seg.sourceLanguage && seg.sourceLanguage !== 'auto' ? seg.sourceLanguage : detectLikelyLanguage(rawText))
      : normalizeLanguageCode(spokenLanguage);
    const targetLang = translationTarget;
    const shouldTranslate = targetLang !== 'none' && targetLang !== sourceLang;

    // Ensure active speaker name and language metadata are applied
    const enrichedSeg: TranscriptSegment = {
      ...seg,
      speaker: resolvedSpeaker,
      originalText: rawText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang !== 'none' ? targetLang : undefined,
      isTranslating: shouldTranslate,
    };

    setTranscript((prev) => [...prev, enrichedSeg]);

    // Check for calendar events in original text
    const match = detectEventFromSentence(rawText);
    if (match) {
      const ev = createScheduleEventFromMatch(match, {
        source: 'transcript',
        sourceTitle: meetingTitle.trim() || 'Meeting Title',
      });
      if (announceDetectedEvent(ev)) {
        addToast(`Scheduled Event detected: "${ev.title}" on ${ev.date} at ${ev.time}`, 'info');
      }
    }

    // Real-time asynchronous AI translation into target language
    if (shouldTranslate) {
      translateTextAI(rawText, sourceLang, targetLang, selectedModel)
        .then((translated) => {
          if (!translated) return;
          setTranscript((prev) =>
            prev.map((s) =>
              s.id === enrichedSeg.id
                ? {
                    ...s,
                    translation: translated,
                    isTranslating: false,
                  }
                : s
            )
          );

          // Check if translated text reveals scheduled event
          const translatedMatch = detectEventFromSentence(translated);
          if (translatedMatch) {
            const ev = createScheduleEventFromMatch(translatedMatch, {
              source: 'transcript',
              sourceTitle: meetingTitle.trim() || 'Meeting Title',
            });
            if (announceDetectedEvent(ev)) {
              addToast(`Scheduled Event detected from translation: "${ev.title}" on ${ev.date} at ${ev.time}`, 'info');
            }
          }
        })
        .catch((err) => {
          console.warn('[HuskyNote] Live translation error:', err);
          setTranscript((prev) =>
            prev.map((s) => (s.id === enrichedSeg.id ? { ...s, isTranslating: false } : s))
          );
        });
    }
  };

  const handleSpeakerChange = (speakerName: string) => {
    const cleaned = cleanSpeakerName(speakerName) || speakerName.trim();
    if (!cleaned) return;
    setCurrentSpeaker(cleaned);
    speakerHookManager.setActiveSpeaker(cleaned);
    speakerHookManager.addSpeaker(cleaned, 'manual');
    setSpeakerRoster((prev) => [...new Set([...prev, cleaned])]);
    speechTranscriberRef.current?.setActiveSpeaker(cleaned);
    addToast(`Active speaker set to: ${cleaned}`, 'info');
  };

  const handleRenameSpeaker = (oldName: string) => {
    const newName = window.prompt(`Rename all segments for "${oldName}" to:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const trimmed = newName.trim();
    setTranscript((prev) =>
      prev.map((s) => (s.speaker.toLowerCase() === oldName.toLowerCase() ? { ...s, speaker: trimmed } : s))
    );
    speakerHookManager.addSpeaker(trimmed, 'manual');
    setSpeakerRoster((prev) =>
      prev.map((s) => (s.toLowerCase() === oldName.toLowerCase() ? trimmed : s))
    );
    if (currentSpeaker.toLowerCase() === oldName.toLowerCase()) {
      handleSpeakerChange(trimmed);
    }
    addToast(`Renamed speaker "${oldName}" to "${trimmed}".`, 'success');
  };

  const handlePolishTranscript = async () => {
    if (!isConnected || !selectedModel || transcript.length === 0) {
      addToast('Local AI (Ollama) is offline or transcript is empty.', 'warning');
      return;
    }
    setIsPolishingAI(true);
    addToast('Local AI is refining transcript grammar & speaker diarization...', 'info');
    try {
      const polished = await polishAndDiarizeTranscript(transcript, selectedModel, speakerRoster);
      setTranscript(polished);
      addToast('Transcript polished with speaker diarization & grammar.', 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Polish error:', err);
      addToast('Failed to polish transcript with AI.', 'error');
    } finally {
      setIsPolishingAI(false);
    }
  };

  // Initialize instances
  useEffect(() => {
    audioRecorderRef.current = new AudioRecorder();
    speechTranscriberRef.current = new LiveSpeechTranscriber();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioRecorderRef.current?.isRecording()) {
        void audioRecorderRef.current.stop().catch(() => {});
      }
      speechTranscriberRef.current?.stop();
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
      if (visualScannerStopRef.current) {
        visualScannerStopRef.current();
        visualScannerStopRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (!meetingIdRef.current || !isRecording) return;
    const id = meetingIdRef.current;
    const timer = setTimeout(() => {
      void db.meetings.update(id, { title: meetingTitle, manualNotes, screenshots, durationSeconds: elapsedSeconds }).catch(() => {
        addToast('Could not save meeting notes. Check available storage.', 'error');
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [meetingTitle, manualNotes, screenshots, elapsedSeconds, isRecording]);

  const prepareMeeting = async () => {
    const id = crypto.randomUUID();
    meetingIdRef.current = id;
    const audioBlobId = `audio-${id}`;
    const now = Date.now();
    await db.meetings.put({ id, title: meetingTitle.trim() || 'Meeting recording', startTime: now,
      createdAt: now, durationSeconds: 0, audioBlobId, transcript: [], manualNotes, timeline: [], screenshots: [], spokenLanguage });
    stoppingRef.current = false;
    audioRecorderRef.current?.setPersistence(audioBlobId, () => {
      addToast('Audio storage stopped responding. Saving the meeting with the audio recorded so far.', 'error');
      void stopAndSaveRef.current();
    }, id);
    speechTranscriberRef.current?.setMeetingId(id);
  };

  // Auto-scroll transcript (only its own list: scrollIntoView would also scroll the page past the setup controls)
  useEffect(() => {
    const list = transcriptBottomRef.current?.parentElement;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [transcript]);

  // Timer interval handling pause / resume
  useEffect(() => {
    if (!isRecording || isPaused) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(readElapsed());
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  const handleBatchTranslate = async (targetLang: string) => {
    if (transcript.length === 0) return;
    if (!selectedModel) {
      addToast('Please select an AI model in settings to translate transcript.', 'warning');
      return;
    }
    setIsTranslatingAll(true);
    addToast(`Translating transcript to ${getLanguageName(targetLang)}...`, 'info');
    try {
      const updated = await translateTranscriptSegments(transcript, targetLang, selectedModel);
      setTranscript(updated);
      addToast(`Transcript translated to ${getLanguageName(targetLang)}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Batch translation error:', err);
      addToast('Failed to translate transcript.', 'error');
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const startRecording = async () => {
    try {
      setTranscript([]);
      setElapsedSeconds(0);
      resetClock();
      setScreenshots([]);

      await prepareMeeting();
      // Start audio stream & visualizer
      await audioRecorderRef.current?.start((level) => {
        setAudioLevel(level);
      });

      // Transcribe the same microphone stream that is being recorded
      speechTranscriberRef.current?.setInputStream(audioRecorderRef.current?.getStream() ?? null);
      speechTranscriberRef.current?.setLanguage(spokenLanguage);
      speechTranscriberRef.current?.start(handleIncomingSegment, handleIncomingInterim);

      setIsRecording(true);

      addToast(`Recording started (${getLanguageName(spokenLanguage)}).`, 'info');
    } catch (err: any) {
      console.error('[HuskyNote] Microphone permission denied or failed:', err);
      addToast(
        'Microphone access was denied. Please allow microphone permissions in your browser.',
        'error'
      );
    }
  };

  const handleStartTabCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Check if audio track was included
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        addToast(
          'No audio was shared. Pick a browser tab with "Also share tab audio" checked, or share your entire screen with "Share system audio" turned on (the option available in the desktop app).',
          'warning'
        );
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Keep the screen stream for screenshot capture
      setScreenStream(stream);

      // Setup hidden video element for frame capture
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.play();
      screenVideoRef.current = video;

      // Listen for stream end (user stops sharing)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setScreenStream(null);
        screenVideoRef.current = null;
      });

      setTranscript([]);
      setElapsedSeconds(0);
      resetClock();
      setScreenshots([]);
      setLiveInterimText('');
      setIsRecording(true);

      // Detect meeting app from track label
      const videoTrack = stream.getVideoTracks()[0];
      const trackLabel = (videoTrack?.label || '').toLowerCase();
      let appName = 'Google Meet';
      if (trackLabel.includes('teams')) appName = 'Microsoft Teams';
      else if (trackLabel.includes('zoom')) appName = 'Zoom';
      else if (trackLabel.includes('webex')) appName = 'Cisco Webex';
      else if (trackLabel.includes('slack')) appName = 'Slack Huddle';
      else if (trackLabel.includes('discord')) appName = 'Discord';
      setDetectedMeetingApp(appName);
      setShouldAutoOpenPiP(true);

      // Initialize speaker roster with actual host participant (no dummy names)
      setSpeakerRoster((prev) => {
        if (prev.length === 0) {
          return ['You / Host'];
        }
        return prev;
      });

      // Request host microphone to perform dual-channel hardware diarization (Host Mic vs Meeting Tab Audio)
      const micStream = await openMicrophone({ echoCancellation: true, noiseSuppression: true }).catch(() => null);
      tabMicStreamRef.current = micStream;

      // Tab + mic mixed into one stream that is both recorded and transcribed
      let mixedStream: MediaStream = new MediaStream([audioTracks[0]]);

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        diarizerContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
        const mixDestination = audioCtx.createMediaStreamDestination();

        const tabSource = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
        const tabAnalyser = audioCtx.createAnalyser();
        tabAnalyser.fftSize = 128;
        tabSource.connect(tabAnalyser);
        tabSource.connect(mixDestination);

        let micAnalyser: AnalyserNode | null = null;
        if (micStream && micStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micAnalyser = audioCtx.createAnalyser();
          micAnalyser.fftSize = 128;
          micSource.connect(micAnalyser);
          micSource.connect(mixDestination);
        }
        mixedStream = mixDestination.stream;

        const tabData = new Uint8Array(tabAnalyser.frequencyBinCount);
        const micData = micAnalyser ? new Uint8Array(micAnalyser.frequencyBinCount) : null;

        diarizerIntervalRef.current = setInterval(() => {
          tabAnalyser.getByteFrequencyData(tabData);
          let tabSum = 0;
          for (let i = 0; i < tabData.length; i++) tabSum += tabData[i];
          const tabAvg = tabSum / tabData.length;

          let micAvg = 0;
          if (micAnalyser && micData) {
            micAnalyser.getByteFrequencyData(micData);
            let micSum = 0;
            for (let i = 0; i < micData.length; i++) micSum += micData[i];
            micAvg = micSum / micData.length;
          }

          if (tabAvg > 8 && tabAvg > micAvg * 1.15) {
            activeAudioChannelRef.current = 'remote';
          } else if (micAvg > 8 && micAvg > tabAvg * 1.15) {
            activeAudioChannelRef.current = 'host';
          }
        }, 150);
      } catch (e) {
        console.warn('[HuskyNote] Audio diarizer setup error:', e);
      }

      // Record and transcribe the mixed tab + mic audio
      await prepareMeeting();
      await audioRecorderRef.current?.start((level) => setAudioLevel(level), mixedStream);
      speechTranscriberRef.current?.setInputStream(mixedStream);
      speechTranscriberRef.current?.setLanguage(spokenLanguage);
      speechTranscriberRef.current?.start(handleIncomingSegment, handleIncomingInterim);

      // ─── Visual Participant Scanner (no extension needed) ────────────────
      // Starts scanning screen frames with Ollama vision to auto-detect participant names.
      // Works with any meeting app visible on screen.
      if (visualScannerStopRef.current) {
        visualScannerStopRef.current(); // stop previous if any
      }
      detectVisionModel().then((model) => {
        if (model) {
          console.log(`[HuskyNote] Visual participant scanner started (${model})`);
          visualScannerStopRef.current = startVisualParticipantScanner(
            () => screenVideoRef.current,
            (names, source) => {
              addToast(`${names.length} participant(s) detected via screen scan`, 'info');
            }
          );
        } else {
          console.info('[HuskyNote] No vision model available — install llava-phi3 for extension-free speaker detection');
        }
      });

      addToast(`${appName} / Tab audio capture started with multi-speaker detection.`, 'info');
    } catch (err: any) {
      console.warn('[HuskyNote] Tab capture cancelled:', err?.message);
    }
  };

  /**
   * Capture a screenshot from the active screen share or prompt for one.
   * Uses the existing screen stream if available (from tab capture),
   * otherwise prompts for a new screen share to take a single snapshot.
   */
  const handleTakeScreenshot = async () => {
    try {
      let videoEl = screenVideoRef.current;

      // If no active screen share, prompt for one
      if (!videoEl || !videoEl.videoWidth) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' } as any,
          audio: false,
        });

        videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.muted = true;
        await videoEl.play();

        // Wait a frame for video to render
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));

        // Take the snapshot
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 1920;
        canvas.height = videoEl.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/png');

        // Stop the temporary stream
        stream.getTracks().forEach((t) => t.stop());
        videoEl.srcObject = null;

        const screenshot: MeetingScreenshot = {
          id: `ss-${Date.now()}`,
          timestampSeconds: elapsedSeconds,
          dataUrl,
        };
        setScreenshots((prev) => [...prev, screenshot]);
        addToast(`Screenshot captured at ${formatSecondsToTime(elapsedSeconds)}.`, 'success');
        return;
      }

      // Active screen share — capture frame directly
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 1920;
      canvas.height = videoEl.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = canvas.toDataURL('image/png');

      const screenshot: MeetingScreenshot = {
        id: `ss-${Date.now()}`,
        timestampSeconds: elapsedSeconds,
        dataUrl,
      };
      setScreenshots((prev) => [...prev, screenshot]);
      addToast(`Screenshot captured at ${formatSecondsToTime(elapsedSeconds)}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Screenshot capture cancelled:', err?.message);
      addToast('Screenshot capture was cancelled or denied.', 'warning');
    }
  };

  const removeScreenshot = (id: string) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (nextPaused) pauseStartedRef.current = Date.now();
    else if (pauseStartedRef.current) {
      pausedMsRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
    if (nextPaused) {
      speechTranscriberRef.current?.pause();
      addToast('Meeting recording paused.', 'info');
    } else {
      speechTranscriberRef.current?.resume();
      addToast('Meeting recording resumed.', 'info');
    }
  };

  const handleToggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (tabMicStreamRef.current) {
      // Tab capture: mute only the host mic, keep recording the meeting audio
      tabMicStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    } else {
      audioRecorderRef.current?.setMuted(nextMuted);
    }
    addToast(nextMuted ? 'Microphone muted.' : 'Microphone unmuted.', 'info');
  };

  const handleAddBookmark = (type: 'decision' | 'action' | 'highlight', note?: string) => {
    const timeStr = formatSecondsToTime(elapsedSeconds);
    const label = note || (type === 'decision' ? 'Agreed decision' : type === 'action' ? 'Action item' : 'Key highlight');
    setManualNotes((prev) => prev ? `${prev}\n- [${timeStr}] [${type.toUpperCase()}]: ${label}` : `- [${timeStr}] [${type.toUpperCase()}]: ${label}`);
    addToast(`Bookmarked [${type.toUpperCase()}] at ${timeStr}.`, 'success');
  };

  const handleAddQuickNote = (note: string) => {
    const timeStr = formatSecondsToTime(elapsedSeconds);
    setManualNotes((prev) => prev ? `${prev}\n- [${timeStr}] ${note}` : `- [${timeStr}] ${note}`);
    addToast(`Note added at ${timeStr}.`, 'success');
  };

  const handleCapturePortion = async (cropRect: CropRect) => {
    setIsSnipping(false);
    try {
      let videoEl = screenVideoRef.current;
      let tempStream: MediaStream | null = null;

      if (!videoEl || !videoEl.videoWidth) {
        tempStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' } as any,
          audio: false,
        });
        videoEl = document.createElement('video');
        videoEl.srcObject = tempStream;
        videoEl.muted = true;
        await videoEl.play();
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
      }

      const fullWidth = videoEl.videoWidth || window.innerWidth;
      const fullHeight = videoEl.videoHeight || window.innerHeight;

      // Scale coordinates from viewport to video resolution
      const scaleX = fullWidth / cropRect.viewportWidth;
      const scaleY = fullHeight / cropRect.viewportHeight;

      const sourceX = cropRect.x * scaleX;
      const sourceY = cropRect.y * scaleY;
      const sourceWidth = cropRect.width * scaleX;
      const sourceHeight = cropRect.height * scaleY;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth));
      canvas.height = Math.max(1, Math.round(sourceHeight));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          videoEl,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      if (tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }

      const dataUrl = canvas.toDataURL('image/png');
      const screenshot: MeetingScreenshot = {
        id: `snip-${Date.now()}`,
        timestampSeconds: elapsedSeconds,
        dataUrl,
        type: 'portion',
        cropDimensions: {
          width: Math.round(cropRect.width),
          height: Math.round(cropRect.height),
        },
        caption: `Portion Snip (${Math.round(cropRect.width)}×${Math.round(cropRect.height)}px)`,
      };

      setScreenshots((prev) => [...prev, screenshot]);
      addToast(`Portion snip captured at ${formatSecondsToTime(elapsedSeconds)}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Portion snip cancelled or failed:', err);
      addToast('Portion snip was cancelled.', 'info');
    }
  };

  const stopAndSaveMeeting = async () => {
    // A storage error and the Stop button can both end the meeting; save it once
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const finalElapsed = readElapsed();
    let recordingSaved: Meeting | null = null;
    // Stop listening first; phrases already captured keep transcribing while we wrap up
    const transcriptionDone = speechTranscriberRef.current?.stop() ?? Promise.resolve();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (diarizerIntervalRef.current) {
      clearInterval(diarizerIntervalRef.current);
      diarizerIntervalRef.current = null;
    }
    if (diarizerContextRef.current) {
      diarizerContextRef.current.close().catch(() => {});
      diarizerContextRef.current = null;
    }
    // Stop visual participant scanner
    if (visualScannerStopRef.current) {
      visualScannerStopRef.current();
      visualScannerStopRef.current = null;
    }
    activeAudioChannelRef.current = 'unknown';
    setShouldAutoOpenPiP(false);

    setIsRecording(false);
    setIsProcessingAI(true);

    // Stop screen stream if active
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      screenVideoRef.current = null;
    }

    try {
      // Stop audio recording and get blob. If audio storage failed, still save
      // the meeting: its saved chunks stay linked and can be finished later.
      let audioBlob: Blob | undefined;
      let audioProblem: string | null = null;
      try {
        audioBlob = await audioRecorderRef.current?.stop();
      } catch (error) {
        audioProblem = error instanceof Error ? error.message : String(error);
        console.error('[HuskyNote] Audio could not be finalized:', error);
      }
      tabMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      tabMicStreamRef.current = null;

      // Wait for the last phrases, but never let a stuck transcription block saving
      await Promise.race([Promise.resolve(transcriptionDone).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 15000))]);
      const meetingId = meetingIdRef.current ?? `meeting-${Date.now()}`;
      const storedMeeting = await db.meetings.get(meetingId);
      if (meetingIdRef.current && !storedMeeting?.audioBlobId) throw new Error('This recording has been deleted.');
      const byId = new Map((storedMeeting?.transcript ?? []).map((s) => [s.id, s]));
      transcriptRef.current.forEach((s) => byId.set(s.id, s));
      const transcript = [...byId.values()].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
      const now = Date.now();
      let audioBlobId: string | undefined;

      if (audioBlob && audioBlob.size > 0) audioBlobId = storedMeeting?.audioBlobId ?? `blob-${Date.now()}`;
      // Keep the link to saved chunks even when the final audio file could not be built
      else audioBlobId = storedMeeting?.audioBlobId;
      // Save a usable meeting before optional AI work. A synthesis failure must
      // not leave audio unlinked or make the transcript disappear.
      const savedDraft: Meeting = {
        id: meetingId, title: meetingTitle.trim() || 'Meeting Title',
        startTime: storedMeeting?.startTime ?? now - finalElapsed * 1000, endTime: now,
        durationSeconds: finalElapsed, audioBlobId, transcript, manualNotes,
        timeline: [], screenshots, createdAt: now, spokenLanguage,
        translationLanguage: translationTarget !== 'none' ? translationTarget : undefined,
      };
      await db.transaction('rw', db.meetings, db.blobs, async () => {
        // The recorder already stored its audio; only store it here if it did not
        if (audioBlobId && audioBlob && audioBlob.size > 0 && !(await db.blobs.get(audioBlobId))) {
          await db.blobs.put({ id: audioBlobId, data: audioBlob, mimeType: audioBlob.type, createdAt: now });
        }
        const current = await db.meetings.get(meetingId);
        if (meetingIdRef.current && !current?.audioBlobId) throw new Error('This recording has been deleted.');
        const merged = new Map((current?.transcript ?? []).map((s) => [s.id, s]));
        savedDraft.transcript.forEach((s) => merged.set(s.id, s));
        savedDraft.transcript = [...merged.values()].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
        await db.meetings.put(savedDraft);
      });
      addToast(audioProblem
        ? 'Transcript saved. Some audio could not be finished; open the meeting and choose Finish saving.'
        : 'Recording and transcript saved. Preparing meeting insights…', audioProblem ? 'warning' : 'success');
      recordingSaved = savedDraft;

      // Synthesize AI insights & extract events with target language support
      let summaryData;
      let timelineData;
      let allDetected: ScheduleEvent[] = [...detectedEvents];

      // Target language for synthesis: defaults to English ('en'), or user selected target
      const targetSummaryLang = translationTarget === 'none' ? 'en' : translationTarget;

      if (isConnected && selectedModel && (transcript.length > 0 || manualNotes.trim())) {
        const result = await synthesizeMeetingAI(
          transcript,
          manualNotes,
          selectedModel,
          meetingTitle.trim() || 'Meeting Title',
          targetSummaryLang
        );
        summaryData = result.summary;
        timelineData = result.timeline;

        for (const ev of result.detectedEvents) {
          if (!allDetected.some((e) => e.date === ev.date && e.time === ev.time)) {
            allDetected.push(ev);
          }
        }
      } else {
        // Fallback without AI: run offline NLP event detector on all text
        const combined = `${transcript.map((s) => s.translation || s.text).join(' ')}\n${manualNotes}`;
        const nlp = detectAllEventsInText(combined);
        for (const m of nlp) {
          const ev = createScheduleEventFromMatch(m, {
            source: 'meeting',
            sourceTitle: meetingTitle.trim() || 'Meeting Title',
          });
          if (!allDetected.some((e) => e.date === ev.date && e.time === ev.time)) {
            allDetected.push(ev);
          }
        }

        summaryData = {
          overview:
            transcript.length > 0
              ? `Meeting recorded with ${transcript.length} speech segment(s). No AI report yet.`
              : 'Meeting ended with manual notes. No AI report yet.',
          decisions: [],
          actionItems: [],
          topics: [],
          followUpTasks: [],
          summaryLanguage: targetSummaryLang,
          aiGenerated: false,
          aiError: 'No AI was connected when the meeting ended.',
        };
        timelineData = transcript.slice(0, 5).map((s, idx) => ({
          id: `tl-${idx}`,
          timestampSeconds: s.timestampSeconds,
          timeFormatted: formatSecondsToTime(s.timestampSeconds),
          label: (s.translation || s.text).slice(0, 45) + '...',
          type: 'topic' as const,
        }));
      }

      // Plot all detected events into HuskyNote schedule table
      if (allDetected.length > 0) {
        for (const ev of allDetected) {
          await db.schedule.put(ev);
        }
        setDetectedEvents(allDetected);
      }

      const newMeeting: Meeting = {
        id: meetingId,
        title: meetingTitle.trim() || 'Meeting Title',
        startTime: savedDraft.startTime,
        endTime: now,
        durationSeconds: finalElapsed,
        audioBlobId,
        transcript,
        manualNotes,
        timeline: timelineData,
        summary: summaryData,
        screenshots,
        createdAt: now,
        spokenLanguage,
        translationLanguage: translationTarget !== 'none' ? translationTarget : undefined,
      };

      await db.meetings.update(meetingId, { summary: summaryData, timeline: timelineData });
      addToast('Meeting recording and AI synthesis complete.', 'success');

      if (allDetected.length > 0) {
        setPendingSavedMeeting(newMeeting);
        setIsEventModalOpen(true);
      } else {
        onMeetingSaved(newMeeting);
      }
    } catch (err: any) {
      console.error('[HuskyNote] Failed to save meeting:', err);
      addToast(recordingSaved
        ? 'Recording and transcript are saved in Meetings. Insights could not be completed; retry from the meeting.'
        : 'Failed to save meeting data.', recordingSaved ? 'warning' : 'error');
      if (recordingSaved) onMeetingSaved(recordingSaved);
    } finally {
      setIsProcessingAI(false);
      clockStartRef.current = 0;
    }
  };
  stopAndSaveRef.current = stopAndSaveMeeting;

  // Generic "Speaker N" labels are shown as the host; dots use chart-1..5 in order of first appearance
  const displaySpeakerOf = (speaker: string) => (/^speaker\s*\d*$/i.test(speaker) ? 'You / Host' : speaker);
  const speakerColors = useMemo(
    () => speakerColorMap(transcript.map((s) => displaySpeakerOf(s.speaker))),
    [transcript]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background text-foreground">
      {/* ── Session toolbar: status and capture controls ── */}
      <Toolbar className="gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {isRecording ? (
            <Badge variant="destructive" dot>
              RECORDING
            </Badge>
          ) : (
            <Badge variant="outline">STANDBY</Badge>
          )}
          <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />
            {formatSecondsToTime(elapsedSeconds)}
          </span>
        </div>

        <ToolbarGroup className="ml-auto">
          {isRecording ? (
            <>
              {/* Pop-out Quick Navbar to Meeting Screen */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShouldAutoOpenPiP(true)}
                title="Pop out Always-on-Top Floating Quick Navbar on your meeting tab or screen"
              >
                <ExternalLink aria-hidden="true" />
                <span className="hidden sm:inline">Pop-out HUD</span>
              </Button>

              {/* Screenshot Capture Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTakeScreenshot}
                title="Capture a screenshot of the current screen"
              >
                <Camera aria-hidden="true" />
                <span className="hidden sm:inline">Screenshot</span>
              </Button>

              <Button variant="destructive" size="sm" onClick={stopAndSaveMeeting} disabled={isProcessingAI}>
                <Square className="fill-current" aria-hidden="true" />
                <span>End Meeting</span>
              </Button>
            </>
          ) : (
            onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )
          )}
        </ToolbarGroup>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-10 pt-8 sm:px-6 lg:px-10">
          {/* ── Title and meta ── */}
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            disabled={isRecording}
            className="w-full bg-transparent text-3xl font-bold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-default sm:text-4xl"
            placeholder="Meeting Title"
            aria-label="Meeting title"
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="size-3.5" aria-hidden="true" />
              Local storage
            </span>
            {isConnected && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span className="truncate">AI: {selectedModel}</span>
              </span>
            )}
            {screenshots.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Image className="size-3.5" aria-hidden="true" />
                {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Setup (before capture) / live input level (while recording) ── */}
          <div className="mt-6 rounded-lg border bg-card">
            <div className="p-4">
              {!isRecording ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Source choice: microphone or Meet / tab audio */}
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={recordSource}
                      onValueChange={(source) => source && setRecordSource(source as 'mic' | 'tab')}
                      aria-label="Recording source"
                    >
                      <ToggleGroupItem value="mic" title="Record from your microphone">
                        <Mic aria-hidden="true" />
                        <span>Mic</span>
                      </ToggleGroupItem>
                      <ToggleGroupItem value="tab" title="Capture Google Meet or tab audio">
                        <Radio aria-hidden="true" />
                        <span>Tab</span>
                      </ToggleGroupItem>
                    </ToggleGroup>

                    <div className="inline-flex items-stretch">
                      <Button
                        variant="default"
                        onClick={() => (recordSource === 'tab' ? setIsMeetModalOpen(true) : startRecording())}
                        className="rounded-r-none"
                      >
                        <Mic aria-hidden="true" />
                        <span>Start recording</span>
                      </Button>
                      {/* The chosen microphone is also the host mic for Google Meet / Tab capture */}
                      <MicrophonePicker
                        align="right"
                        triggerClassName={cn(
                          buttonVariants({ variant: 'default', size: 'icon' }),
                          'w-7 rounded-l-none border-l border-primary-foreground/20 focus-visible:ring-offset-0'
                        )}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground" role="status">
                    {speechEngine.state === 'ready' ? 'Transcription is ready on this device.'
                      : speechEngine.state === 'loading' ? 'The speech model is loading. Audio capture and transcript readiness are separate.'
                      : 'Set up and test transcription in Settings before relying on live text.'}
                    {' '}{recordSource === 'mic' ? 'Microphone permission is requested when you start.' : 'Choose a shared tab with audio when you start.'}
                  </p>
                </>
              ) : (
                /* Live audio level meter */
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Input level</span>
                  <div className="flex h-6 items-center gap-1" aria-hidden="true">
                    {[...Array(24)].map((_, i) => {
                      const threshold = (i / 24) * 100;
                      const active = audioLevel >= threshold;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'w-1 rounded-full transition-[height,background-color] duration-75',
                            active ? 'h-5 bg-foreground' : 'h-1.5 bg-input'
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Language chip: spoken language and translation target in one popover */}
            <div className="flex items-center gap-2 border-t px-2.5 py-1.5">
              <Popover open={isLangOpen} onOpenChange={setIsLangOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 max-w-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                    title="Spoken language and translation"
                  >
                    <Languages aria-hidden="true" />
                    <span className="truncate">
                      Language: {spokenLanguage === 'auto' ? 'Mixed / auto' : getLanguageName(spokenLanguage)}
                      {translationTarget !== 'none' && ` → ${getLanguageName(translationTarget)}`}
                    </span>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 space-y-4" aria-label="Language settings">
                  <Field label="Spoken language" htmlFor="meeting-spoken-language">
                    <NativeSelect
                      id="meeting-spoken-language"
                      value={spokenLanguage}
                      disabled={isRecording || isProcessingAI}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setSpokenLanguage(newLang);
                        speechTranscriberRef.current?.setLanguage(newLang);
                        const lName = SUPPORTED_LANGUAGES.find((l) => l.bcp47 === newLang)?.name || newLang;
                        addToast(`Speech recognition set to ${lName}`, 'info');
                      }}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.bcp47} value={lang.bcp47}>
                          {lang.code === 'fil' ? 'Filipino / Taglish' : lang.code === 'auto' ? 'Other / mixed languages (auto)' : lang.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Translate to" htmlFor="meeting-translate-to">
                    <NativeSelect
                      id="meeting-translate-to"
                      value={translationTarget}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setTranslationTarget(newTarget);
                        if (newTarget !== 'none') {
                          const tName = TRANSLATION_TARGETS.find((t) => t.code === newTarget)?.name || newTarget;
                          addToast(`Live AI translation set to ${tName}`, 'info');
                        } else {
                          addToast('Live translation disabled (Original text only)', 'info');
                        }
                      }}
                    >
                      {TRANSLATION_TARGETS.map((target) => (
                        <option key={target.code} value={target.code}>
                          {target.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* ── Screenshot thumbnails ── */}
          {screenshots.length > 0 && (
            <section className="mt-6">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Camera className="size-3.5" aria-hidden="true" />
                Screenshots ({screenshots.length})
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1 pr-2 pt-3">
                {screenshots.map((ss) => (
                  <div key={ss.id} className="group relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewScreenshot(ss)}
                      className="block overflow-hidden rounded-md border transition-colors duration-100 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={ss.dataUrl}
                        alt={`Screenshot at ${formatSecondsToTime(ss.timestampSeconds)}`}
                        className="h-16 w-28 bg-muted object-cover"
                      />
                    </button>
                    <span className="mt-1 block font-mono text-xs tabular-nums text-muted-foreground">
                      {formatSecondsToTime(ss.timestampSeconds)}
                    </span>
                    {isRecording && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScreenshot(ss.id);
                        }}
                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-xs transition-[opacity,background-color,color] duration-100 hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 coarse:opacity-100"
                        title="Remove screenshot"
                        aria-label="Remove screenshot"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Live transcript (left) and notes (right) ── */}
          <div className="mt-6 grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-[minmax(24rem,1fr)]">
            {/* Live Transcript Pane */}
            <section className="flex h-[28rem] min-h-0 flex-col overflow-hidden rounded-lg border bg-card md:h-auto">
              <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-4 py-1.5">
                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {isRecording ? (
                    <StatusDot tone="destructive" pulse />
                  ) : (
                    <Radio className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  Transcript
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {transcript.length} segments
                  {!!pendingSpeech?.count && <span> · {pendingSpeech.seconds > 10 ? 'Catching up: ' : ''}{Math.ceil(pendingSpeech.seconds)}s pending</span>}
                </span>

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {transcript.length > 0 && translationTarget !== 'none' && (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={transcriptViewMode}
                      onValueChange={(mode) => mode && setTranscriptViewMode(mode as 'dual' | 'translated' | 'original')}
                      aria-label="Transcript view mode"
                    >
                      {(['dual', 'translated', 'original'] as const).map((mode) => (
                        <ToggleGroupItem
                          key={mode}
                          value={mode}
                          className="h-6 px-2 text-xs"
                          title={
                            mode === 'dual'
                              ? 'Show both original spoken language and translated text'
                              : mode === 'translated'
                              ? 'Show translated text only'
                              : 'Show original spoken text only'
                          }
                        >
                          {mode === 'dual' ? 'Dual' : mode === 'translated' ? 'Translation' : 'Original'}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}

                  {transcript.length > 0 && translationTarget !== 'none' && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleBatchTranslate(translationTarget)}
                      disabled={isTranslatingAll}
                      title="Translate all transcript segments using Local AI"
                    >
                      <Languages className={cn('text-muted-foreground', isTranslatingAll && 'animate-spin')} aria-hidden="true" />
                      <span>{isTranslatingAll ? 'Translating...' : `Translate (${translationTarget.toUpperCase()})`}</span>
                    </Button>
                  )}

                  {transcript.length > 0 && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handlePolishTranscript}
                      disabled={isPolishingAI}
                      title="Use Local AI to clean grammar and diarize speaker turns"
                    >
                      <Wand2 className={cn('text-muted-foreground', isPolishingAI && 'animate-spin')} aria-hidden="true" />
                      <span>{isPolishingAI ? 'Diarizing...' : 'AI Polish'}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Active speaker hook & switcher */}
              {isRecording && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-3.5" aria-hidden="true" />
                    <span>Speaking now:</span>
                  </span>
                  {detectedMeetingApp && (
                    <Badge variant="success" dot>
                      Hooked: {detectedMeetingApp}
                    </Badge>
                  )}
                  <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
                    {speakerRoster.map((spk) => {
                      const isActive = currentSpeaker.toLowerCase() === spk.toLowerCase();
                      return (
                        <Button
                          key={spk}
                          size="xs"
                          variant={isActive ? 'default' : 'secondary'}
                          aria-pressed={isActive}
                          onClick={() => handleSpeakerChange(spk)}
                        >
                          {spk}
                        </Button>
                      );
                    })}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        const custom = window.prompt('Enter speaker / participant name:');
                        if (custom && custom.trim()) handleSpeakerChange(custom.trim());
                      }}
                      className="border border-dashed border-input text-muted-foreground"
                      title="Manually add a participant to the speaker roster"
                    >
                      + Add Speaker
                    </Button>
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 space-y-px overflow-y-auto p-2">
                {/* Real-time interim phrase */}
                {liveInterimText && (
                  <div className="mb-1 rounded-md border border-dashed px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <StatusDot tone="success" pulse />
                      <span className="font-medium text-foreground">{currentSpeaker}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="italic text-muted-foreground">speaking now (live)...</span>
                    </div>
                    <p className="mt-0.5 text-sm italic leading-6 text-muted-foreground">
                      {liveInterimText}
                    </p>
                  </div>
                )}

                {transcript.length === 0 && !liveInterimText ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                    {isRecording ? (
                      <>
                        <Mic className="size-5 animate-pulse text-muted-foreground" aria-hidden="true" />
                        <span className="max-w-xs">
                          {speechEngine.state === 'loading'
                            ? 'Preparing the on-device speech model. Audio is being captured and will be transcribed once it is ready.'
                            : speechEngine.state === 'error'
                            ? `Transcription problem: ${speechEngine.message}`
                            : 'Listening to conversation... Each phrase appears here a moment after it is spoken.'}
                        </span>
                      </>
                    ) : (
                      <span className="max-w-xs">Transcript appears as speech is processed. Review the text and speaker labels before using them.</span>
                    )}
                  </div>
                ) : (
                  transcript.map((seg, idx) => {
                    const displaySpeaker = displaySpeakerOf(seg.speaker);
                    const showDual = transcriptViewMode === 'dual' && seg.translation;
                    const showTranslatedOnly = transcriptViewMode === 'translated' && seg.translation;

                    return (
                      <div
                        key={seg.id || `seg-${idx}`}
                        className="grid grid-cols-[auto_1fr] gap-x-3 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-accent/50"
                      >
                        <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                          {formatSecondsToTime(seg.timestampSeconds)}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRenameSpeaker(displaySpeaker)}
                              className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Click to rename this speaker across all segments"
                            >
                              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', speakerDotClass(speakerColors, displaySpeaker))} />
                              <span>{displaySpeaker}</span>
                            </button>
                            {seg.sourceLanguage && (
                              <Badge variant="outline" className="px-1 py-0 font-mono font-normal text-muted-foreground">
                                {seg.sourceLanguage}
                              </Badge>
                            )}
                          </div>

                          {showDual ? (
                            <div className="space-y-1.5">
                              <p className="border-l-2 pl-3 text-sm italic leading-6 text-muted-foreground">
                                <span className="mr-1.5 text-xs not-italic">Spoken:</span>
                                {seg.originalText || seg.text}
                              </p>
                              <p className="border-l-2 border-foreground/40 pl-3 text-sm leading-6 text-foreground">
                                <span className="mr-1.5 text-xs text-muted-foreground">Translated:</span>
                                {seg.translation}
                              </p>
                            </div>
                          ) : showTranslatedOnly ? (
                            <p className="text-sm leading-6 text-foreground">{seg.translation}</p>
                          ) : (
                            <p className="text-sm leading-6 text-foreground">{seg.originalText || seg.text}</p>
                          )}

                          {seg.isTranslating && (
                            <p className="flex animate-pulse items-center gap-1 text-xs text-muted-foreground">
                              <Sparkles className="size-3" aria-hidden="true" />
                              <span>Translating with AI...</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={transcriptBottomRef} />
              </div>
            </section>

            {/* Manual Meeting Notes Pane */}
            <section className="flex h-[22rem] min-h-0 flex-col overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 md:h-auto">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-medium text-foreground">Notes</h3>
                <span className="ml-auto text-xs text-muted-foreground">Live editor</span>
              </div>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Jot down notes, reminders, or questions during the meeting..."
                className="min-h-0 flex-1 w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
              />
            </section>
          </div>
        </div>
      </div>

      {/* Processing AI overlay */}
      {isProcessingAI && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-background/90 p-4 text-center" role="status">
          <Spinner className="mb-2 size-6" role="presentation" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Synthesizing Meeting</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Extracting executive summary, key decisions, action items, and topic milestones from your
            actual recorded transcript...
          </p>
        </div>
      )}

      {/* Screenshot Preview */}
      <ScreenshotLightbox
        src={previewScreenshot?.dataUrl ?? null}
        title={previewScreenshot ? `Screenshot at ${formatSecondsToTime(previewScreenshot.timestampSeconds)}` : 'Screenshot'}
        alt={previewScreenshot ? `Screenshot at ${formatSecondsToTime(previewScreenshot.timestampSeconds)}` : 'Screenshot'}
        onClose={() => setPreviewScreenshot(null)}
      />

      {/* Google Meet Guide Modal */}
      {isMeetModalOpen && (
        <GoogleMeetGuideModal
          isOpen={isMeetModalOpen}
          onClose={() => setIsMeetModalOpen(false)}
          onStartTabCapture={handleStartTabCapture}
        />
      )}

      {/* Floating Meeting HUD Controller (Monochrome Glassmorphism) */}
      {isRecording && (
        <FloatingMeetingController
          elapsedSeconds={elapsedSeconds}
          isRecording={isRecording}
          isPaused={isPaused}
          isMicMuted={isMicMuted}
          audioLevel={audioLevel}
          transcript={transcript}
          screenshots={screenshots}
          autoOpenPiP={shouldAutoOpenPiP}
          onStopAndCompile={stopAndSaveMeeting}
          onTogglePause={handleTogglePause}
          onToggleMicMute={handleToggleMicMute}
          onTakeFullScreenshot={handleTakeScreenshot}
          onStartPortionSnip={() => setIsSnipping(true)}
          onAddBookmark={handleAddBookmark}
          onAddQuickNote={handleAddQuickNote}
          onRemoveScreenshot={removeScreenshot}
        />
      )}

      {/* Interactive Portion Snip Tool Overlay */}
      {isSnipping && (
        <ScreenSnipperOverlay
          onCapture={handleCapturePortion}
          onCancel={() => setIsSnipping(false)}
        />
      )}

      {/* Scheduled Event Notification & Calendar Add Prompt Modal */}
      <CalendarEventPromptModal
        isOpen={isEventModalOpen}
        events={detectedEvents}
        onClose={() => {
          setIsEventModalOpen(false);
          if (pendingSavedMeeting) {
            onMeetingSaved(pendingSavedMeeting);
          }
        }}
      />
    </div>
  );
};
