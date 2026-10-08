import type { TranscriptSegment, MeetingSummary, TimelineItem, ScheduleEvent } from '../../types';
export type { TranscriptSegment, MeetingSummary, TimelineItem, ScheduleEvent };
import { ai } from '../ai/active-provider';
import { parseTopicList } from '../meetings/meeting-report';
import {
  detectAllEventsInText,
  createScheduleEventFromMatch,
  parseDateExpression,
} from '../calendar/event-detector';
import {
  detectLikelyLanguage,
  getLanguageName,
  normalizeLanguageCode,
} from '../ai/translation';
import { speechStatus, speechEngine, toWhisperLanguage, isNonSpeech } from './speech-engine';
import { resolveTranscriptionEngine, getTranscriptionEngine, MULTILINGUAL_FALLBACK_ENGINE } from './transcription-engines';
import { startPcmCapture, takeChunkBatch, locateInBatch, type PcmCapture, type SpeechChunk } from './pcm-capture';
import { openMicrophone } from './microphone';
import { enqueueSpeechJob, processMeetingJobs, pauseMeetingTranscription } from './speech-jobs';

// Longest audio merged into one Whisper call (the model window is 30 s)
const MAX_BATCH_SECONDS = 25;

/**
 * WebSpeechTranscriber provides real-time speech-to-text transcription
 * using the browser's Web Speech API (SpeechRecognition). It only hears the
 * default microphone and relies on the browser vendor's cloud service, so
 * LiveSpeechTranscriber uses it only as a fallback when Whisper cannot run.
 *
 * Features:
 * - Continuous listening with automatic restart on speech end
 * - Configurable language (defaults to 'en-US')
 * - Timestamped transcript segments relative to recording start
 * - Graceful degradation when SpeechRecognition is unsupported
 *
 * Usage:
 * ```ts
 * const transcriber = new WebSpeechTranscriber();
 * transcriber.start((segment) => {
 *   console.log(segment.text); // live transcribed text
 * });
 * // later...
 * transcriber.stop();
 * ```
 */
export class WebSpeechTranscriber {
  private recognition: any = null;
  private isListening: boolean = false;
  private startTime: number = 0;
  private onSegmentCallback: ((segment: TranscriptSegment) => void) | null = null;
  private onInterimCallback: ((interimText: string) => void) | null = null;
  private segmentCounter: number = 0;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 50;
  private language: string = 'auto';
  private activeSpeaker: string = 'You / Host';
  private interimTimer: any = null;
  private lastFinalizedText: string = '';

  constructor() {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      const browserLang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      this.recognition.lang = this.language === 'auto' ? browserLang : this.language;

      this.recognition.onresult = (event: any) => {
        let interimAccumulator = '';
        const elapsed = Math.max(0, Math.floor((Date.now() - this.startTime) / 1000));

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();
          if (!text) continue;

          if (result.isFinal) {
            this.restartAttempts = 0; // Reset on successful result
            if (this.interimTimer) {
              clearTimeout(this.interimTimer);
              this.interimTimer = null;
            }
            if (text !== this.lastFinalizedText) {
              this.lastFinalizedText = text;
              this.emitFinalSegment(text, elapsed);
            }
          } else {
            interimAccumulator += (interimAccumulator ? ' ' : '') + text;
          }
        }

        if (this.onInterimCallback) {
          this.onInterimCallback(interimAccumulator);
        }

        // Auto-finalize after 1.5s of speech pause to avoid browser transcription delay
        if (interimAccumulator && interimAccumulator.trim().length > 3) {
          if (this.interimTimer) clearTimeout(this.interimTimer);
          const pending = interimAccumulator.trim();
          this.interimTimer = setTimeout(() => {
            if (pending && pending !== this.lastFinalizedText && this.isListening) {
              this.lastFinalizedText = pending;
              this.emitFinalSegment(pending, Math.max(0, Math.floor((Date.now() - this.startTime) / 1000)));
              if (this.onInterimCallback) this.onInterimCallback('');
            }
          }, 1500);
        }
      };

      this.recognition.onerror = (event: any) => {
        const errorType = event?.error;
        console.warn('[HuskyNote] Speech recognition event:', errorType);

        // Handle specific error types
        switch (errorType) {
          case 'no-speech':
            // Normal — user is silent, will auto-restart via onend
            break;
          case 'audio-capture':
            console.error('[HuskyNote] Microphone not available or disconnected.');
            break;
          case 'not-allowed':
          case 'service-not-allowed':
            console.error('[HuskyNote] Microphone permission denied by user or browser.');
            speechStatus.set({ state: 'error', message: 'Speech recognition is not allowed in this browser.' });
            this.isListening = false; // Stop trying to restart
            break;
          case 'network':
            console.warn('[HuskyNote] Network error in speech recognition. Will retry.');
            break;
          case 'aborted':
            // Recognition was aborted, may auto-restart
            break;
          default:
            console.warn('[HuskyNote] Unknown speech recognition error:', errorType);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if we are still marked listening and haven't exceeded retry limit
        if (this.isListening && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          // Small delay to prevent tight restart loops under browser throttling
          const delay = Math.min(100 * this.restartAttempts, 2000);
          setTimeout(() => {
            if (this.isListening) {
              try {
                this.recognition.start();
              } catch {
                // ignore — may already be started
              }
            }
          }, delay);
        } else if (this.restartAttempts >= this.maxRestartAttempts) {
          console.warn('[HuskyNote] Speech recognition exceeded max restart attempts. Stopping.');
          speechStatus.set({ state: 'error', message: 'Browser speech recognition stopped responding.' });
          this.isListening = false;
        }
      };
    }
  }

  private emitFinalSegment(text: string, elapsed: number): void {
    if (!this.onSegmentCallback || !text.trim()) return;
    const detectedLang = this.language === 'auto' ? detectLikelyLanguage(text) : this.language;
    this.onSegmentCallback({
      id: `seg-${++this.segmentCounter}-${Date.now()}`,
      timestampSeconds: elapsed,
      speaker: this.activeSpeaker || 'You / Host',
      text: text.trim(),
      sourceLanguage: detectedLang,
    });
  }

  /**
   * Check whether the browser supports the Web Speech API.
   * @returns `true` if SpeechRecognition is available.
   */
  isSupported(): boolean {
    return !!this.recognition;
  }

  /**
   * Set the language code for speech recognition.
   * Automatically restarts recognition if currently listening.
   * @param lang - BCP 47 language tag (e.g., 'en-US', 'fil-PH', 'ja-JP', 'zh-CN', 'ko-KR', 'fr-FR')
   */
  setLanguage(lang: string): void {
    if (!lang) return;
    const changed = this.language !== lang;
    this.language = lang;
    if (this.recognition) {
      const browserLang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      this.recognition.lang = lang === 'auto' ? browserLang : lang;
      if (changed && this.isListening) {
        try {
          this.recognition.stop();
        } catch {
          // auto-restarts with new language
        }
      }
    }
  }

  getLanguage(): string {
    return this.language;
  }

  /**
   * Set active speaker name (e.g., 'Arron', 'Speaker 1', 'Client')
   */
  setActiveSpeaker(speaker: string): void {
    if (speaker && speaker.trim()) {
      this.activeSpeaker = speaker.trim();
    }
  }

  getActiveSpeaker(): string {
    return this.activeSpeaker;
  }

  /**
   * Begin live speech transcription.
   * Each recognized phrase calls `onSegment` with a timestamped `TranscriptSegment`.
   * Optionally streams interim speech in real time as the user speaks.
   * @param onSegment - Callback invoked with each finalized transcribed segment.
   * @param onInterim - Optional callback invoked in real time with interim spoken words.
   */
  start(
    onSegment: (segment: TranscriptSegment) => void,
    onInterim?: (interimText: string) => void
  ): void {
    if (!this.recognition) return;
    this.isListening = true;
    this.startTime = Date.now();
    this.segmentCounter = 0;
    this.restartAttempts = 0;
    this.onSegmentCallback = onSegment;
    this.onInterimCallback = onInterim || null;
    try {
      this.recognition.start();
    } catch {
      // already active
    }
  }

  /**
   * Stop live speech transcription and release resources.
   * Safe to call multiple times.
   */
  stop(): void {
    this.isListening = false;
    this.onSegmentCallback = null;
    this.restartAttempts = 0;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * LiveSpeechTranscriber transcribes speech on-device with Whisper.
 *
 * It listens to an input stream set with `setInputStream` (for example the
 * mixed tab + microphone audio of a meeting) or opens the microphone itself,
 * cuts the audio into phrases at natural pauses, and emits one timestamped
 * segment per phrase. Progress and errors are published on `speechStatus`.
 * No automatic cloud speech fallback. Meeting jobs are retained for local retry.
 */
export class LiveSpeechTranscriber {
  private inputStream: MediaStream | null = null;
  private ownedStream: MediaStream | null = null;
  private capture: PcmCapture | null = null;
  private pendingChunks: (SpeechChunk & { meta: { speaker: string; language: string } })[] = [];
  private draining: Promise<void> | null = null;
  private onSegmentCallback: ((segment: TranscriptSegment) => void) | null = null;
  private onInterimCallback: ((interimText: string) => void) | null = null;
  private segmentCounter = 0;
  private language = 'auto';
  private activeSpeaker = 'You / Host';
  private session = 0;
  private meetingId: string | null = null;
  private writes: Promise<void> = Promise.resolve();
  private nextSequence = 0;
  private failed = false;
  private starting: Promise<void> | null = null;

  setMeetingId(id: string): void { this.meetingId = id; }

  isSupported(): boolean {
    return speechEngine.isSupported();
  }

  /** Transcribe this stream instead of opening the microphone. Pass null to clear. */
  setInputStream(stream: MediaStream | null): void {
    this.inputStream = stream;
  }

  setLanguage(lang: string): void {
    if (!lang) return;
    this.language = lang;
  }

  getLanguage(): string {
    return this.language;
  }

  setActiveSpeaker(speaker: string): void {
    if (speaker && speaker.trim()) {
      this.activeSpeaker = speaker.trim();
    }
  }

  getActiveSpeaker(): string {
    return this.activeSpeaker;
  }

  /** Download the speech model ahead of time so the first phrase is not delayed. */
  preload(): void {
    if (speechEngine.isSupported()) speechEngine.load(resolveTranscriptionEngine(this.language)).catch(() => {});
  }

  start(
    onSegment: (segment: TranscriptSegment) => void,
    onInterim?: (interimText: string) => void
  ): void {
    this.onSegmentCallback = onSegment;
    this.onInterimCallback = onInterim || null;
    this.segmentCounter = 0;
    const session = ++this.session;
    this.failed = false;
    this.starting = this.startCapture(session);
  }

  private async startCapture(session: number): Promise<void> {
    if (!speechEngine.isSupported()) {
      speechStatus.set({ state: 'error', message: 'On-device transcription is unavailable in this browser. No audio has been sent to a cloud service.' });
      return;
    }
    try {
      let stream = this.inputStream;
      if (!stream) {
        stream = await openMicrophone({ echoCancellation: true, noiseSuppression: true });
        this.ownedStream = stream;
      }
      if (session !== this.session) {
        this.releaseOwnedStream();
        return;
      }
      this.capture = await startPcmCapture(stream, (chunk) => this.enqueue(chunk));
      if (session !== this.session) { await this.stopCapture(); return; }
      const engine = resolveTranscriptionEngine(this.language);
      speechEngine.load(engine).catch((err) => {
        console.warn(`[HuskyNote] ${engine.name} could not load:`, err);
        if (session !== this.session) return;
        this.failed = true;
        speechStatus.set({ state: 'error', message: 'Local transcription could not start. Retry setup in Settings. Meeting audio remains on this device.' });
      });
    } catch (err: any) {
      this.releaseOwnedStream();
      console.error('[HuskyNote] Could not start audio capture for transcription:', err);
      speechStatus.set({ state: 'error', message: err?.message || 'Could not access audio for transcription.' });
    }
  }

  private enqueue(chunk: SpeechChunk): void {
    if (!this.onSegmentCallback) return;
    if (this.meetingId) {
      const meetingId = this.meetingId;
      const sequence = this.nextSequence++;
      const session = this.session;
      const callback = this.onSegmentCallback;
      const job = { id: `${meetingId}-speech-${sequence}`, meetingId, sequence, startSeconds: chunk.startSeconds,
        language: this.language, speaker: this.activeSpeaker, engineId: resolveTranscriptionEngine(this.language).id,
        audio: chunk.audio, attempts: 0 };
      this.writes = this.writes.then(() => enqueueSpeechJob(job)).then(() => {
        if (!this.failed) this.draining = processMeetingJobs(meetingId, (segment) => {
          if (this.session === session) callback(segment);
        }).catch((error) => {
          this.failed = true;
          speechStatus.set({ state: 'error', message: `Could not read pending transcription: ${String(error)}. Check storage and retry.` });
        });
      }).catch((error) => {
        this.failed = true;
        speechStatus.set({ state: 'error', message: `Could not save pending transcription: ${String(error)}. Stop recording and check storage.` });
      });
      return;
    }
    // Dictation/test audio is transient. Keep memory bounded and report overload.
    if (this.pendingChunks.reduce((n, c) => n + c.audio.length, 0) > 16000 * 60) {
      this.failed = true;
      speechStatus.set({ state: 'error', message: 'Live dictation cannot keep up. Stop and retry with a smaller model.' });
      void this.stopCapture().catch(() => {});
      return;
    }
    this.pendingChunks.push({ ...chunk, meta: { speaker: this.activeSpeaker, language: this.language } });
    if (!this.draining) {
      this.draining = this.drain().finally(() => {
        this.draining = null;
      });
    }
  }

  /**
   * Transcribe queued phrases one model call at a time. Each call costs about
   * the same regardless of length, so phrases that queued up while the model
   * was busy are merged into a single call.
   */
  private async drain(): Promise<void> {
    while (this.pendingChunks.length > 0) {
      const onSegment = this.onSegmentCallback;
      if (!onSegment) {
        this.pendingChunks = [];
        return;
      }
      const batch = takeChunkBatch(this.pendingChunks, MAX_BATCH_SECONDS);
      const language = batch.parts[0].meta.language;
      try {
        const pieces = await speechEngine.transcribe(batch.audio, toWhisperLanguage(language));
        for (const piece of pieces) {
          if (!piece.text || isNonSpeech(piece.text)) continue;
          const { captureSeconds, meta } = locateInBatch(batch, piece.start);
          onSegment({
            id: `seg-${++this.segmentCounter}-${Date.now()}`,
            timestampSeconds: Math.floor(captureSeconds),
            speaker: meta.speaker,
            text: piece.text,
            sourceLanguage: language === 'auto' ? detectLikelyLanguage(piece.text) : language,
          });
        }
      } catch (err) {
        console.warn('[HuskyNote] Whisper transcription failed for a batch:', err);
        speechStatus.set({ state: 'error', message: 'A speech phrase could not be transcribed. Retry dictation or resume saved meeting audio.' });
      }
    }
  }

  pause(): void {
    this.capture?.pause();
  }

  resume(): void {
    this.capture?.resume();
  }

  private async stopCapture(): Promise<void> {
    const capture = this.capture;
    this.capture = null;
    try { await capture?.stop(); }
    finally { this.releaseOwnedStream(); }
  }

  private releaseOwnedStream(): void {
    this.ownedStream?.getTracks().forEach((t) => t.stop());
    this.ownedStream = null;
  }

  /**
   * Stop listening. Resolves once phrases already captured are transcribed
   * (bounded by `timeoutMs`), so callers can save a complete transcript.
   */
  async stop(timeoutMs = 30000): Promise<void> {
    await this.starting;
    try { await this.stopCapture(); }
    catch (error) { speechStatus.set({ state: 'error', message: String(error) }); }
    await this.writes;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([this.draining ?? Promise.resolve(), new Promise((r) => { timer = setTimeout(r, this.meetingId ? Math.min(timeoutMs, 3000) : timeoutMs); })]);
    clearTimeout(timer);
    if (this.meetingId) pauseMeetingTranscription(this.meetingId);
    this.session++;
    this.pendingChunks = [];
    this.onSegmentCallback = null;
    this.onInterimCallback = null;
  }
}

/**
 * Format a duration in seconds to a human-readable `MM:SS` string.
 * @param totalSeconds - Total seconds elapsed.
 * @returns Formatted time string (e.g., '05:32').
 */
export function formatSecondsToTime(totalSeconds: number): string {
  // Speech segments carry fractional timestamps; show whole seconds
  const whole = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Synthesize AI-powered meeting insights from transcript and manual notes.
 * Supports multi-language input (Filipino/Tagalog, English, Japanese, Chinese, Korean, French)
 * and accurately synthesizes into the target language (English or Filipino).
 *
 * @param transcript - Array of timestamped transcript segments.
 * @param manualNotes - Free-text notes taken during the meeting.
 * @param modelName - Ollama model name to use for synthesis.
 * @param meetingTitle - Title of the meeting.
 * @param targetSummaryLanguage - Target language for synthesis ('en' or 'fil').
 * @returns Structured summary and timeline milestones.
 */
export async function synthesizeMeetingAI(
  transcript: TranscriptSegment[],
  manualNotes: string,
  modelName: string,
  meetingTitle?: string,
  targetSummaryLanguage: string = 'en'
): Promise<{
  summary: MeetingSummary;
  timeline: TimelineItem[];
  detectedEvents: ScheduleEvent[];
}> {
  if (transcript.length === 0 && !manualNotes.trim()) {
    return {
      summary: {
        overview: targetSummaryLanguage === 'fil'
          ? 'Walang naitalang transcript o tala para sa pulong na ito.'
          : 'No transcript or manual notes recorded for this session.',
        decisions: [],
        actionItems: [],
        topics: [],
        followUpTasks: [],
        summaryLanguage: targetSummaryLanguage,
      },
      timeline: [],
      detectedEvents: [],
    };
  }

  const combinedText = `${transcript.map((s) => s.translation || s.text).join(' ')}\n${manualNotes}`;
  const nlpMatches = detectAllEventsInText(combinedText);
  const detectedEvents: ScheduleEvent[] = nlpMatches.map((m) =>
    createScheduleEventFromMatch(m, {
      source: 'meeting',
      sourceTitle: meetingTitle || 'Meeting Title',
    })
  );

  const transcriptText = transcript
    .map((s) => {
      const translationSnippet = s.translation && s.translation !== s.text ? ` [Translation: ${s.translation}]` : '';
      return `[${formatSecondsToTime(s.timestampSeconds)}] ${s.speaker}: ${s.text}${translationSnippet}`;
    })
    .join('\n');

  const normTarget = normalizeLanguageCode(targetSummaryLanguage);
  const isFilipino = normTarget === 'fil';
  const isEnglish = normTarget === 'en';
  const targetName = getLanguageName(normTarget);

  let languageDirective = `LANGUAGE DIRECTIVE (ZERO RESTRICTIONS):
The spoken meeting may contain speech in ANY language, dialect, accent, technical jargon, slang, or mixed code-switching from anywhere in the world without restrictions.
You MUST accurately transcribe, translate, and synthesize ALL discussion points, decisions, and tasks into high-clarity, professional ${targetName}. Do not censor, omit, or refuse any discussion content.`;

  if (isFilipino) {
    languageDirective += `
Panatilihing buo at tumpak ang pagsasalin sa natural at propesyonal na Filipino / modernong Taglish para sa kumperensya.`;
  } else if (isEnglish) {
    languageDirective += `
Ensure all foreign dialogue, idioms, and notes are translated strictly into clean, fluent English.`;
  }

  const now = new Date();
  const currentIsoDate = now.toISOString().split('T')[0];
  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentYear = now.getFullYear();

  const prompt = `You are an expert multilingual executive AI secretary.
Analyze this meeting transcript and participant notes.
${languageDirective}

CALENDAR & DATE REFERENCE:
- Today's date is: ${currentDayName}, ${currentIsoDate} (Year ${currentYear}).
- Resolve all relative date mentions (such as "tomorrow", "this Friday", "next Tuesday", "in 2 days", "next week") relative to ${currentIsoDate}.

FACTUAL STRICTNESS RULES:
1. Deriving facts ONLY from the text provided below, generate a factual structured JSON output.
2. Do NOT hallucinate, invent, or make up decisions, tasks, or owners if none were explicitly discussed.
3. SCHEDULED EVENTS & DEADLINES:
   - ONLY include items in "detectedEvents" if participants EXPLICITLY scheduled, agreed upon, or mentioned an upcoming event, meeting, sync, demo, presentation, or deadline with a specific date or time.
   - If NO future scheduled events or dates were discussed, "detectedEvents" MUST BE AN EMPTY ARRAY: [].
   - CRITICAL: NEVER hallucinate dummy events (such as "Project Status Meeting", "Upcoming Tasks Meeting") or random past dates (such as "2023-04-01"). If nothing was scheduled, return [].

TRANSCRIPT:
${transcriptText || '(No verbal transcript)'}

MANUAL NOTES:
${manualNotes || '(No manual notes)'}

Respond STRICTLY with valid JSON in this exact structure, with no extra text or commentary:
{
  "overview": "Brief 2-3 sentence meeting summary in ${targetName}",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [{"task": "Task description", "owner": "Name or empty"}],
  "topics": ["Topic 1", "Topic 2"],
  "followUpTasks": ["Follow-up task 1"],
  "detectedEvents": [],
  "timeline": [
    {"timestampSeconds": 0, "label": "Brief topic milestone", "type": "topic"}
  ]
}`;

  try {
    const response = await ai.generate(prompt, {
      model: modelName,
      temperature: 0.1,
    });

    // Extract JSON block
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Model did not return JSON');

    const parsed = JSON.parse(jsonMatch[0]);

    const timeline: TimelineItem[] = Array.isArray(parsed.timeline)
      ? parsed.timeline.map((item: any, i: number) => ({
          id: `tl-${i}-${Date.now()}`,
          timestampSeconds: item.timestampSeconds || 0,
          timeFormatted: formatSecondsToTime(item.timestampSeconds || 0),
          label: item.label || 'Discussion Milestone',
          type: item.type || 'topic',
        }))
      : [];

    // Parse AI-detected events with strict grounding and anti-hallucination verification
    const DUMMY_TITLES = new Set([
      'event name',
      'project status meeting',
      'upcoming tasks meeting',
      'sample event',
      'test meeting',
      'dummy event',
      'placeholder',
      'scheduled event',
      'meeting',
      'none',
      'n/a',
      'null',
    ]);

    const combinedLower = combinedText.toLowerCase();

    if (Array.isArray(parsed.detectedEvents)) {
      for (const ev of parsed.detectedEvents) {
        if (!ev || !ev.title || typeof ev.title !== 'string') continue;
        const rawTitle = ev.title.trim();
        const titleLower = rawTitle.toLowerCase();

        // 1. Skip known placeholder/dummy names
        if (DUMMY_TITLES.has(titleLower)) continue;

        // 2. Strict Grounding Check: at least one significant word from the title must appear in the transcript or notes
        const significantWords = titleLower
          .split(/[\s,.-]+/)
          .filter((w: string) => w.length > 3 && !['about', 'with', 'from', 'this', 'that', 'have', 'will', 'team', 'meet', 'meeting', 'sync'].includes(w));

        const isGroundedInText =
          significantWords.length === 0
            ? combinedLower.includes(titleLower)
            : significantWords.some((w: string) => combinedLower.includes(w));

        if (!isGroundedInText && transcript.length > 0) {
          console.warn(`[HuskyNote] Skipping ungrounded AI event hallucination: "${rawTitle}"`);
          continue;
        }

        // 3. Date resolution and sanity check
        let eventDate = ev.date;
        if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
          // Attempt to parse date from title, notes, or snippet
          const resolved = parseDateExpression(rawTitle + ' ' + (ev.notes || ''), now);
          eventDate = resolved || currentIsoDate;
        }

        // Fix hallucinated past year (e.g. 2023, 2024 before currentYear)
        const eventYear = parseInt(eventDate.split('-')[0], 10);
        if (eventYear < currentYear) {
          const parts = eventDate.split('-');
          eventDate = `${currentYear}-${parts[1]}-${parts[2]}`;
        }

        const timeStr = ev.time && /^\d{1,2}:\d{2}$/.test(ev.time) ? ev.time : '10:00';

        const exists = detectedEvents.some(
          (e) => e.date === eventDate && (e.time === timeStr || e.title.toLowerCase() === titleLower)
        );

        if (!exists) {
          detectedEvents.push({
            id: `ev-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: rawTitle,
            date: eventDate,
            time: timeStr,
            durationMin: Number(ev.durationMin) || 30,
            category: ['meeting', 'deep-work', 'review', 'manual', 'deadline'].includes(ev.category)
              ? ev.category
              : 'meeting',
            completed: false,
            notes: `Identified by Local AI from meeting discussion.`,
            detectedFrom: {
              source: 'meeting',
              sourceTitle: meetingTitle || 'Meeting Title',
              snippet: ev.snippet || rawTitle,
            },
            addedToComputerCalendar: false,
            syncedToGoogle: false,
            createdAt: Date.now(),
          });
        }
    }
  }

    return {
      summary: {
        overview: parsed.overview || (targetSummaryLanguage === 'fil' ? 'Natapos ang pulong.' : 'Meeting completed.'),
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics : [],
        followUpTasks: Array.isArray(parsed.followUpTasks) ? parsed.followUpTasks : [],
        summaryLanguage: targetSummaryLanguage,
        aiGenerated: true,
      },
      timeline,
      detectedEvents,
    };
  } catch (err: any) {
    console.warn('[HuskyNote] AI meeting synthesis fallback:', err?.message);
    // Safe deterministic fallback when AI fails or model JSON malformed
    return {
      summary: {
        overview: targetSummaryLanguage === 'fil'
          ? `Naitala ang pulong na may ${transcript.length} bahagi ng transcript.`
          : `Meeting recorded with ${transcript.length} transcript segment(s). The AI report could not be generated.`,
        decisions: [],
        actionItems: [],
        topics: [],
        followUpTasks: [],
        summaryLanguage: targetSummaryLanguage,
        aiGenerated: false,
        aiError: err?.message || 'The AI did not respond.',
      },
      timeline: transcript.slice(0, 5).map((s, idx) => ({
        id: `tl-${idx}`,
        timestampSeconds: s.timestampSeconds,
        timeFormatted: formatSecondsToTime(s.timestampSeconds),
        label: s.text.slice(0, 40) + '...',
        type: 'topic',
      })),
      detectedEvents,
    };
  }
}

/**
 * Rewrites a meeting's topic list into short, distinct, readable labels:
 * merges duplicates and overlapping items and trims long run-on topics.
 * Throws when the AI fails, so the caller keeps the existing topics.
 */
export async function polishMeetingTopics(
  topics: string[],
  overview: string,
  modelName: string,
  language: string = 'en'
): Promise<string[]> {
  const prompt = `You are editing the "Topics discussed" list of a meeting report.

Meeting summary (context only):
${overview}

Current topics:
${topics.map((t) => `- ${t}`).join('\n')}

Rewrite the list so a reader can scan it in seconds:
- Merge duplicates and topics that overlap into one.
- Each topic is a short noun phrase of 3 to 9 words. Move detail out; do not end with a period.
- Keep names, systems and numbers that matter (for example "24-hour SLA", "Billing API 403").
- Do not invent topics that are not in the current list.
- Keep the order in which they were discussed. Return at most 10 topics.
- Write in ${getLanguageName(language)}.

Return only a JSON array of strings.`;

  const response = await ai.generate(prompt, { model: modelName, temperature: 0.1 });
  return parseTopicList(response);
}

/**
 * Uses Local AI (Ollama) to polish raw speech transcription:
 * - Fixes grammar, punctuation, and fragmented speech chunks
 * - Assigns realistic, accurate speaker names (e.g. Speaker 1, Speaker 2, or detected participant names)
 * - Merges stuttered/split phrases into clean, professional dialogue turns
 */
/**
 * Uses Local AI (Ollama) to polish raw speech transcription:
 * - Fixes grammar, punctuation, and fragmented speech chunks
 * - Assigns realistic, accurate participant names from the meeting app roster (e.g. Arron, Sarah, Alex)
 * - Eliminates generic "Speaker 1" / "Speaker 2" labels
 * - Merges stuttered/split phrases into clean, professional dialogue turns
 */
export async function polishAndDiarizeTranscript(
  transcript: TranscriptSegment[],
  modelName: string,
  knownParticipants: string[] = []
): Promise<TranscriptSegment[]> {
  if (transcript.length === 0) return [];

  const rawLines = transcript
    .map((s, idx) => `[${idx}] [${formatSecondsToTime(s.timestampSeconds)}] ${s.speaker}: ${s.text}`)
    .join('\n');

  const DUMMY_SPEAKER_NAMES = new Set([
    'name1',
    'name2',
    'name3',
    'name4',
    'name5',
    'john doe',
    'jane doe',
    'jane smith',
    'john smith',
    'smith',
    'doe',
    'foo bar',
    'sample name',
    'test user',
    'dummy user',
    'participant 1',
    'participant 2',
    'speaker 1',
    'speaker 2',
    'user 1',
    'user 2',
    'example name',
    'placeholder',
    'none',
    'n/a',
    'null',
    'guest',
  ]);

  const cleanedParticipants = (knownParticipants || [])
    .filter(
      (n) =>
        n &&
        !/^speaker\s*\d*$/i.test(n) &&
        !/^(?:participant|user|name)\s*\d*$/i.test(n) &&
        !DUMMY_SPEAKER_NAMES.has(n.toLowerCase())
    );

  const participantInstruction = cleanedParticipants.length > 0
    ? `KNOWN REAL MEETING PARTICIPANTS: ${cleanedParticipants.join(', ')}.
CRITICAL INSTRUCTION: You MUST attribute speech lines ONLY to these actual named participants (e.g. "${cleanedParticipants[0]}"). DO NOT invent dummy names like "Jane Smith", "John Doe", or generic labels like "Speaker 1".`
    : `Assign accurate speaker names based strictly on spoken introductions in the transcript. DO NOT invent dummy placeholder names like "Jane Smith" or "John Doe". Default to "You / Host" if only one speaker is present.`;

  const prompt = `You are an expert audio transcription editor and speaker diarization specialist.
Clean up, punctuate, and polish this raw spoken transcript. Correct speech recognition misspellings, merge stuttered phrases into clean sentences, and distinguish speakers accurately based on conversational flow.

${participantInstruction}

RAW TRANSCRIPT:
${rawLines}

Respond STRICTLY with a valid JSON array of objects formatted as:
[
  {
    "timestampSeconds": 0,
    "speaker": "${cleanedParticipants[0] || 'You / Host'}",
    "text": "Polished, grammatically correct speech with proper punctuation."
  }
]
Return only the JSON array with no extra text or markdown formatting.`;

  try {
    const response = await ai.generate(prompt, {
      model: modelName,
      temperature: 0.1,
    });

    const match = response.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in AI response');

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty parsed array');

    return parsed.map((item: any, idx: number) => {
      let spk = (item.speaker || '').trim();
      const spkLower = spk.toLowerCase();
      if (
        !spk ||
        /^speaker\s*\d*$/i.test(spk) ||
        /^(?:participant|user|name)\s*\d*$/i.test(spk) ||
        DUMMY_SPEAKER_NAMES.has(spkLower)
      ) {
        spk = cleanedParticipants[idx % Math.max(1, cleanedParticipants.length)] || 'You / Host';
      }
      return {
        id: `seg-polished-${idx}-${Date.now()}`,
        timestampSeconds:
          typeof item.timestampSeconds === 'number'
            ? item.timestampSeconds
            : transcript[Math.min(idx, transcript.length - 1)]?.timestampSeconds || 0,
        speaker: spk,
        text: (item.text || '').trim(),
      };
    });
  } catch (err: any) {
    console.warn('[HuskyNote] AI transcript polish fallback:', err?.message);
    // Safe deterministic fallback: capitalize, punctuate, and replace generic "Speaker 1/2" with known names
    return transcript.map((s, idx) => {
      let finalSpeaker = s.speaker;
      const spkLower = (finalSpeaker || '').toLowerCase();
      if (
        !finalSpeaker ||
        /^speaker\s*\d*$/i.test(finalSpeaker) ||
        /^(?:participant|user|name)\s*\d*$/i.test(finalSpeaker) ||
        DUMMY_SPEAKER_NAMES.has(spkLower)
      ) {
        if (cleanedParticipants.length > 0) {
          finalSpeaker = cleanedParticipants[idx % cleanedParticipants.length];
        } else {
          finalSpeaker = 'You / Host';
        }
      }
      return {
        ...s,
        speaker: finalSpeaker,
        text: s.text.charAt(0).toUpperCase() + s.text.slice(1) + (s.text.endsWith('.') ? '' : '.'),
      };
    });
  }
}
