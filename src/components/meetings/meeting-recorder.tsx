import React, { useState, useEffect, useRef } from 'react';
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
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
  MicOff,
  Square,
  Radio,
  FileText,
  Clock,
  Sparkles,
  Camera,
  X,
  Image,
  Calendar,
  User,
  Users,
  Wand2,
  Languages,
  ArrowRightLeft,
  ExternalLink,
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
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);
  const timerIntervalRef = useRef<any>(null);
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
        addToast(`📅 Scheduled Event detected: "${ev.title}" on ${ev.date} at ${ev.time}`, 'info');
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
              addToast(`📅 Scheduled Event detected from translation: "${ev.title}" on ${ev.date} at ${ev.time}`, 'info');
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
        audioRecorderRef.current.stop();
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

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Timer interval handling pause / resume
  useEffect(() => {
    if (!isRecording || isPaused) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
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
      setScreenshots([]);

      // Start audio stream & visualizer
      await audioRecorderRef.current?.start((level) => {
        setAudioLevel(level);
      });

      // Transcribe the same microphone stream that is being recorded
      speechTranscriberRef.current?.setInputStream(audioRecorderRef.current?.getStream() ?? null);
      speechTranscriberRef.current?.setLanguage(spokenLanguage);
      speechTranscriberRef.current?.start(handleIncomingSegment, handleIncomingInterim);

      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);

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

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);

      // Record and transcribe the mixed tab + mic audio
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
              addToast(`👥 ${names.length} participant(s) detected via screen scan`, 'info');
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
      // Stop audio recording and get blob
      const audioBlob = await audioRecorderRef.current?.stop();
      tabMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      tabMicStreamRef.current = null;

      // Wait for the last phrases, then let React commit their segments
      await transcriptionDone;
      await new Promise((resolve) => setTimeout(resolve, 50));
      const transcript = transcriptRef.current;

      const meetingId = `meeting-${Date.now()}`;
      const now = Date.now();
      let audioBlobId: string | undefined;

      if (audioBlob && audioBlob.size > 0) {
        audioBlobId = `blob-${Date.now()}`;
        await db.blobs.put({
          id: audioBlobId,
          data: audioBlob,
          mimeType: audioBlob.type,
          createdAt: now,
        });
      }

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
              ? `Meeting recorded with ${transcript.length} speech segment(s). (Local AI not connected to extract deeper synthesis).`
              : 'Meeting ended with manual notes.',
          decisions: [],
          actionItems: [],
          topics: [],
          followUpTasks: [],
          summaryLanguage: targetSummaryLang,
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
        startTime: now - elapsedSeconds * 1000,
        endTime: now,
        durationSeconds: elapsedSeconds,
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

      await db.meetings.put(newMeeting);
      addToast('Meeting recording and AI synthesis complete.', 'success');

      if (allDetected.length > 0) {
        setPendingSavedMeeting(newMeeting);
        setIsEventModalOpen(true);
      } else {
        onMeetingSaved(newMeeting);
      }
    } catch (err: any) {
      console.error('[HuskyNote] Failed to save meeting:', err);
      addToast('Failed to save meeting data.', 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black p-8 max-w-5xl mx-auto w-full">
      {/* Top Controls Card */}
      <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              disabled={isRecording}
              className="bg-transparent text-xl font-bold text-white tracking-tight focus:outline-none placeholder-zinc-500 w-full"
              placeholder="Meeting Title"
            />
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {formatSecondsToTime(elapsedSeconds)}
              </span>
              <span>•</span>
              <span>Local storage</span>
              {isConnected && (
                <>
                  <span>•</span>
                  <span className="text-zinc-300">AI: {selectedModel}</span>
                </>
              )}
              {screenshots.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-zinc-300 flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Recording Badge */}
          <div className="flex items-center gap-3">
            {isRecording ? (
              <Badge variant="recording" dot>
                RECORDING
              </Badge>
            ) : (
              <Badge variant="outline">STANDBY</Badge>
            )}

            {!isRecording ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-stretch">
                  <Button variant="primary" size="md" onClick={startRecording} className="rounded-r-none">
                    <Mic className="w-4 h-4" />
                    <span>Start Microphone</span>
                  </Button>
                  {/* The chosen microphone is also the host mic for Google Meet / Tab capture */}
                  <MicrophonePicker
                    align="right"
                    triggerClassName="px-2 rounded-r-md border-l border-white/20 bg-slate-950 text-white hover:bg-slate-800 dark:border-black/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  />
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsMeetModalOpen(true)}
                  title="Capture Google Meet or Tab audio"
                >
                  <Radio className="w-4 h-4" />
                  <span>Google Meet / Tab</span>
                </Button>
                {onCancel && (
                  <Button variant="ghost" size="md" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Pop-out Quick Navbar to Meeting Screen */}
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShouldAutoOpenPiP(true)}
                  title="Pop out Always-on-Top Floating Quick Navbar on your meeting tab or screen"
                  className="border-zinc-700 hover:border-zinc-500"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Pop-out HUD</span>
                </Button>

                {/* Screenshot Capture Button */}
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleTakeScreenshot}
                  title="Capture a screenshot of the current screen"
                  className="border-zinc-700 hover:border-zinc-500"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Screenshot</span>
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  onClick={stopAndSaveMeeting}
                  disabled={isProcessingAI}
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>End Meeting</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Audio Meter Waveform */}
        {isRecording && (
          <div className="pt-4 border-t dark:border-zinc-850 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">Live Input Level</span>
            <div className="flex items-center gap-1 h-6">
              {[...Array(24)].map((_, i) => {
                const threshold = (i / 24) * 100;
                const active = audioLevel >= threshold;
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      active ? 'bg-zinc-200 h-5' : 'bg-zinc-800 h-1.5'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Screenshot Thumbnail Strip */}
        {screenshots.length > 0 && (
          <div className="pt-4 border-t dark:border-zinc-850 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Captured Screenshots ({screenshots.length})
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {screenshots.map((ss) => (
                <div key={ss.id} className="relative group shrink-0">
                  <button
                    onClick={() => setPreviewScreenshot(ss)}
                    className="block rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors"
                  >
                    <img
                      src={ss.dataUrl}
                      alt={`Screenshot at ${formatSecondsToTime(ss.timestampSeconds)}`}
                      className="h-16 w-28 object-cover"
                    />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/80 text-zinc-300 px-1.5 py-0.5 rounded">
                    {formatSecondsToTime(ss.timestampSeconds)}
                  </span>
                  {isRecording && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScreenshot(ss.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900 hover:border-red-700"
                      title="Remove screenshot"
                    >
                      <X className="w-3 h-3 text-zinc-300" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multilingual Speech Recognition & AI Translation Controls */}
        <div className="pt-3 border-t dark:border-zinc-850 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>Spoken Language:</span>
            </div>
            <select
              value={spokenLanguage}
              onChange={(e) => {
                const newLang = e.target.value;
                setSpokenLanguage(newLang);
                speechTranscriberRef.current?.setLanguage(newLang);
                const lName = SUPPORTED_LANGUAGES.find((l) => l.bcp47 === newLang)?.name || newLang;
                addToast(`Speech recognition set to ${lName}`, 'info');
              }}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-600 font-medium"
              title="Select spoken language for speech recognition"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.bcp47} value={lang.bcp47}>
                  {lang.flag} {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
              <ArrowRightLeft className="w-3 h-3 text-zinc-500" />
              <span>Translate To:</span>
            </div>
            <select
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
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-600 font-medium"
              title="Select target translation language"
            >
              {TRANSLATION_TARGETS.map((target) => (
                <option key={target.code} value={target.code}>
                  {target.flag} {target.name}
                </option>
              ))}
            </select>
          </div>

          {/* View mode toggle (Dual / Translated / Original) when translation is active */}
          {translationTarget !== 'none' && (
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px] font-mono">
              <button
                onClick={() => setTranscriptViewMode('dual')}
                className={`px-2 py-0.5 rounded transition-all ${
                  transcriptViewMode === 'dual'
                    ? 'bg-zinc-800 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Show both original spoken language and translated text"
              >
                Dual View
              </button>
              <button
                onClick={() => setTranscriptViewMode('translated')}
                className={`px-2 py-0.5 rounded transition-all ${
                  transcriptViewMode === 'translated'
                    ? 'bg-zinc-800 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Show translated text only"
              >
                Translation
              </button>
              <button
                onClick={() => setTranscriptViewMode('original')}
                className={`px-2 py-0.5 rounded transition-all ${
                  transcriptViewMode === 'original'
                    ? 'bg-zinc-800 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Show original spoken text only"
              >
                Original
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main split: Live Transcript on left, Manual Notes on right */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        {/* Live Transcript Pane */}
        <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 border-b dark:border-zinc-850 mb-3 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Live Verbal Transcript
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 font-mono">
                {transcript.length} segments
              </span>

              {transcript.length > 0 && translationTarget !== 'none' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBatchTranslate(translationTarget)}
                  disabled={isTranslatingAll}
                  className="text-xs font-mono py-1 px-2.5 h-7"
                  title="Translate all transcript segments using Local AI"
                >
                  <Languages className={`w-3 h-3 mr-1 text-cyan-400 ${isTranslatingAll ? 'animate-spin' : ''}`} />
                  <span>{isTranslatingAll ? 'Translating...' : `Translate (${translationTarget.toUpperCase()})`}</span>
                </Button>
              )}

              {transcript.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePolishTranscript}
                  disabled={isPolishingAI}
                  className="text-xs font-mono py-1 px-2.5 h-7"
                  title="Use Local AI to clean grammar and diarize speaker turns"
                >
                  <Wand2 className={`w-3 h-3 mr-1 text-emerald-400 ${isPolishingAI ? 'animate-spin' : ''}`} />
                  <span>{isPolishingAI ? 'Diarizing...' : 'AI Polish'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Active Speaker Hook & Switcher Toolbar */}
          {isRecording && (
            <div className="mb-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-2.5 flex-wrap text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Speaking now:</span>
                </div>
                {detectedMeetingApp && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Hooked: {detectedMeetingApp}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {speakerRoster.map((spk) => (
                  <button
                    key={spk}
                    onClick={() => handleSpeakerChange(spk)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                      currentSpeaker.toLowerCase() === spk.toLowerCase()
                        ? 'bg-emerald-500 text-black font-bold shadow-sm ring-1 ring-emerald-400'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {currentSpeaker.toLowerCase() === spk.toLowerCase() && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                    )}
                    <span>{spk}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    const custom = window.prompt('Enter speaker / participant name:');
                    if (custom && custom.trim()) handleSpeakerChange(custom.trim());
                  }}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors border border-dashed border-zinc-700"
                  title="Manually add a participant to the speaker roster"
                >
                  + Add Speaker
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {/* Real-time zero-delay interim speech bubble */}
            {liveInterimText && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-xs animate-in fade-in duration-100 flex items-start gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-semibold mb-0.5">
                    <span>{currentSpeaker}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-emerald-300 italic font-normal">speaking now (live)...</span>
                  </div>
                  <p className="text-zinc-100 text-xs leading-relaxed font-sans">
                    {liveInterimText}
                  </p>
                </div>
              </div>
            )}

            {transcript.length === 0 && !liveInterimText ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                {isRecording ? (
                  <>
                    <Mic className="w-6 h-6 mb-2 text-zinc-400 animate-pulse" />
                    <span>
                      {speechEngine.state === 'loading'
                        ? 'Preparing the on-device speech model. Audio is being captured and will be transcribed once it is ready.'
                        : speechEngine.state === 'error'
                        ? `Transcription problem: ${speechEngine.message}`
                        : 'Listening to conversation... Each phrase appears here a moment after it is spoken.'}
                    </span>
                  </>
                ) : (
                  <span>Transcript will appear live with speaker names once recording begins.</span>
                )}
              </div>
            ) : (
              transcript.map((seg, idx) => {
                const displaySpeaker = /^speaker\s*\d*$/i.test(seg.speaker) ? 'You / Host' : seg.speaker;
                const isHost = displaySpeaker.toLowerCase().includes('host') || displaySpeaker.toLowerCase().includes('you');
                const badgeColor = isHost
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

                const showDual = transcriptViewMode === 'dual' && seg.translation;
                const showTranslatedOnly = transcriptViewMode === 'translated' && seg.translation;

                return (
                  <div key={seg.id || `seg-${idx}`} className="p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 text-xs transition-colors hover:border-zinc-700 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRenameSpeaker(displaySpeaker)}
                          className={`font-semibold px-1.5 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer ${badgeColor}`}
                          title="Click to rename this speaker across all segments"
                        >
                          <User className="w-2.5 h-2.5" />
                          <span>{displaySpeaker}</span>
                        </button>
                        {seg.sourceLanguage && (
                          <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {seg.sourceLanguage}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-zinc-500">{formatSecondsToTime(seg.timestampSeconds)}</span>
                    </div>

                    {showDual ? (
                      <div className="space-y-1 pl-1">
                        <div className="text-zinc-400 text-[11px] leading-relaxed italic border-l-2 border-zinc-700 pl-2">
                          <span className="text-[9px] font-mono uppercase text-zinc-500 mr-1.5">Spoken:</span>
                          {seg.originalText || seg.text}
                        </div>
                        <div className="text-zinc-100 text-xs font-medium leading-relaxed border-l-2 border-emerald-500/60 pl-2">
                          <span className="text-[9px] font-mono uppercase text-emerald-400 mr-1.5">Translated:</span>
                          {seg.translation}
                        </div>
                      </div>
                    ) : showTranslatedOnly ? (
                      <p className="text-zinc-100 text-xs leading-relaxed pl-1 font-medium">
                        {seg.translation}
                      </p>
                    ) : (
                      <p className="text-zinc-200 leading-relaxed pl-1">
                        {seg.originalText || seg.text}
                      </p>
                    )}

                    {seg.isTranslating && (
                      <div className="text-[10px] font-mono text-amber-400 flex items-center gap-1 pl-1 animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Translating with AI...</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={transcriptBottomRef} />
          </div>
        </div>

        {/* Manual Meeting Notes Pane */}
        <div className="bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-3 border-b dark:border-zinc-850 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-400" />
              <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Meeting Notes
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">Live editor</span>
          </div>

          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Jot down notes, reminders, or questions during the meeting..."
            className="flex-1 w-full bg-transparent resize-none text-xs leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Processing AI overlay */}
      {isProcessingAI && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <Sparkles className="w-8 h-8 text-zinc-300 animate-spin mb-4" />
          <h3 className="text-sm font-semibold text-zinc-100 mb-1">Synthesizing Meeting</h3>
          <p className="text-xs text-zinc-400 max-w-sm text-center">
            Extracting executive summary, key decisions, action items, and topic milestones from your
            actual recorded transcript...
          </p>
        </div>
      )}

      {/* Screenshot Preview Lightbox */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-400 font-mono">
                Screenshot at {formatSecondsToTime(previewScreenshot.timestampSeconds)}
              </span>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewScreenshot.dataUrl}
              alt={`Screenshot at ${formatSecondsToTime(previewScreenshot.timestampSeconds)}`}
              className="w-full rounded-lg border border-zinc-800 shadow-2xl"
            />
          </div>
        </div>
      )}

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
