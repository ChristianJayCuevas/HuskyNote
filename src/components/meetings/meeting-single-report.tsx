import React, { useState } from 'react';
import type { Meeting } from '../../types';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import { exportMeetingToPdf } from '../../services/export/pdf';
import { exportMeetingToMarkdown } from '../../services/export/markdown';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';
import {
  Download,
  Copy,
  Check,
  Printer,
  FileText,
  Clock,
  CheckSquare,
  Bookmark,
  Camera,
  Crop,
  Sparkles,
  Share2,
  X,
  Search,
} from 'lucide-react';

interface MeetingSingleReportProps {
  meeting: Meeting;
  onBack?: () => void;
}

/**
 * MeetingSingleReport compiles all textual and visual meeting artifacts into
 * a single, publication-ready, executive-grade comprehensive report.
 *
 * Styled in strict monochrome white/gray glassmorphism (no other colors).
 */
export const MeetingSingleReport: React.FC<MeetingSingleReportProps> = ({ meeting, onBack }) => {
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();
  const [copiedReport, setCopiedReport] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const handleExportPdf = () => {
    try {
      exportMeetingToPdf(meeting);
      addToast('Generated single report PDF with embedded screenshots and notes.', 'success');
    } catch (err) {
      console.error('[HuskyNote] PDF export failed:', err);
      addToast('Failed to generate PDF report.', 'error');
    }
  };

  const handleExportMarkdown = () => {
    const md = exportMeetingToMarkdown(meeting);
    const filename = `${(meeting.title || 'meeting').toLowerCase().replace(/\s+/g, '_')}_report.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Downloaded Markdown report.', 'success');
  };

  const handleCopyReport = () => {
    const md = exportMeetingToMarkdown(meeting);
    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
    addToast('Report copied to clipboard.', 'info');
  };

  const handleSaveToNotes = async () => {
    try {
      const md = exportMeetingToMarkdown(meeting);
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `Report: ${meeting.title}`,
        content: md,
        tags: ['meeting-report', 'compiled'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast('Single report saved to workspace notes.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
    } catch {
      addToast('Failed to convert report to note.', 'error');
    }
  };

  const filteredTranscript = meeting.transcript.filter((s) =>
    transcriptSearch ? s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()) : true
  );

  const fullScreenshotsCount = meeting.screenshots?.filter((s) => s.type !== 'portion').length || 0;
  const portionSnipsCount = meeting.screenshots?.filter((s) => s.type === 'portion').length || 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-canvas text-slate-950 dark:text-white p-6 md:p-10 font-sans select-text">
      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white"
              title="Close image"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImg}
              alt="Screenshot Preview"
              className="max-h-[85vh] max-w-full rounded-xl border border-white/20 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Document Header & Quick Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/10 dark:border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <img
              src="/official_huskynote.png"
              alt="HuskyNote Logo"
              className="w-12 h-12 rounded-xl shadow-lg border border-slate-900/20 dark:border-white/20 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">
                  Compiled Single Report
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/10 border border-slate-900/15 dark:border-white/15 text-slate-700 dark:text-zinc-300">
                  Ready
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white mt-0.5">
                {meeting.title}
              </h1>
            </div>
          </div>

          {/* Action Buttons in Monochrome Glassmorphism */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportPdf}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-zinc-200 active:bg-slate-700 dark:active:bg-zinc-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              title="Download publication-quality PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              className="px-3 py-2 rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/15 dark:border-white/15 text-slate-950 dark:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Download Markdown file"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Markdown</span>
            </button>

            <button
              onClick={handleCopyReport}
              className="px-3 py-2 rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/15 dark:border-white/15 text-slate-950 dark:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Copy entire report to clipboard"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-slate-950 dark:text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReport ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleSaveToNotes}
              className="px-3 py-2 rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/15 dark:border-white/15 text-slate-950 dark:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Save into Notes workspace"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Note</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 border border-slate-900/15 dark:border-white/15 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-all"
              title="Print report"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata Strip in Monochrome Frosted Glass */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 dark:text-zinc-400">Date</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5">
              {new Date(meeting.startTime).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 dark:text-zinc-400">Duration</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5 font-mono">
              {formatSecondsToTime(meeting.durationSeconds)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 dark:text-zinc-400">Verbal Transcript</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5">
              {meeting.transcript.length} segment(s)
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-600 dark:text-zinc-400">Visual Artifacts</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5">
              {meeting.screenshots?.length || 0} total ({fullScreenshotsCount} full, {portionSnipsCount} snips)
            </span>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-950 dark:text-white">
            <Sparkles className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <h2>Executive Summary</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
            {meeting.summary?.overview ||
              'No summary available. Transcription segments recorded without offline AI synthesis.'}
          </p>
        </section>

        {/* 2. Key Decisions & Action Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Key Decisions */}
          <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
              <CheckSquare className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
              <h2>Key Decisions ({meeting.summary?.decisions.length || 0})</h2>
            </div>
            {meeting.summary && meeting.summary.decisions.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-800 dark:text-zinc-200">
                {meeting.summary.decisions.map((decision, idx) => (
                  <li key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{decision}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-500 italic">No formal decisions logged in this session.</p>
            )}
          </section>

          {/* Action Items */}
          <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
              <CheckSquare className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
              <h2>Action Items ({meeting.summary?.actionItems.length || 0})</h2>
            </div>
            {meeting.summary && meeting.summary.actionItems.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-800 dark:text-zinc-200">
                {meeting.summary.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={false}
                        className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-canvas text-slate-950 dark:text-white focus:ring-0"
                      />
                      <span className="leading-relaxed">{item.task}</span>
                    </div>
                    {item.owner && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/10 dark:bg-white/10 border border-slate-900/15 dark:border-white/15 text-[10px] font-mono text-slate-700 dark:text-zinc-300 shrink-0">
                        @{item.owner}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-500 italic">No action items detected.</p>
            )}
          </section>
        </div>

        {/* 3. Topics & Follow-up Tasks */}
        {(meeting.summary?.topics.length || 0) > 0 && (
          <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">Topics Discussed</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {meeting.summary?.topics.map((t, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-xl bg-slate-900/10 dark:bg-white/10 border border-slate-900/15 dark:border-white/15 text-xs font-medium text-slate-800 dark:text-zinc-200"
                >
                  #{t}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 4. Participant Meeting Notes */}
        {meeting.manualNotes?.trim() && (
          <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
              <FileText className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
              <h2>Participant Notes</h2>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-900/5 dark:border-white/5 text-xs leading-relaxed text-slate-800 dark:text-zinc-200 whitespace-pre-wrap font-sans">
              {meeting.manualNotes}
            </div>
          </section>
        )}

        {/* 5. Visual Artifacts & Screenshots (Full Screen + Portion Snips) */}
        {meeting.screenshots && meeting.screenshots.length > 0 && (
          <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
                <Camera className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                <h2>Visual Artifacts ({meeting.screenshots.length})</h2>
              </div>
              <span className="text-[11px] text-slate-600 dark:text-zinc-400">Click any image to enlarge</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {meeting.screenshots.map((ss, idx) => {
                const isPortion = ss.type === 'portion';
                return (
                  <div
                    key={ss.id}
                    onClick={() => setLightboxImg(ss.dataUrl)}
                    className="group cursor-pointer rounded-xl border border-slate-900/15 dark:border-white/15 bg-black/60 overflow-hidden hover:border-slate-900/40 dark:hover:border-white/40 transition-all hover:shadow-xl"
                  >
                    <div className="relative aspect-video w-full bg-slate-50 dark:bg-canvas overflow-hidden flex items-center justify-center">
                      <img
                        src={ss.dataUrl}
                        alt={ss.caption || `Artifact ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white">
                          {formatSecondsToTime(ss.timestampSeconds)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-900/10 dark:bg-white/10 backdrop-blur-md border border-slate-900/15 dark:border-white/15 text-[9px] font-mono text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                          {isPortion ? <Crop className="w-2.5 h-2.5" /> : <Camera className="w-2.5 h-2.5" />}
                          <span>{isPortion ? 'Portion' : 'Full'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5">
                      <p className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate">
                        {ss.caption || (isPortion ? `Portion Snip at ${formatSecondsToTime(ss.timestampSeconds)}` : `Full Snapshot at ${formatSecondsToTime(ss.timestampSeconds)}`)}
                      </p>
                      {ss.cropDimensions && (
                        <span className="text-[10px] font-mono text-slate-600 dark:text-zinc-400">
                          {ss.cropDimensions.width} × {ss.cropDimensions.height} px
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Complete Chronological Verbal Transcript */}
        <section className="p-6 rounded-2xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
              <Clock className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
              <h2>Verbal Transcript ({meeting.transcript.length} segments)</h2>
            </div>

            {/* Transcript Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600 dark:text-zinc-400" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search transcript..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/10 dark:bg-white/10 border border-slate-900/15 dark:border-white/15 text-xs text-slate-950 dark:text-white placeholder-slate-500 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-900/40 dark:focus:border-white/40 w-48"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2.5 pr-2">
            {filteredTranscript.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-zinc-500 italic py-4 text-center">
                {transcriptSearch ? 'No segments match your search query.' : 'No verbal transcript recorded.'}
              </p>
            ) : (
              filteredTranscript.map((seg) => (
                <div
                  key={seg.id}
                  className="p-3 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-slate-900/5 dark:border-white/5 hover:border-slate-900/15 dark:hover:border-white/15 transition-colors leading-relaxed"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-zinc-400 mb-1">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase">{seg.speaker}</span>
                    <span>{formatSecondsToTime(seg.timestampSeconds)}</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-zinc-200">{seg.text}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-900/10 dark:border-white/10 pt-6 pb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-500">
          <span>Generated by HuskyNote Local-First AI Secretary</span>
          <span className="font-mono">ID: {meeting.id}</span>
        </div>
      </div>
    </div>
  );
};
