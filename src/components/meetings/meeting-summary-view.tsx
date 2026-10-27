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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Meeting } from '../../types';
import { db } from '../../db';
import { deleteMeetingRecording } from '../../services/audio/recording-storage';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Toolbar, ToolbarGroup } from '../ui/toolbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { NativeSelect } from '../ui/native-select';
import { EmptyState } from '../ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import { exportMeetingToMarkdown } from '../../services/export/markdown';
import { exportMeetingToPdf } from '../../services/export/pdf';
import { useWorkspace } from '../../context/workspace-context';
import { MeetingSingleReport } from './meeting-single-report';
import { ScreenshotLightbox } from './screenshot-lightbox';
import { speakerColorMap, speakerDotClass } from './speaker-colors';
import {
  FileText,
  Download,
  Trash2,
  Sparkles,
  Bookmark,
  ChevronLeft,
  Camera,
  Crop,
  X,
  Wand2,
  Languages,
  ArrowRightLeft,
  RotateCw,
  AlertTriangle,
  ChevronDown,
  Copy,
  TrendingUp,
  CalendarDays,
  Pencil,
  Undo2,
  Combine,
  Wrench,
  FilePlus2,
  ClipboardPaste,
} from 'lucide-react';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES } from '../../services/ai/active-provider';
import { polishAndDiarizeTranscript, polishMeetingTopics, synthesizeMeetingAI } from '../../services/audio/transcriber';
import { isAiReportMissing, meetingDurationSeconds } from '../../services/meetings/meeting-report';
import { finishInterruptedRecording, isUnfinishedRecording, unmergeMeeting } from '../../services/meetings/merge';
import { MergeMeetingsDialog } from './merge-meetings-dialog';
import { RecordingParts } from './recording-parts';
import { SupplementTranscriptDialog } from './supplement-transcript-dialog';
import { PasteTranscriptDialog } from './paste-transcript-dialog';
import { restoreOriginalTranscript } from '../../services/meetings/supplement-store';
import { SETTINGS_TAB_STORAGE_KEY } from '../../views/settings-view';
import type { ScheduleEvent } from '../../types';
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
 * A compact, dismissible single line shown only when Ollama is the ACTIVE AI
 * provider and it is offline. Links to Settings for setup.
 */
const OllamaBanner: React.FC<{
  isConnected: boolean;
  isChecking: boolean;
  onSetupClick: () => void;
}> = ({ isConnected, isChecking, onSetupClick }) => {
  const [dismissed, setDismissed] = useState(false);

  // Re-show if connection status changes to offline
  useEffect(() => {
    if (!isConnected && !isChecking) setDismissed(false);
  }, [isConnected, isChecking]);

  if (isConnected || isChecking || dismissed) return null;

  // role="status" (polite) without an aria-live attribute: aria-live regions stay exposed while a dialog is open
  return (
    <Alert variant="warning" role="status" className="mb-6 flex items-center gap-2 py-1.5 pl-3 pr-1.5 [&>svg]:translate-y-0">
      <AlertTriangle aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Local AI (Ollama) is not running</span>
      <Button id="ollama-install-btn" variant="link" size="xs" onClick={onSetupClick} className="font-semibold">
        Set up
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:bg-warning/10"
        aria-label="Dismiss Ollama offline notification"
      >
        <X aria-hidden="true" />
      </Button>
    </Alert>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// KeyStat — one fact in the inline key-metrics row
// ─────────────────────────────────────────────────────────────────────────────

const KeyStat: React.FC<{
  label: string;
  value: string | number;
  title?: string;
  mono?: boolean;
}> = ({ label, value, title, mono }) => (
  <div className="min-w-0" title={title}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={cn('mt-0.5 text-sm font-semibold tabular-nums text-foreground', mono && 'font-mono')}>{value}</dd>
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
  const { addToast, setActiveView, setActiveNoteId, setActiveMeetingId } = useWorkspace();
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isUnmerging, setIsUnmerging] = useState(false);
  const [isSupplementOpen, setIsSupplementOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const { isConnected, isChecking, selectedModel, provider } = useAI();

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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  // Enter saves and unmounts the input, which can also fire blur; save once
  const titleEditOpenRef = useRef(false);
  const [isPolishingTopics, setIsPolishingTopics] = useState(false);
  const [topicsBeforePolish, setTopicsBeforePolish] = useState<string[] | null>(null);
  const [transcriptViewMode, setTranscriptViewMode] = useState<'dual' | 'translated' | 'original'>(
    'dual'
  );

  // Sync meeting prop changes (e.g., parent re-fetches)
  useEffect(() => {
    setCurrentMeeting(meeting);
  }, [meeting]);

  useEffect(() => {
    titleEditOpenRef.current = false;
    setIsEditingTitle(false);
    setTopicsBeforePolish(null);
  }, [meeting.id]);

  // ── Derived Values ─────────────────────────────────────────────────────────
  const screenshotCount = currentMeeting.screenshots?.length || 0;
  const decisionCount = currentMeeting.summary?.decisions?.length || 0;
  const actionItemCount = currentMeeting.summary?.actionItems?.length || 0;
  const topicCount = currentMeeting.summary?.topics?.length || 0;
  const segmentCount = currentMeeting.transcript.length;
  const providerName = PROVIDER_NAMES[provider];
  const reportMissing = isAiReportMissing(currentMeeting);
  const reportLanguage = currentMeeting.summary?.summaryLanguage || 'en';
  const durationSeconds = meetingDurationSeconds(currentMeeting);
  // Speaker dots use chart-1..5 in order of first appearance
  const speakerColors = useMemo(
    () => speakerColorMap(currentMeeting.transcript.map((s) => s.speaker)),
    [currentMeeting.transcript]
  );

  // ── Title ────────────────────────────────────────────────────────────────

  const startEditingTitle = () => {
    setTitleDraft(currentMeeting.title);
    titleEditOpenRef.current = true;
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    titleEditOpenRef.current = false;
    setIsEditingTitle(false);
  };

  /** Saves the edited title; an empty title keeps the old one */
  const saveTitle = async () => {
    if (!titleEditOpenRef.current) return;
    titleEditOpenRef.current = false;
    setIsEditingTitle(false);
    const title = titleDraft.trim().replace(/\s+/g, ' ');
    if (!title || title === currentMeeting.title) return;
    setCurrentMeeting({ ...currentMeeting, title });
    try {
      await db.meetings.update(currentMeeting.id, { title });
    } catch (err) {
      console.warn('[HuskyNote] Rename meeting error:', err);
      setCurrentMeeting(currentMeeting);
      addToast('Could not rename the meeting. Please try again.', 'error');
    }
  };

  // ── Topics ───────────────────────────────────────────────────────────────

  /** Asks the AI to merge, shorten and tidy the topics, keeping the old list for Undo */
  const handlePolishTopics = async () => {
    const summary = currentMeeting.summary;
    if (!summary || summary.topics.length === 0) return;
    if (!isConnected || !selectedModel) {
      addToast(`${providerName} is not connected. Set it up in Settings, then try again.`, 'warning');
      return;
    }
    setIsPolishingTopics(true);
    try {
      const topics = await polishMeetingTopics(summary.topics, summary.overview, selectedModel, reportLanguage);
      const updatedSummary = { ...summary, topics };
      setTopicsBeforePolish(summary.topics);
      setCurrentMeeting({ ...currentMeeting, summary: updatedSummary });
      await db.meetings.update(currentMeeting.id, { summary: updatedSummary });
      addToast(`Topics polished: ${summary.topics.length} became ${topics.length}.`, 'success');
    } catch (err: any) {
      console.warn('[HuskyNote] Polish topics error:', err);
      addToast(`Could not polish topics: ${err?.message || 'the AI did not respond.'}`, 'error');
    } finally {
      setIsPolishingTopics(false);
    }
  };

  const handleUndoTopics = async () => {
    if (!topicsBeforePolish || !currentMeeting.summary) return;
    const updatedSummary = { ...currentMeeting.summary, topics: topicsBeforePolish };
    setTopicsBeforePolish(null);
    setCurrentMeeting({ ...currentMeeting, summary: updatedSummary });
    await db.meetings.update(currentMeeting.id, { summary: updatedSummary });
    addToast('Restored the original topics.', 'info');
  };

  const topicsActions = (
    <div className="ml-auto flex items-center gap-1">
      {topicsBeforePolish && (
        <Button size="xs" variant="ghost" onClick={handleUndoTopics} title="Restore the topics from before polishing">
          <Undo2 aria-hidden="true" />
          <span>Undo</span>
        </Button>
      )}
      <Button
        size="xs"
        variant="outline"
        onClick={handlePolishTopics}
        disabled={isPolishingTopics || !isConnected}
        title={isConnected ? `Merge, shorten and tidy the topics with ${providerName}` : `Connect ${providerName} in Settings to polish topics`}
      >
        <Wand2 className={cn(isPolishingTopics && 'animate-pulse')} aria-hidden="true" />
        <span>{isPolishingTopics ? 'Polishing…' : 'Polish topics'}</span>
      </Button>
    </div>
  );

  /** Opens Settings on the AI tab, where the Claude key or Ollama connection is set up */
  const openAiSettings = () => {
    window.dispatchEvent(new CustomEvent('huskynote:settings-tab', { detail: 'ai' }));
    try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, 'ai'); } catch { /* URL remains the fallback */ }
    setActiveView('settings');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'ai');
    window.history.replaceState(window.history.state, '', url.toString());
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
    if (currentMeeting.transcript.length === 0 && !currentMeeting.manualNotes.trim()) {
      addToast('This meeting has no transcript or notes to summarize.', 'warning');
      return;
    }
    if (!isConnected || !selectedModel) {
      addToast(`${providerName} is not connected. Set it up in Settings, then try again.`, 'warning');
      return;
    }
    setIsResynthesizing(true);
    const langLabel = getLanguageName(lang);
    try {
      const result = await synthesizeMeetingAI(
        currentMeeting.transcript,
        currentMeeting.manualNotes,
        selectedModel,
        currentMeeting.title,
        lang
      );
      if (!result.summary.aiGenerated) {
        // Keep a report the AI already wrote; only a missing one records why this attempt failed
        if (reportMissing) {
          setCurrentMeeting({ ...currentMeeting, summary: result.summary });
          await db.meetings.update(currentMeeting.id, { summary: result.summary });
        }
        addToast(`Could not generate the report: ${result.summary.aiError || 'the AI did not respond.'}`, 'error');
        return;
      }
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
      const added = await addDetectedEvents(result.detectedEvents);
      addToast(
        added > 0
          ? `Report generated in ${langLabel}. ${added} event${added === 1 ? '' : 's'} added to Schedule.`
          : `Report generated in ${langLabel}.`,
        'success'
      );
    } catch (err: any) {
      console.warn('[HuskyNote] Resynthesize error:', err);
      addToast(`Could not generate the report: ${err?.message || 'unknown error'}`, 'error');
    } finally {
      setIsResynthesizing(false);
    }
  };

  /** Saves events the AI found in the meeting, skipping ones already on the schedule */
  const addDetectedEvents = async (events: ScheduleEvent[]): Promise<number> => {
    let added = 0;
    for (const ev of events) {
      const title = ev.title.toLowerCase();
      const exists = await db.schedule
        .filter((e) => e.date === ev.date && (e.time === ev.time || e.title.toLowerCase() === title))
        .count();
      if (!exists) {
        await db.schedule.put(ev);
        added++;
      }
    }
    return added;
  };

  // ── Export Handlers ────────────────────────────────────────────────────────

  /** Export the meeting as a Markdown (.md) file download */
  const handleExportMarkdown = () => {
    const md = exportMeetingToMarkdown(currentMeeting);
    const filename = `${(currentMeeting.title || 'meeting').toLowerCase().replace(/\s+/g, '_')}.md`;
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
      exportMeetingToPdf(currentMeeting);
      addToast('Meeting exported to PDF with full notes and screenshots.', 'success');
    } catch (err: any) {
      console.error('[HuskyNote] PDF export failed:', err);
      addToast('Failed to generate PDF export.', 'error');
    }
  };

  /** Copy the meeting report (Markdown) to the clipboard */
  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(exportMeetingToMarkdown(currentMeeting));
      addToast('Report copied to clipboard.', 'info');
    } catch {
      addToast('Could not copy to clipboard.', 'error');
    }
  };

  /**
   * handleConvertToNote
   * Converts the entire meeting report (Markdown format) into a new Note
   * in the workspace and navigates to it automatically.
   */
  const handleConvertToNote = async () => {
    try {
      const md = exportMeetingToMarkdown(currentMeeting, { frontMatter: false });
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `Meeting Note: ${currentMeeting.title}`,
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

  /** Join an interrupted recording's saved audio and set its real length */
  const handleFinishSaving = async () => {
    setIsFinishing(true);
    try {
      await finishInterruptedRecording(currentMeeting.id);
      addToast('Recording finished saving. Its audio and length are fixed.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not finish saving this recording.', 'error');
    } finally {
      setIsFinishing(false);
    }
  };

  /** Undo "Supplement with the Teams transcript" */
  const handleRestoreTranscript = async () => {
    if (!confirm('Restore the transcript from before it was supplemented? The supplemented version will be replaced.')) return;
    try {
      await restoreOriginalTranscript(currentMeeting.id);
      addToast('Original transcript restored.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not restore the original transcript.', 'error');
    }
  };

  /** Remove a merged meeting and bring its original recordings back */
  const handleUnmerge = async () => {
    if (!confirm('Unmerge? The merged meeting is removed and its original recordings come back to your Meetings list. Nothing else is deleted.')) return;
    setIsUnmerging(true);
    try {
      const restored = await unmergeMeeting(currentMeeting.id);
      addToast('Unmerged. The original recordings are back in your Meetings list.', 'success');
      if (restored[0]) setActiveMeetingId(restored[0]);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not unmerge this meeting.', 'error');
    } finally {
      setIsUnmerging(false);
    }
  };

  /** Permanently delete the meeting and its associated audio blob */
  const handleDelete = async () => {
    // Deleting a merged meeting only undoes the merge; its recordings are kept
    if (currentMeeting.parts?.length) {
      await handleUnmerge();
      return;
    }
    if (confirm('Permanently delete this meeting recording and summary?')) {
      try {
        await deleteMeetingRecording(currentMeeting.id);
        addToast('Meeting deleted.', 'info');
        if (onDeleted) onDeleted();
      } catch {
        addToast('Could not delete currentMeeting. Please try again.', 'error');
      }
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

  const exportItems = [
    { label: 'PDF', icon: <Download />, run: handleExportPdf },
    { label: 'Markdown', icon: <FileText />, run: handleExportMarkdown },
    { label: 'Copy', icon: <Copy />, run: handleCopyReport },
    { label: 'Save as note', icon: <Bookmark />, run: handleConvertToNote },
  ];
  const hasTranslation = currentMeeting.transcript.some((s) => s.translation);
  const summaryLanguageName = currentMeeting.summary?.summaryLanguage
    ? getLanguageName(currentMeeting.summary.summaryLanguage)
    : 'English';

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-background text-foreground">
      <SupplementTranscriptDialog
        open={isSupplementOpen}
        onOpenChange={setIsSupplementOpen}
        meeting={currentMeeting}
        onDone={(message) => addToast(message, 'success')}
      />

      <PasteTranscriptDialog
        open={isPasteOpen}
        onOpenChange={setIsPasteOpen}
        meetingId={currentMeeting.id}
        onDone={(message) => addToast(message, 'success')}
      />

      <MergeMeetingsDialog
        open={isMergeOpen}
        onOpenChange={setIsMergeOpen}
        current={currentMeeting}
        onMerged={(mergedId) => {
          addToast('Meetings merged. Generate one report for the whole meeting below.', 'success');
          setActiveMeetingId(mergedId);
        }}
        onError={(message) => addToast(`Could not merge: ${message}`, 'error')}
      />

      {/* ── Detail toolbar: back (phones) and meeting actions ── */}
      <Toolbar className="gap-2 px-3 sm:px-4">
        {onBackToList && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="-ml-1 md:hidden"
            title="Back to meetings list"
            aria-label="Back to meetings list"
          >
            <ChevronLeft aria-hidden="true" />
            <span>Meetings</span>
          </Button>
        )}

        <ToolbarGroup className="ml-auto" role="group" aria-label="Meeting actions">
          {!currentMeeting.parts?.length && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsMergeOpen(true)}
              title="Merge with other recordings of this meeting"
            >
              <Combine aria-hidden="true" />
              <span className="hidden sm:inline">Merge</span>
            </Button>
          )}
          {currentMeeting.transcript.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsSupplementOpen(true)}
              title="Improve this transcript with the Teams transcript of the same meeting"
            >
              <FilePlus2 aria-hidden="true" />
              <span className="hidden sm:inline">Supplement</span>
            </Button>
          )}
          <DropdownMenu open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" title="Export or save this meeting">
                <Download aria-hidden="true" />
                <span>Export</span>
                <ChevronDown
                  className={cn('text-muted-foreground transition-transform duration-150', isExportOpen && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" aria-label="Export meeting">
              {exportItems.map((item) => (
                <DropdownMenuItem key={item.label} onSelect={() => item.run()}>
                  {item.icon}
                  <span>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!reportMissing && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => handleResynthesizeSummary(reportLanguage)}
              disabled={isResynthesizing || !isConnected}
              title={isConnected ? `Regenerate the report with ${providerName}` : `Connect ${providerName} in Settings to regenerate the report`}
              aria-label="Regenerate report"
              className="text-muted-foreground"
            >
              <RotateCw className={cn(isResynthesizing && 'animate-spin')} aria-hidden="true" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDelete}
            title="Permanently delete this meeting"
            aria-label="Delete meeting"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 lg:px-12">
          {/* ── Ollama Offline Banner (only when Ollama is the active provider) ── */}
          {provider === 'ollama' && !reportMissing && (
            <OllamaBanner
              isConnected={isConnected}
              isChecking={isChecking}
              onSetupClick={() => setActiveView('settings')}
            />
          )}

          {/* ── Title (click to rename) ── */}
          <div className="flex min-w-0 items-start">
            {isEditingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle();
                  if (e.key === 'Escape') cancelEditingTitle();
                }}
                onFocus={(e) => e.currentTarget.select()}
                maxLength={120}
                aria-label="Meeting title"
                className="-mx-1.5 w-full min-w-0 rounded-md bg-transparent px-1.5 text-3xl font-bold leading-tight tracking-tight text-foreground outline-none ring-1 ring-ring/40 focus-visible:ring-[3px] focus-visible:ring-ring/20 sm:text-4xl"
              />
            ) : (
              // The heading wraps the rename button (a heading inside a button is invalid HTML)
              <h2 className="-mx-1.5 min-w-0 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                <button
                  type="button"
                  onClick={startEditingTitle}
                  title="Rename meeting"
                  className="group flex min-w-0 max-w-full items-start gap-2 rounded-md px-1.5 text-left transition-colors duration-100 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 break-words">{currentMeeting.title}</span>
                  <Pencil
                    className="mt-2.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 coarse:opacity-100 sm:mt-3.5"
                    aria-hidden="true"
                  />
                </button>
              </h2>
            )}
          </div>

          {/* ── Metadata row ── */}
          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground"
            aria-label="Meeting metadata"
          >
            <span className="inline-flex items-center gap-1.5" title="Meeting start time">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {new Date(currentMeeting.startTime).toLocaleString()}
            </span>
            {currentMeeting.spokenLanguage && (
              <span className="inline-flex items-center gap-1.5" title="Spoken language detected">
                <Languages className="size-3.5" aria-hidden="true" />
                <span>Spoken: {getLanguageName(currentMeeting.spokenLanguage)}</span>
              </span>
            )}
            {currentMeeting.translationLanguage && (
              <span className="inline-flex items-center gap-1.5" title="Transcript translated to this language">
                <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                <span>Translated: {getLanguageName(currentMeeting.translationLanguage)}</span>
              </span>
            )}
          </div>

          {/* ── Interrupted recording: join its audio and fix its length ── */}
          {isUnfinishedRecording(currentMeeting) && (
            <Alert variant="info" role="status" className="mt-6">
              <Wrench aria-hidden="true" />
              <AlertTitle>This recording didn't finish saving</AlertTitle>
              <AlertDescription>
                The page reloaded or Stop failed while it was recording. Its transcript and audio are saved.
                Finish saving to join the audio into one file and fix the meeting length.
              </AlertDescription>
              <div className="col-start-2 mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleFinishSaving()} disabled={isFinishing}>
                  {isFinishing ? 'Finishing…' : 'Finish saving'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsMergeOpen(true)}>
                  Merge with other recordings
                </Button>
              </div>
            </Alert>
          )}

          {/* ── Supplemented transcript: where it came from, with an undo ── */}
          {currentMeeting.transcriptSupplement && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" role="status">
              <FilePlus2 className="size-3.5" aria-hidden="true" />
              <span>
                Transcript supplemented with {currentMeeting.transcriptSupplement.fileName} on{' '}
                {new Date(currentMeeting.transcriptSupplement.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
              </span>
              {currentMeeting.originalTranscript && (
                <Button size="xs" variant="link" className="h-auto px-0" onClick={() => void handleRestoreTranscript()}>
                  Restore original
                </Button>
              )}
            </p>
          )}

          {/* ── Merged meeting: its recordings, playable, with an undo ── */}
          <RecordingParts meeting={currentMeeting} onUnmerge={() => void handleUnmerge()} busy={isUnmerging} />

          {/* ── Missing report: retry once an AI is connected ── */}
          {reportMissing && (
            <Alert variant="warning" role="status" className="mt-6">
              <Sparkles aria-hidden="true" />
              <AlertTitle>No AI report yet</AlertTitle>
              <AlertDescription>
                {isConnected
                  ? `${providerName} is ready. Generate the summary, decisions, action items and timeline from the saved transcript.`
                  : `${currentMeeting.summary?.aiError || 'The AI could not write this report.'} Connect ${providerName} in Settings, then generate it here.`}
              </AlertDescription>
              <div className="col-start-2 mt-2.5 flex">
                {isConnected || isChecking ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleResynthesizeSummary(reportLanguage)}
                    disabled={isResynthesizing || !isConnected}
                  >
                    <RotateCw className={cn(isResynthesizing && 'animate-spin')} aria-hidden="true" />
                    <span>{isResynthesizing ? 'Generating…' : isChecking && !isConnected ? 'Checking AI…' : 'Generate report'}</span>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={openAiSettings}>
                    Open AI settings
                  </Button>
                )}
              </div>
            </Alert>
          )}

          {/* ── Key metrics: inline stat row, always visible regardless of the active tab ── */}
          <div role="region" aria-label="Meeting key metrics" className="mt-6">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <KeyStat label="Duration" value={formatSecondsToTime(durationSeconds)} title="Meeting duration" mono />
              <KeyStat label="Segments" value={segmentCount} title={`${segmentCount} transcript segments recorded`} />
              {decisionCount > 0 && <KeyStat label="Decisions" value={decisionCount} />}
              {actionItemCount > 0 && <KeyStat label="Action Items" value={actionItemCount} />}
              {topicCount > 0 && <KeyStat label="Topics" value={topicCount} />}
              {screenshotCount > 0 && (
                <KeyStat
                  label="Screenshots"
                  value={screenshotCount}
                  title={`${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''} captured`}
                />
              )}
            </dl>
          </div>

          {/* ━━ Tabs ━━ */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as typeof activeTab)}
            className="mt-8"
          >
            <TabsList variant="line" aria-label="Meeting sections">
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="transcript">Transcript ({segmentCount})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline ({currentMeeting.timeline.length})</TabsTrigger>
              {screenshotCount > 0 && <TabsTrigger value="screenshots">Screenshots ({screenshotCount})</TabsTrigger>}
            </TabsList>

            {/* ── Tab: Single Compiled Report ── */}
            <TabsContent value="report" className="mt-8">
              <MeetingSingleReport meeting={currentMeeting} onBack={onBackToList} topicsActions={topicsActions} />
            </TabsContent>

            {/* ── Tab: Executive Summary ── */}
            <TabsContent value="summary" className="mt-6 space-y-10">
              {/* Re-generate the whole summary in another language */}
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
                role="toolbar"
                aria-label="Summary language options"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium text-foreground">Summary Language:</span>
                  <Badge variant="secondary" aria-label={`Current summary language: ${summaryLanguageName}`}>
                    {summaryLanguageName}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResynthesizeSummary('en')}
                    disabled={isResynthesizing || !isConnected}
                    title={`Regenerate the summary in English with ${providerName}`}
                  >
                    <RotateCw className={cn('text-muted-foreground', isResynthesizing && 'animate-spin')} aria-hidden="true" />
                    <span>English</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResynthesizeSummary('fil')}
                    disabled={isResynthesizing || !isConnected}
                    title={`Regenerate the summary in Filipino with ${providerName}`}
                  >
                    <RotateCw className={cn('text-muted-foreground', isResynthesizing && 'animate-spin')} aria-hidden="true" />
                    <span>Filipino</span>
                  </Button>
                  <NativeSelect
                    onChange={(e) => {
                      if (e.target.value) {
                        handleResynthesizeSummary(e.target.value);
                      }
                    }}
                    disabled={isResynthesizing || !isConnected}
                    defaultValue=""
                    aria-label="Re-synthesize summary in another language"
                    title="Re-synthesize summary in any supported language"
                    containerClassName="w-auto"
                    className="h-7 w-44"
                  >
                    <option value="" disabled>Other Languages...</option>
                    {TRANSLATION_TARGETS.filter(
                      (t) => t.code !== 'none' && t.code !== 'en' && t.code !== 'fil'
                    ).map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name.replace('Translate to ', '')}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* ── Executive Overview ── */}
              <section className="space-y-3" aria-labelledby="section-overview">
                <div className="flex items-center gap-2">
                  <h3 id="section-overview" className="text-base font-semibold text-foreground">Overview</h3>
                  <span className="ml-auto text-xs text-muted-foreground">AI-synthesized</span>
                </div>
                <p className="text-sm leading-6 text-foreground">
                  {currentMeeting.summary?.overview || (
                    <span className="italic text-muted-foreground">
                      No overview generated. Use the Summary Language bar above to synthesize one with AI.
                    </span>
                  )}
                </p>
              </section>

              {/* ── Key Decisions ── */}
              {currentMeeting.summary && currentMeeting.summary.decisions.length > 0 && (
                <section className="space-y-3" aria-labelledby="section-decisions">
                  <div className="flex items-center gap-2">
                    <h3 id="section-decisions" className="text-base font-semibold text-foreground">
                      Key Decisions
                    </h3>
                    <Badge variant="secondary" className="tabular-nums">{currentMeeting.summary.decisions.length}</Badge>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-muted-foreground" aria-label="Meeting decisions">
                    {currentMeeting.summary.decisions.map((dec, i) => (
                      <li key={i} className="pl-1">{dec}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Action Items ── */}
              {currentMeeting.summary && currentMeeting.summary.actionItems.length > 0 && (
                <section className="space-y-3" aria-labelledby="section-actions">
                  <div className="flex items-center gap-2">
                    <h3 id="section-actions" className="text-base font-semibold text-foreground">
                      Action Items
                    </h3>
                    <Badge variant="secondary" className="tabular-nums">{currentMeeting.summary.actionItems.length}</Badge>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-muted-foreground" aria-label="Action items">
                    {currentMeeting.summary.actionItems.map((item, idx) => (
                      <li key={idx} className="pl-1">
                        <span className={cn('font-medium text-foreground', item.done && 'text-muted-foreground line-through')}>{item.task}</span>
                        {item.owner && (
                          <Badge variant="secondary" className="ml-2 align-text-bottom" aria-label={`Assigned to ${item.owner}`}>
                            @{item.owner}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Discussion Topics ── */}
              {currentMeeting.summary && currentMeeting.summary.topics.length > 0 && (
                <section className="space-y-3" aria-labelledby="section-topics">
                  <div className="flex min-h-7 flex-wrap items-center gap-2">
                    <h3 id="section-topics" className="text-base font-semibold text-foreground">
                      Topics Discussed
                    </h3>
                    <Badge variant="secondary" className="tabular-nums">{currentMeeting.summary.topics.length}</Badge>
                    {topicsActions}
                  </div>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Discussion topics">
                    {currentMeeting.summary.topics.map((t, i) => (
                      <li key={i} className="max-w-full">
                        <Badge variant="outline" className="h-auto max-w-full whitespace-normal break-words px-2 py-1 text-left font-normal leading-snug">
                          {t}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ── Participant Notes ── */}
              {currentMeeting.manualNotes.trim() && (
                <section className="space-y-3" aria-labelledby="section-notes">
                  <h3 id="section-notes" className="text-base font-semibold text-foreground">
                    Participant Notes
                  </h3>
                  <div className="whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                    {currentMeeting.manualNotes}
                  </div>
                </section>
              )}

              {/* Empty state when no summary has been generated yet */}
              {!currentMeeting.summary && (
                <EmptyState
                  icon={TrendingUp}
                  title="No AI summary generated yet"
                  description="Use the language buttons above (requires Ollama) to synthesize an executive summary from the transcript and participant notes."
                  className="py-10"
                />
              )}
            </TabsContent>

            {/* ── Tab: Verbal Transcript (rename speakers, translate, polish, jump target from Timeline) ── */}
            <TabsContent value="transcript" className="mt-6">
              <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground" aria-label={`${segmentCount} transcript segments`}>
                    Transcript ({segmentCount} segments)
                  </span>
                  {currentMeeting.translationLanguage && (
                    <Badge variant="secondary">Translated: {getLanguageName(currentMeeting.translationLanguage)}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto" role="group" aria-label="Transcript actions">
                  <div className="flex items-center gap-1.5">
                    <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
                    <NativeSelect
                      disabled={isTranslating || !isConnected}
                      onChange={(e) => {
                        const target = e.target.value;
                        if (target) handleTranslateTranscript(target);
                      }}
                      defaultValue=""
                      aria-label="Translate transcript to another language"
                      title={!isConnected ? 'Ollama must be running to translate' : 'Translate transcript to another language'}
                      containerClassName="w-auto"
                      className="h-7 w-48"
                    >
                      <option value="" disabled>
                        {isTranslating ? 'Translating...' : 'Translate Transcript...'}
                      </option>
                      {TRANSLATION_TARGETS.filter((t) => t.code !== 'none').map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {/* Dual/Translated/Original view toggle (only when a translation exists) */}
                  {hasTranslation && (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={transcriptViewMode}
                      onValueChange={(mode) => mode && setTranscriptViewMode(mode as typeof transcriptViewMode)}
                      aria-label="Transcript view mode"
                    >
                      {(['dual', 'translated', 'original'] as const).map((mode) => (
                        <ToggleGroupItem key={mode} value={mode}>
                          {mode === 'dual' ? 'Dual' : mode === 'translated' ? 'Translation' : 'Original'}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}

                  {/* AI Polish: grammar correction + speaker diarization */}
                  {currentMeeting.transcript.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePolishTranscript}
                      disabled={isPolishingAI || !isConnected}
                      title={
                        !isConnected
                          ? 'Ollama must be running to use AI polish'
                          : 'Use local AI to correct grammar and identify speaker turns (diarization)'
                      }
                    >
                      <Wand2 className={cn('text-muted-foreground', isPolishingAI && 'animate-spin')} aria-hidden="true" />
                      <span>{isPolishingAI ? 'Diarizing...' : 'AI Polish & Diarize'}</span>
                    </Button>
                  )}
                </div>
              </div>

              {currentMeeting.transcript.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">No verbal transcript was recorded for this session.</p>
                  <Button size="sm" variant="outline" onClick={() => setIsPasteOpen(true)}>
                    <ClipboardPaste aria-hidden="true" />
                    <span>Paste transcript</span>
                  </Button>
                </div>
              ) : (
                <ol className="mt-2 space-y-px" aria-label="Transcript segments">
                  {currentMeeting.transcript.map((seg, idx) => {
                    const isTarget =
                      highlightTimestamp !== null &&
                      Math.abs(seg.timestampSeconds - highlightTimestamp) < 3;
                    const showDual = transcriptViewMode === 'dual' && seg.translation;
                    const showTranslatedOnly = transcriptViewMode === 'translated' && seg.translation;
                    const time = formatSecondsToTime(seg.timestampSeconds);

                    return (
                      <li
                        key={seg.id || `sum-seg-${idx}`}
                        aria-label={`${seg.speaker} at ${time}`}
                        className={cn(
                          'grid grid-cols-[auto_1fr] gap-x-3 rounded-md px-2 py-2',
                          isTarget && 'bg-accent ring-1 ring-border'
                        )}
                      >
                        <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground" aria-label={`Timestamp: ${time}`}>
                          {time}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {/* Speaker name: click to rename every segment for this speaker */}
                            <button
                              type="button"
                              onClick={() => handleRenameSpeaker(seg.speaker)}
                              className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title={`Click to rename all segments for "${seg.speaker}"`}
                              aria-label={`Speaker: ${seg.speaker}. Click to rename.`}
                            >
                              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', speakerDotClass(speakerColors, seg.speaker))} />
                              <span>{seg.speaker}</span>
                            </button>
                            {seg.sourceLanguage && (
                              <Badge variant="outline" className="px-1 py-0 font-mono font-normal text-muted-foreground" aria-label={`Source language: ${seg.sourceLanguage}`}>
                                {seg.sourceLanguage}
                              </Badge>
                            )}
                          </div>

                          {showDual ? (
                            <div className="space-y-1.5">
                              <p className="border-l-2 pl-3 text-sm italic leading-6 text-muted-foreground">
                                <span className="mr-1.5 text-xs not-italic">Original:</span>
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
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </TabsContent>

            {/* ── Tab: Milestone Timeline (each item jumps to the transcript) ── */}
            <TabsContent value="timeline" className="mt-6">
              {currentMeeting.timeline.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No timeline milestones recorded for this session.
                </p>
              ) : (
                <ol aria-label="Meeting timeline milestones" className="relative space-y-px">
                  <span aria-hidden="true" className="absolute bottom-5 left-[calc(5rem-0.5px)] top-5 w-px bg-border" />
                  {currentMeeting.timeline.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => jumpToTimestamp(item.timestampSeconds)}
                        className="group relative flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Jump to ${item.timeFormatted} — ${item.label}`}
                        title="Click to jump to this moment in the transcript"
                      >
                        <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {item.timeFormatted}
                        </span>
                        <span aria-hidden="true" className="relative mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground ring-4 ring-background group-hover:ring-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.type} · click to jump to transcript</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            {/* ── Tab: Screenshots (click to open the preview) ── */}
            {screenshotCount > 0 && (
              <TabsContent value="screenshots" className="mt-6">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {currentMeeting.screenshots.map((ss, idx) => (
                    <li key={ss.id}>
                      <button
                        type="button"
                        onClick={() => setLightboxScreenshot(ss.dataUrl)}
                        aria-label={`${ss.caption || `Screenshot ${idx + 1}`} at ${formatSecondsToTime(ss.timestampSeconds)}`}
                        className="block h-full w-full overflow-hidden rounded-md border bg-card text-left transition-colors duration-100 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <img
                          src={ss.dataUrl}
                          alt={ss.caption || `Screenshot ${idx + 1}`}
                          className="h-40 w-full border-b bg-muted object-cover"
                          loading="lazy"
                        />
                        <div className="space-y-0.5 px-2.5 py-2">
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="font-mono tabular-nums">{formatSecondsToTime(ss.timestampSeconds)}</span>
                            <span aria-hidden="true">·</span>
                            {ss.type === 'portion' ? (
                              <>
                                <Crop className="size-3" aria-hidden="true" />
                                <span>Portion</span>
                              </>
                            ) : (
                              <>
                                <Camera className="size-3" aria-hidden="true" />
                                <span>Full</span>
                              </>
                            )}
                          </p>
                          {ss.caption && <p className="line-clamp-1 text-xs font-medium text-foreground">{ss.caption}</p>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* ── Screenshot preview ── */}
      <ScreenshotLightbox
        src={lightboxScreenshot}
        title="Screenshot preview"
        alt="Screenshot full preview"
        onClose={() => setLightboxScreenshot(null)}
      />
    </div>
  );
};
