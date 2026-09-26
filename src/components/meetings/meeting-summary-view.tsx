/**
 * MeetingSummaryView — Meeting Post-Session Intelligence Hub
 * ===========================================================
 * Displays a complete post-meeting intelligence view after recording ends.
 *
 * ARCHITECTURE:
 * - Renders 5 tabs: Single Report, Executive Summary, Verbal Transcript,
 *   Milestone Timeline, and Screenshots.
 * - Reads from `Meeting` object stored in IndexedDB (Dexie).
 * - All AI operations (summarize, polish, translate) happen via local Ollama.
 *
 * KEY FEATURES:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ ① Single Report      — Compiled print-ready publication      │
 * │ ② Executive Summary  — AI-synthesized overview + decisions   │
 * │ ③ Verbal Transcript  — Live speech segments, dual-language   │
 * │ ④ Milestone Timeline — Clickable event log from the session  │
 * │ ⑤ Screenshots        — Full & portion captures with captions  │
 * └──────────────────────────────────────────────────────────────┘
 *
 * OLLAMA DEPENDENCY:
 * - AI Polish, Translation, and Summary Re-synthesis require a running
 *   Ollama instance at http://localhost:11434.
 * - If Ollama is offline, a persistent inline banner guides the user to
 *   install and start it with a single click.
 *
 * EXPORTS:
 * - MeetingSummaryView (default named export)
 */

import React, { useState, useEffect } from 'react';
import type { Meeting } from '../../types';
import { db } from '../../db';
import { Button } from '../ui/button';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import { exportMeetingToMarkdown } from '../../services/export/markdown';
import { exportMeetingToPdf } from '../../services/export/pdf';
import { useWorkspace } from '../../context/workspace-context';
import { MeetingSingleReport } from './meeting-single-report';
import {
  Clock,
  CheckSquare,
  FileText,
  Download,
  Trash2,
  List,
  Sparkles,
  Bookmark,
  Share2,
  ChevronLeft,
  Camera,
  Crop,
  Image,
  X,
  User,
  Wand2,
  Languages,
  ArrowRightLeft,
  RotateCw,
  AlertTriangle,
  ExternalLink,
  Zap,
  Star,
  TrendingUp,
  MessageSquare,
  Tag,
} from 'lucide-react';
import { useAI } from '../../context/ai-context';
import { polishAndDiarizeTranscript, synthesizeMeetingAI } from '../../services/audio/transcriber';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATION_TARGETS,
  translateTranscriptSegments,
  getLanguageName,
} from '../../services/ai/translation';

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

interface MeetingSummaryViewProps {
  /** The full meeting object loaded from IndexedDB */
  meeting: Meeting;
  /** Called after the meeting is permanently deleted */
  onDeleted?: () => void;
  /** Called when user presses the back-to-list button (mobile only) */
  onBackToList?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// OllamaBanner — Proactive Offline AI Notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OllamaBanner
 * Renders a persistent, dismissible warning strip when Ollama is offline.
 * Shown once per session and suppressed after the user acknowledges.
 *
 * @param isConnected - Current Ollama connection status from AIContext
 * @param isChecking  - True while the connection probe is in-flight
 */
const OllamaBanner: React.FC<{
  isConnected: boolean;
  isChecking: boolean;
  onInstallClick: () => void;
}> = ({ isConnected, isChecking, onInstallClick }) => {
  const [dismissed, setDismissed] = useState(false);

  // Re-show if connection status changes to offline
  useEffect(() => {
    if (!isConnected && !isChecking) setDismissed(false);
  }, [isConnected, isChecking]);

  if (isConnected || isChecking || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 dark:bg-amber-500/5 p-4 text-xs"
    >
      {/* Icon */}
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-amber-700 dark:text-amber-400 mb-0.5">
          Local AI (Ollama) is not running
        </p>
        <p className="text-amber-700/80 dark:text-amber-400/70 leading-relaxed">
          AI features — transcript polishing, multilingual translation, and meeting summary
          synthesis — require a local Ollama instance. Install it once, it runs entirely on
          your hardware with no cloud or privacy risk.
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button
            id="ollama-install-btn"
            onClick={onInstallClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors text-[11px]"
            aria-label="Install Ollama — runs local AI on your machine"
          >
            <Zap className="w-3 h-3" aria-hidden="true" />
            1-Click Install Ollama
          </button>
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline text-[11px]"
            aria-label="Open Ollama download page in new tab"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            ollama.com/download
          </a>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors shrink-0"
        aria-label="Dismiss Ollama offline notification"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// KeyPointCard — Highlighted summary fact
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KeyPointCard
 * A compact highlighted card that visually elevates a single key data point
 * (e.g., number of decisions, action items, topics).
 */
const KeyPointCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}> = ({ icon, label, value, accent = 'bg-slate-100 dark:bg-zinc-900' }) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 ${accent} text-center min-w-[80px] flex-1`}
    aria-label={`${label}: ${value}`}
  >
    <span className="text-slate-500 dark:text-zinc-400">{icon}</span>
    <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</span>
    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500">
      {label}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MeetingSummaryView — Primary Component
// ─────────────────────────────────────────────────────────────────────────────

export const MeetingSummaryView: React.FC<MeetingSummaryViewProps> = ({
  meeting,
  onDeleted,
  onBackToList,
}) => {
  // ── Context ──────────────────────────────────────────────────────────────
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();
  const { isConnected, isChecking, selectedModel, startOllamaService, checkConnection } = useAI();

  // ── Local State ───────────────────────────────────────────────────────────
  const [currentMeeting, setCurrentMeeting] = useState<Meeting>(meeting);
  const [activeTab, setActiveTab] = useState<
    'report' | 'summary' | 'transcript' | 'timeline' | 'screenshots'
  >('report');
  const [highlightTimestamp, setHighlightTimestamp] = useState<number | null>(null);
  const [lightboxScreenshot, setLightboxScreenshot] = useState<string | null>(null);
  const [isPolishingAI, setIsPolishingAI] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isResynthesizing, setIsResynthesizing] = useState<boolean>(false);
  const [transcriptViewMode, setTranscriptViewMode] = useState<'dual' | 'translated' | 'original'>(
    'dual'
  );
  const [showOllamaInstalling, setShowOllamaInstalling] = useState(false);

  // Sync meeting prop changes (e.g., parent re-fetches)
  useEffect(() => {
    setCurrentMeeting(meeting);
  }, [meeting]);

  // ── Derived Values ─────────────────────────────────────────────────────────
  const screenshotCount = meeting.screenshots?.length || 0;
  const decisionCount = currentMeeting.summary?.decisions?.length || 0;
  const actionItemCount = currentMeeting.summary?.actionItems?.length || 0;
  const topicCount = currentMeeting.summary?.topics?.length || 0;
  const segmentCount = currentMeeting.transcript.length;

  // ── Ollama 1-Click Install ─────────────────────────────────────────────────

  /**
   * handleInstallOllama
   * Attempts to start Ollama via the local companion service.
   * If the companion is unavailable, opens the official Ollama download
   * page for the user's OS and begins polling for the service.
   */
  const handleInstallOllama = async () => {
    setShowOllamaInstalling(true);
    addToast('Attempting to connect to local Ollama service...', 'info');

    const result = await startOllamaService();

    if (result.success) {
      addToast('Ollama is now running. AI features are ready!', 'success');
      setShowOllamaInstalling(false);
      return;
    }

    // Detect OS for the right download
    const ua = navigator.userAgent.toLowerCase();
    const isMac = ua.includes('macintosh') || ua.includes('mac os');
    const isWin = ua.includes('windows');

    const downloadUrl = isMac
      ? 'https://ollama.com/download/Ollama-darwin.zip'
      : isWin
      ? 'https://ollama.com/download/OllamaSetup.exe'
      : 'https://ollama.com/download';

    addToast(
      'Ollama not found. Opening the installer download — run it, then come back.',
      'warning'
    );

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Poll for Ollama coming online after user installs
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      const ok = await checkConnection();
      if (ok) {
        clearInterval(pollInterval);
        addToast('Ollama detected! AI features are now available.', 'success');
        setShowOllamaInstalling(false);
      } else if (attempts >= 30) {
        // Stop after ~60 seconds
        clearInterval(pollInterval);
        setShowOllamaInstalling(false);
      }
    }, 2000);
  };

  // ── Speaker Renaming ───────────────────────────────────────────────────────

  /**
   * handleRenameSpeaker
   * Prompts the user to rename all transcript segments attributed to
   * `oldName`. Persists the change to IndexedDB immediately.
   *
   * @param oldName - The original speaker label to rename
   */
  const handleRenameSpeaker = async (oldName: string) => {
    const newName = window.prompt(`Rename all segments for "${oldName}" to:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    const trimmed = newName.trim();
    const updatedTranscript = currentMeeting.transcript.map((s) =>
      s.speaker.toLowerCase() === oldName.toLowerCase() ? { ...s, speaker: trimmed } : s
    );

    const updated = { ...currentMeeting, transcript: updatedTranscript };
    setCurrentMeeting(updated);
    await db.meetings.update(currentMeeting.id, { transcript: updatedTranscript });
    addToast(`Renamed "${oldName}" to "${trimmed}".`, 'success');
  };

  // ── AI Polish ──────────────────────────────────────────────────────────────

  /**
   * handlePolishTranscript
   * Sends the raw transcript to the local Ollama model for grammar
   * correction and speaker turn diarization. Updates IndexedDB on success.
   *
   * Requires: isConnected === true && selectedModel is set
   */
  const handlePolishTranscript = async () => {
    if (!isConnected || !selectedModel || currentMeeting.transcript.length === 0) {
      addToast('Local AI (Ollama) is offline or transcript is empty.', 'warning');
      return;
    }
    setIsPolishingAI(true);
    addToast('Local AI is polishing transcript grammar & speaker turns...', 'info');
    try {
      const polished = await polishAndDiarizeTranscript(currentMeeting.transcript, selectedModel);
      const updated = { ...currentMeeting, transcript: polished };
      setCurrentMeeting(updated);
      await db.meetings.update(currentMeeting.id, { transcript: polished });
      addToast('Transcript polished with speaker diarization & grammar.', 'success');
    } catch (err: any) {
      addToast('Failed to polish transcript with AI.', 'error');
    } finally {
      setIsPolishingAI(false);
    }
  };

  // ── Translation ────────────────────────────────────────────────────────────

  /**
   * handleTranslateTranscript
   * Translates each transcript segment into `targetLang` using the local
   * Ollama model. Stores translated text alongside the original in IndexedDB.
   *
   * @param targetLang - BCP-47 language code (e.g., "es", "fr", "fil")
   */
  const handleTranslateTranscript = async (targetLang: string) => {
    if (!isConnected || !selectedModel || currentMeeting.transcript.length === 0) {
      addToast('Local AI is offline or transcript is empty.', 'warning');
      return;
    }
    setIsTranslating(true);
    const targetName = getLanguageName(targetLang);
    addToast(`Translating transcript to ${targetName}...`, 'info');
    try {
      const translated = await translateTranscriptSegments(
        currentMeeting.transcript,
        targetLang,
        selectedModel
      );
      const updated = {
        ...currentMeeting,
        transcript: translated,
        translationLanguage: targetLang,
      };
      setCurrentMeeting(updated);
      await db.meetings.update(currentMeeting.id, {
        transcript: translated,
        translationLanguage: targetLang,
      });
      addToast(`Transcript successfully translated to ${targetName}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Translate error:', err);
      addToast('Failed to translate transcript.', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  // ── Summary Re-synthesis ───────────────────────────────────────────────────

  /**
   * handleResynthesizeSummary
   * Re-runs the full meeting AI synthesis (overview, decisions, action items,
   * topics, timeline milestones) in a different language. Useful for
   * stakeholders who need summaries in their native language.
   *
   * @param lang - BCP-47 output language code for the summary
   */
  const handleResynthesizeSummary = async (lang: string) => {
    if (
      !isConnected ||
      !selectedModel ||
      (currentMeeting.transcript.length === 0 && !currentMeeting.manualNotes.trim())
    ) {
      addToast('Local AI is offline or no meeting content to summarize.', 'warning');
      return;
    }
    setIsResynthesizing(true);
    const langLabel = getLanguageName(lang);
    addToast(`Re-synthesizing meeting summary in ${langLabel}...`, 'info');
    try {
      const result = await synthesizeMeetingAI(
        currentMeeting.transcript,
        currentMeeting.manualNotes,
        selectedModel,
        currentMeeting.title,
        lang
      );
      const updated = {
        ...currentMeeting,
        summary: result.summary,
        timeline: result.timeline.length > 0 ? result.timeline : currentMeeting.timeline,
      };
      setCurrentMeeting(updated);
      await db.meetings.update(currentMeeting.id, {
        summary: result.summary,
        timeline: updated.timeline,
      });
      addToast(`Meeting summary re-synthesized in ${langLabel}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Resynthesize error:', err);
      addToast('Failed to re-synthesize summary.', 'error');
    } finally {
      setIsResynthesizing(false);
    }
  };

  // ── Export Handlers ────────────────────────────────────────────────────────

  /** Export the meeting as a Markdown (.md) file download */
  const handleExportMarkdown = () => {
    const md = exportMeetingToMarkdown(meeting);
    const filename = `${(meeting.title || 'meeting').toLowerCase().replace(/\s+/g, '_')}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Meeting exported to Markdown.', 'success');
  };

  /** Export the meeting as a publication-quality PDF with screenshots */
  const handleExportPdf = () => {
    try {
      exportMeetingToPdf(meeting);
      addToast('Meeting exported to PDF with full notes and screenshots.', 'success');
    } catch (err: any) {
      console.error('[HuskyNote] PDF export failed:', err);
      addToast('Failed to generate PDF export.', 'error');
    }
  };

  /**
   * handleConvertToNote
   * Converts the entire meeting report (Markdown format) into a new Note
   * in the workspace and navigates to it automatically.
   */
  const handleConvertToNote = async () => {
    try {
      const md = exportMeetingToMarkdown(meeting);
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `Meeting Note: ${meeting.title}`,
        content: md,
        tags: ['meeting', 'summary'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast('Converted meeting to note in your workspace.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
    } catch {
      addToast('Failed to convert meeting to note.', 'error');
    }
  };

  /** Permanently delete the meeting and its associated audio blob */
  const handleDelete = async () => {
    if (confirm('Permanently delete this meeting recording and summary?')) {
      await db.meetings.delete(meeting.id);
      if (meeting.audioBlobId) {
        await db.blobs.delete(meeting.audioBlobId);
      }
      addToast('Meeting deleted.', 'info');
      if (onDeleted) onDeleted();
    }
  };

  /**
   * jumpToTimestamp
   * Switches to the Transcript tab and highlights the segment nearest to
   * `sec` seconds. Called from the Timeline tab when an event is clicked.
   *
   * @param sec - Target timestamp in seconds
   */
  const jumpToTimestamp = (sec: number) => {
    setHighlightTimestamp(sec);
    setActiveTab('transcript');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white p-4 sm:p-8 overflow-y-auto max-w-5xl mx-auto w-full transition-colors duration-500 font-sans">

      {/* ── Ollama Offline Banner ── */}
      <OllamaBanner
        isConnected={isConnected}
        isChecking={isChecking}
        onInstallClick={handleInstallOllama}
      />

      {/* ── Ollama Installing Feedback ── */}
      {showOllamaInstalling && (
        <div className="mb-4 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 animate-pulse">
          <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
          <span>Waiting for Ollama to start at localhost:11434…</span>
        </div>
      )}

      {/* ── Header ── */}
      <div
        className="border-b border-slate-200 dark:border-zinc-850 pb-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        role="banner"
      >
        <div>
          {/* Back button (mobile only) */}
          <div className="flex items-center gap-2">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="md:hidden flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
                title="Back to meetings list"
                aria-label="Back to meetings list"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Meetings</span>
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">
              {meeting.title}
            </h2>
          </div>

          {/* Metadata row */}
          <div
            className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400 mt-1.5 font-medium flex-wrap"
            aria-label="Meeting metadata"
          >
            <span className="font-mono">{new Date(meeting.startTime).toLocaleString()}</span>
            <span aria-hidden="true">•</span>
            <span className="flex items-center gap-1 font-mono" title="Meeting duration">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {formatSecondsToTime(meeting.durationSeconds)}
            </span>
            <span aria-hidden="true">•</span>
            <span title={`${segmentCount} transcript segments recorded`}>
              {segmentCount} segments
            </span>
            {currentMeeting.spokenLanguage && (
              <>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400" title="Spoken language detected">
                  <Languages className="w-3 h-3" aria-hidden="true" />
                  <span>Spoken: {getLanguageName(currentMeeting.spokenLanguage)}</span>
                </span>
              </>
            )}
            {currentMeeting.translationLanguage && (
              <>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1 font-mono text-cyan-600 dark:text-cyan-400" title="Transcript translated to this language">
                  <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
                  <span>Translated: {getLanguageName(currentMeeting.translationLanguage)}</span>
                </span>
              </>
            )}
            {screenshotCount > 0 && (
              <>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1" title={`${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''} captured`}>
                  <Camera className="w-3 h-3" aria-hidden="true" />
                  {screenshotCount} screenshot{screenshotCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap" role="group" aria-label="Meeting actions">
          <Button
            size="sm"
            variant="outline"
            onClick={handleConvertToNote}
            className="whitespace-nowrap shrink-0"
            title="Save as a Markdown note in your workspace"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Save as Note</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportMarkdown}
            className="whitespace-nowrap shrink-0"
            title="Download as Markdown file"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Export MD</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleExportPdf}
            className="whitespace-nowrap shrink-0"
            title="Download publication-quality PDF with screenshots"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Export PDF</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            title="Permanently delete this meeting"
            aria-label="Delete meeting"
            className="shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* ── Key Points Strip ── */}
      {/*
        Shows a quick at-a-glance summary of the meeting's quantitative facts.
        This strip is always visible regardless of the active tab, giving the
        user instant context without needing to navigate.
      */}
      <div
        className="flex items-stretch gap-2 mb-6 overflow-x-auto pb-1"
        role="region"
        aria-label="Meeting key metrics"
      >
        <KeyPointCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Duration"
          value={formatSecondsToTime(meeting.durationSeconds)}
        />
        <KeyPointCard
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Segments"
          value={segmentCount}
        />
        {decisionCount > 0 && (
          <KeyPointCard
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            label="Decisions"
            value={decisionCount}
            accent="bg-emerald-50 dark:bg-emerald-950/30"
          />
        )}
        {actionItemCount > 0 && (
          <KeyPointCard
            icon={<Star className="w-3.5 h-3.5" />}
            label="Action Items"
            value={actionItemCount}
            accent="bg-blue-50 dark:bg-blue-950/30"
          />
        )}
        {topicCount > 0 && (
          <KeyPointCard
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Topics"
            value={topicCount}
            accent="bg-purple-50 dark:bg-purple-950/30"
          />
        )}
        {screenshotCount > 0 && (
          <KeyPointCard
            icon={<Camera className="w-3.5 h-3.5" />}
            label="Screenshots"
            value={screenshotCount}
          />
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div
        className="flex items-center border-b border-slate-200 dark:border-zinc-850 mb-6 gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Meeting sections"
      >
        {(
          [
            { id: 'report', label: 'Single Report', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'summary', label: 'Executive Summary', icon: null },
            { id: 'transcript', label: `Verbal Transcript (${segmentCount})`, icon: null },
            { id: 'timeline', label: `Timeline (${currentMeeting.timeline.length})`, icon: null },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-950 dark:border-white dark:text-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}

        {screenshotCount > 0 && (
          <button
            role="tab"
            aria-selected={activeTab === 'screenshots'}
            aria-controls="panel-screenshots"
            id="tab-screenshots"
            onClick={() => setActiveTab('screenshots')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'screenshots'
                ? 'border-slate-900 text-slate-950 dark:border-white dark:text-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" aria-hidden="true" />
            Screenshots ({screenshotCount})
          </button>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* TAB PANELS                                                          */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* ── Tab: Single Compiled Report ── */}
      {activeTab === 'report' && (
        <div role="tabpanel" id="panel-report" aria-labelledby="tab-report">
          <MeetingSingleReport meeting={currentMeeting} onBack={onBackToList} />
        </div>
      )}

      {/* ── Tab: Executive Summary ── */}
      {activeTab === 'summary' && (
        <div
          className="space-y-6"
          role="tabpanel"
          id="panel-summary"
          aria-labelledby="tab-summary"
        >
          {/* ── AI Language Re-synthesis Bar ── */}
          {/*
            Allows re-generating the entire meeting summary in a different
            language. The dropdown contains all supported Ollama-translated
            languages. Useful for multinational teams.
          */}
          <div
            className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 flex-wrap gap-2 text-xs shadow-xs"
            role="toolbar"
            aria-label="Summary language options"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                Summary Language:
              </span>
              {/* Current language pill */}
              <span
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-bold"
                aria-label={`Current summary language: ${
                  currentMeeting.summary?.summaryLanguage
                    ? getLanguageName(currentMeeting.summary.summaryLanguage)
                    : 'English'
                }`}
              >
                {currentMeeting.summary?.summaryLanguage
                  ? `${TRANSLATION_TARGETS.find((t) => t.code === currentMeeting.summary?.summaryLanguage)?.flag || '🌐'} ${getLanguageName(currentMeeting.summary?.summaryLanguage)}`
                  : '🇺🇸 English'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResynthesizeSummary('en')}
                disabled={isResynthesizing || !isConnected}
                className="text-xs font-mono py-1 px-2.5 h-7"
                title="Re-generate summary in English using local AI"
              >
                <RotateCw className={`w-3 h-3 mr-1 text-cyan-500 ${isResynthesizing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>🇺🇸 English</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResynthesizeSummary('fil')}
                disabled={isResynthesizing || !isConnected}
                className="text-xs font-mono py-1 px-2.5 h-7"
                title="Re-generate summary in Filipino using local AI"
              >
                <RotateCw className={`w-3 h-3 mr-1 text-amber-500 ${isResynthesizing ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>🇵🇭 Filipino</span>
              </Button>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleResynthesizeSummary(e.target.value);
                  }
                }}
                disabled={isResynthesizing || !isConnected}
                defaultValue=""
                aria-label="Re-synthesize summary in another language"
                className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700 font-medium cursor-pointer"
                title="Re-synthesize summary in any supported language"
              >
                <option value="" disabled>Other Languages...</option>
                {TRANSLATION_TARGETS.filter(
                  (t) => t.code !== 'none' && t.code !== 'en' && t.code !== 'fil'
                ).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.flag} {t.name.replace('Translate to ', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Executive Overview ── */}
          {/*
            A high-level paragraph generated by the local AI that captures
            the purpose, context, and outcome of the meeting in plain language.
          */}
          <section
            className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
            aria-labelledby="section-overview"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4 text-slate-500 dark:text-zinc-400" aria-hidden="true" />
              <h3 id="section-overview">Overview</h3>
              <span className="ml-auto text-[9px] font-normal text-slate-400 dark:text-zinc-600 normal-case tracking-normal">
                AI-synthesized
              </span>
            </div>
            <p className="text-sm text-slate-900 dark:text-zinc-200 leading-relaxed">
              {currentMeeting.summary?.overview || (
                <span className="italic text-slate-400 dark:text-zinc-600">
                  No overview generated. Use the Summary Language bar above to synthesize one with AI.
                </span>
              )}
            </p>
          </section>

          {/* ── Key Decisions ── */}
          {/*
            Lists formal decisions made during the meeting as identified by
            the local AI. Each bullet is a confirmed agreement or resolution.
            Empty state renders if the AI found no decisions.
          */}
          {meeting.summary && meeting.summary.decisions.length > 0 && (
            <section
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
              aria-labelledby="section-decisions"
            >
              <div className="flex items-center gap-2 mb-3">
                <h3
                  id="section-decisions"
                  className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider"
                >
                  Key Decisions
                </h3>
                {/* Pill badge showing decision count for quick scanning */}
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  {meeting.summary.decisions.length}
                </span>
              </div>
              <ul className="space-y-2" aria-label="Meeting decisions">
                {meeting.summary.decisions.map((dec, i) => (
                  <li key={i} className="text-xs text-slate-800 dark:text-zinc-200 flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" aria-hidden="true" />
                    <span>{dec}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Action Items ── */}
          {/*
            Structured task list extracted by the AI. Each item has a task
            description and optionally an owner (@mention). These can be
            exported to Markdown or PDF and assigned to team members.
          */}
          {meeting.summary && meeting.summary.actionItems.length > 0 && (
            <section
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
              aria-labelledby="section-actions"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3
                    id="section-actions"
                    className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider"
                  >
                    Action Items
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                    {meeting.summary.actionItems.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2.5" role="list" aria-label="Action items">
                {meeting.summary.actionItems.map((item, idx) => (
                  <div
                    key={idx}
                    role="listitem"
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-850 text-xs"
                  >
                    <CheckSquare
                      className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <span className="text-slate-900 dark:text-zinc-200 font-bold">{item.task}</span>
                      {item.owner && (
                        <span
                          className="ml-2 text-[10px] text-slate-700 bg-slate-200 dark:text-zinc-400 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700 font-medium"
                          aria-label={`Assigned to ${item.owner}`}
                        >
                          @{item.owner}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Discussion Topics ── */}
          {/*
            Tag cloud of the main topics discussed. Useful for quickly
            identifying the meeting's thematic scope without reading the
            full transcript.
          */}
          {meeting.summary && meeting.summary.topics.length > 0 && (
            <section
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
              aria-labelledby="section-topics"
            >
              <div className="flex items-center gap-2 mb-3">
                <h3
                  id="section-topics"
                  className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider"
                >
                  Topics Discussed
                </h3>
                <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 text-[10px] font-bold border border-purple-200 dark:border-purple-800">
                  {meeting.summary.topics.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Discussion topics">
                {meeting.summary.topics.map((t, i) => (
                  <span
                    key={i}
                    role="listitem"
                    className="text-xs text-slate-800 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-md font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Participant Notes ── */}
          {/*
            Manual notes typed by the participant during the meeting using
            the live note-taking textarea. Shown verbatim in monospace font.
          */}
          {meeting.manualNotes.trim() && (
            <section
              className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
              aria-labelledby="section-notes"
            >
              <h3
                id="section-notes"
                className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider mb-3"
              >
                Participant Notes
              </h3>
              <div className="font-mono text-xs text-slate-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {meeting.manualNotes}
              </div>
            </section>
          )}

          {/* Empty state when no summary has been generated yet */}
          {!meeting.summary && (
            <div className="text-center py-16 space-y-3">
              <TrendingUp className="w-10 h-10 text-slate-300 dark:text-zinc-700 mx-auto" aria-hidden="true" />
              <p className="text-sm text-slate-500 dark:text-zinc-500 font-medium">
                No AI summary generated yet
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-600 max-w-sm mx-auto leading-relaxed">
                Use the language buttons above (requires Ollama) to synthesize an executive
                summary from the transcript and participant notes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Verbal Transcript ── */}
      {/*
        Displays all speech segments captured during the meeting in
        chronological order. Supports:
        - Speaker renaming (click speaker badge)
        - Language translation via local Ollama
        - Dual-view (original + translation side by side)
        - AI grammar polish & speaker diarization
        - Timestamp highlighting from Timeline tab
      */}
      {activeTab === 'transcript' && (
        <div
          className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-none transition-colors duration-500"
          role="tabpanel"
          id="panel-transcript"
          aria-labelledby="tab-transcript"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-850 mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-mono text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider"
                aria-label={`${segmentCount} transcript segments`}
              >
                Verbal Transcript ({segmentCount} segments)
              </span>
              {currentMeeting.translationLanguage && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                  Translated: {getLanguageName(currentMeeting.translationLanguage)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Transcript actions">
              {/* Language translation dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <Languages className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" aria-hidden="true" />
                <select
                  disabled={isTranslating || !isConnected}
                  onChange={(e) => {
                    const target = e.target.value;
                    if (target) handleTranslateTranscript(target);
                  }}
                  defaultValue=""
                  aria-label="Translate transcript to another language"
                  title={!isConnected ? 'Ollama must be running to translate' : 'Translate transcript to another language'}
                  className="bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>
                    {isTranslating ? 'Translating...' : 'Translate Transcript...'}
                  </option>
                  {TRANSLATION_TARGETS.filter((t) => t.code !== 'none').map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.flag} {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dual/Translated/Original view toggle (only visible when translation exists) */}
              {currentMeeting.transcript.some((s) => s.translation) && (
                <div
                  className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-0.5 text-[11px] font-mono"
                  role="group"
                  aria-label="Transcript view mode"
                >
                  {(['dual', 'translated', 'original'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTranscriptViewMode(mode)}
                      aria-pressed={transcriptViewMode === mode}
                      className={`px-2 py-0.5 rounded transition-all capitalize ${
                        transcriptViewMode === mode
                          ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {mode === 'dual' ? 'Dual View' : mode === 'translated' ? 'Translation' : 'Original'}
                    </button>
                  ))}
                </div>
              )}

              {/* AI Polish button — grammar correction + speaker diarization */}
              {currentMeeting.transcript.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePolishTranscript}
                  disabled={isPolishingAI || !isConnected}
                  className="text-xs font-mono py-1 px-3 h-7"
                  title={
                    !isConnected
                      ? 'Ollama must be running to use AI polish'
                      : 'Use local AI to correct grammar and identify speaker turns (diarization)'
                  }
                >
                  <Wand2
                    className={`w-3.5 h-3.5 mr-1 text-emerald-500 ${isPolishingAI ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isPolishingAI ? 'Diarizing...' : 'AI Polish & Diarize'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Transcript segment list */}
          {currentMeeting.transcript.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 dark:text-zinc-500">
              No verbal transcript was recorded for this session.
            </div>
          ) : (
            <div role="list" aria-label="Transcript segments">
              {currentMeeting.transcript.map((seg, idx) => {
                const isTarget =
                  highlightTimestamp !== null &&
                  Math.abs(seg.timestampSeconds - highlightTimestamp) < 3;

                // Color-code speakers: speaker 1 (host) = emerald, others = indigo
                const isSpeaker1 =
                  seg.speaker.includes('1') ||
                  seg.speaker.toLowerCase().includes('host') ||
                  seg.speaker.toLowerCase().includes('you');
                const badgeColor = isSpeaker1
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30';

                const showDual = transcriptViewMode === 'dual' && seg.translation;
                const showTranslatedOnly = transcriptViewMode === 'translated' && seg.translation;

                return (
                  <div
                    key={seg.id || `sum-seg-${idx}`}
                    role="listitem"
                    aria-label={`${seg.speaker} at ${formatSecondsToTime(seg.timestampSeconds)}`}
                    className={`p-3.5 rounded-lg border text-xs transition-colors space-y-1.5 mb-2 ${
                      isTarget
                        ? 'bg-slate-200 dark:bg-zinc-800/80 border-slate-900 dark:border-white text-slate-950 dark:text-white shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-850 text-slate-800 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1 font-medium">
                      <div className="flex items-center gap-2">
                        {/* Speaker badge — click to rename */}
                        <button
                          onClick={() => handleRenameSpeaker(seg.speaker)}
                          className={`font-semibold px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 hover:brightness-110 cursor-pointer ${badgeColor}`}
                          title={`Click to rename all segments for "${seg.speaker}"`}
                          aria-label={`Speaker: ${seg.speaker}. Click to rename.`}
                        >
                          <User className="w-2.5 h-2.5" aria-hidden="true" />
                          <span>{seg.speaker}</span>
                        </button>
                        {/* Source language tag (if detected) */}
                        {seg.sourceLanguage && (
                          <span
                            className="text-[9px] font-mono px-1 rounded bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700"
                            aria-label={`Source language: ${seg.sourceLanguage}`}
                          >
                            {seg.sourceLanguage}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 dark:text-zinc-400" aria-label={`Timestamp: ${formatSecondsToTime(seg.timestampSeconds)}`}>
                        {formatSecondsToTime(seg.timestampSeconds)}
                      </span>
                    </div>

                    {/* Content: dual / translated-only / original */}
                    {showDual ? (
                      <div className="space-y-1 pl-1">
                        <div className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed italic border-l-2 border-slate-300 dark:border-zinc-700 pl-2">
                          <span className="text-[9px] font-mono uppercase text-slate-400 dark:text-zinc-500 mr-1.5">
                            Original:
                          </span>
                          {seg.originalText || seg.text}
                        </div>
                        <div className="text-slate-900 dark:text-zinc-100 text-xs font-medium leading-relaxed border-l-2 border-emerald-500/60 pl-2">
                          <span className="text-[9px] font-mono uppercase text-emerald-600 dark:text-emerald-400 mr-1.5">
                            Translated:
                          </span>
                          {seg.translation}
                        </div>
                      </div>
                    ) : showTranslatedOnly ? (
                      <p className="text-slate-900 dark:text-zinc-100 text-xs leading-relaxed pl-1 font-medium">
                        {seg.translation}
                      </p>
                    ) : (
                      <p className="leading-relaxed pl-1">{seg.originalText || seg.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Milestone Timeline ── */}
      {/*
        Chronological event log of notable moments captured during the
        meeting (topic shifts, key statements, etc.). Each item is clickable
        and jumps the Transcript tab to the matching timestamp.
      */}
      {activeTab === 'timeline' && (
        <div
          className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-4 shadow-xs dark:shadow-none transition-colors duration-500"
          role="tabpanel"
          id="panel-timeline"
          aria-labelledby="tab-timeline"
        >
          {meeting.timeline.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 dark:text-zinc-500">
              No timeline milestones recorded for this session.
            </div>
          ) : (
            <ol aria-label="Meeting timeline milestones">
              {meeting.timeline.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => jumpToTimestamp(item.timestampSeconds)}
                    className="w-full flex items-start gap-4 p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-750 cursor-pointer transition-all group text-left mb-2"
                    aria-label={`Jump to ${item.timeFormatted} — ${item.label}`}
                    title="Click to jump to this moment in the transcript"
                  >
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400 group-hover:text-slate-950 dark:group-hover:text-white shrink-0 pt-0.5 font-medium">
                      {item.timeFormatted}
                    </span>
                    <div className="w-px h-6 bg-slate-200 dark:bg-zinc-800" aria-hidden="true" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 group-hover:text-slate-950 dark:group-hover:text-white">
                        {item.label}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                        {item.type} · click to jump to transcript
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* ── Tab: Screenshots ── */}
      {/*
        Grid of screenshots captured during the meeting using the in-session
        camera toolbar. Each card shows timestamp, type (Full/Portion), and
        caption. Click any image to open the lightbox preview.
      */}
      {activeTab === 'screenshots' && (
        <div
          className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 shadow-xs dark:shadow-none transition-colors duration-500"
          role="tabpanel"
          id="panel-screenshots"
          aria-labelledby="tab-screenshots"
        >
          {!meeting.screenshots || meeting.screenshots.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500 dark:text-zinc-500">
              No screenshots were captured during this session.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
              {meeting.screenshots.map((ss, idx) => (
                <div
                  key={ss.id}
                  role="listitem"
                  className="group rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
                  onClick={() => setLightboxScreenshot(ss.dataUrl)}
                  onKeyDown={(e) => e.key === 'Enter' && setLightboxScreenshot(ss.dataUrl)}
                  tabIndex={0}
                  aria-label={`${ss.caption || `Screenshot ${idx + 1}`} at ${formatSecondsToTime(ss.timestampSeconds)}`}
                >
                  <div className="relative">
                    <img
                      src={ss.dataUrl}
                      alt={ss.caption || `Screenshot ${idx + 1}`}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-white/90 font-semibold">
                          {formatSecondsToTime(ss.timestampSeconds)}
                        </span>
                        <span className="text-[10px] text-white/80 font-medium flex items-center gap-1">
                          {ss.type === 'portion' ? (
                            <>
                              <Crop className="w-2.5 h-2.5" aria-hidden="true" />
                              <span>Portion</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-2.5 h-2.5" aria-hidden="true" />
                              <span>Full</span>
                            </>
                          )}
                        </span>
                      </div>
                      {ss.caption && (
                        <p className="text-[11px] text-white/80 mt-1 line-clamp-1">{ss.caption}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Screenshot Lightbox ── */}
      {lightboxScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxScreenshot(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxScreenshot(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white transition-colors"
              aria-label="Close screenshot preview"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <img
              src={lightboxScreenshot}
              alt="Screenshot full preview"
              className="w-full rounded-lg border border-zinc-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
