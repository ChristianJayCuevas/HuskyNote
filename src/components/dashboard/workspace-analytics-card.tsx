import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { useAI } from '../../context/ai-context';
import { Button } from '../ui/button';
import {
  Activity,
  Mic,
  FileText,
  FileUp,
  ShieldCheck,
  Cpu,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';

export const WorkspaceAnalyticsCard: React.FC = () => {
  const { setActiveView, setActiveNoteId } = useWorkspace();
  const { isConnected, selectedModel } = useAI();
  const [hoveredDayIndex1, setHoveredDayIndex1] = useState<number | null>(null);
  const [hoveredDayIndex2, setHoveredDayIndex2] = useState<number | null>(null);

  // Live queries for all entities across workspace
  const allNotes = useLiveQuery(() => db.notes.toArray(), []) || [];
  const allMeetings = useLiveQuery(() => db.meetings.toArray(), []) || [];
  const allDocuments = useLiveQuery(() => db.documents.toArray(), []) || [];
  const allManuals = useLiveQuery(() => db.manuals.toArray(), []) || [];
  const allSchedule = useLiveQuery(() => db.schedule.toArray(), []) || [];

  // Aggregated totals
  const totalMeetings = allMeetings.length;
  const totalNotes = allNotes.length;
  const totalDocuments = allDocuments.length;
  const totalManuals = allManuals.length;
  const totalScheduleEvents = allSchedule.length;

  const totalTranscriptSegments = useMemo(() => {
    return allMeetings.reduce((sum, m) => sum + (m.transcript?.length || 0), 0);
  }, [allMeetings]);

  const totalPages = useMemo(() => {
    return allDocuments.reduce((sum, d) => sum + (d.pageCount || 1), 0);
  }, [allDocuments]);

  // Compute 7-day breakdown for both straight graph boards
  const daysData = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const dayName = i === 0 ? 'Today' : start.toLocaleDateString(undefined, { weekday: 'short' });
      const fullDate = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      const dayMeetings = allMeetings.filter((m) => {
        const t = m.startTime || m.createdAt || 0;
        return t >= start.getTime() && t < end.getTime();
      });

      const dayNotes = allNotes.filter((n) => {
        const t = n.createdAt || n.updatedAt || 0;
        return t >= start.getTime() && t < end.getTime();
      });

      const dayDocs = allDocuments.filter((doc) => {
        const t = doc.createdAt || 0;
        return t >= start.getTime() && t < end.getTime();
      });

      const dayManuals = allManuals.filter((man) => {
        const t = man.createdAt || man.updatedAt || 0;
        return t >= start.getTime() && t < end.getTime();
      });

      const daySpeechSegments = dayMeetings.reduce(
        (sum, m) => sum + (m.transcript?.length || 0),
        0
      );

      list.push({
        dayName,
        fullDate,
        meetings: dayMeetings.length,
        speechSegments: daySpeechSegments,
        notes: dayNotes.length,
        documents: dayDocs.length,
        manuals: dayManuals.length,
        knowledgeTotal: dayNotes.length + dayDocs.length + dayManuals.length,
        audioTotal: dayMeetings.length,
      });
    }
    return list;
  }, [allMeetings, allNotes, allDocuments, allManuals]);

  // Straight Scale Calculation for Board 1 (Meetings & Audio)
  const maxBoard1 = useMemo(() => {
    const peak = Math.max(...daysData.map((d) => d.meetings), 3);
    return peak;
  }, [daysData]);

  // Straight Scale Calculation for Board 2 (Knowledge & SOPs)
  const maxBoard2 = useMemo(() => {
    const peak = Math.max(...daysData.map((d) => d.knowledgeTotal), 4);
    return peak;
  }, [daysData]);

  const activeDay1 =
    hoveredDayIndex1 !== null ? daysData[hoveredDayIndex1] : daysData[daysData.length - 1];

  const activeDay2 =
    hoveredDayIndex2 !== null ? daysData[hoveredDayIndex2] : daysData[daysData.length - 1];

  const handleCreateNewNote = async () => {
    const id = `note-${Date.now()}`;
    await db.notes.put({
      id,
      title: 'Untitled Note',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [],
    });
    setActiveNoteId(id);
    setActiveView('notes');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {/* Bento Board 1: Meetings & Voice Notes */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-none transition-all flex flex-col justify-between">
        <div>
          {/* Board Header */}
          <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-850 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white">
                <Mic className="w-5 h-5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                    Meetings & Voice Notes
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 dark:bg-zinc-850 dark:text-white font-bold border border-slate-300 dark:border-zinc-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white animate-pulse" />
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                  Summary of your meetings, voice notes, and spoken conversations.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveView('meetings')}
              className="text-xs font-mono shrink-0 hidden sm:flex items-center gap-1"
            >
              <span>New Meeting</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Quick Metrics Cluster */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono uppercase text-slate-600 dark:text-zinc-400 font-semibold block">
                Total Meetings
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {totalMeetings}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">recorded</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono uppercase text-slate-600 dark:text-zinc-400 font-semibold block">
                Spoken Lines
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {totalTranscriptSegments}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">lines transcribed</span>
              </div>
            </div>
          </div>

          {/* Straight Graph Board */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-canvas-inset/50 border border-slate-200 dark:border-zinc-800 mb-4">
            <div className="flex items-center justify-between text-xs font-mono mb-3">
              <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-slate-900 dark:text-white" />
                7-Day Meeting Activity
              </span>
              <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-semibold">
                {activeDay1.dayName}: <strong className="text-slate-950 dark:text-white">{activeDay1.meetings} meeting(s)</strong> ({activeDay1.speechSegments} spoken lines)
              </span>
            </div>

            {/* Straight Bar Chart Columns */}
            <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2 pb-1 border-b border-slate-200 dark:border-zinc-800">
              {daysData.map((d, i) => {
                const heightPct = Math.max(Math.round((d.meetings / maxBoard1) * 100), 6);
                const isHovered = hoveredDayIndex1 === i;

                return (
                  <div
                    key={`bar1-${i}`}
                    onMouseEnter={() => setHoveredDayIndex1(i)}
                    onMouseLeave={() => setHoveredDayIndex1(null)}
                    className="flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                  >
                    <div className="w-full flex justify-center items-end h-full">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                          isHovered
                            ? 'bg-slate-700 dark:bg-zinc-200 shadow-md scale-y-105 origin-bottom'
                            : d.meetings > 0
                            ? 'bg-slate-900 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.25)]'
                            : 'bg-slate-200 dark:bg-zinc-800'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 mt-2">
              {daysData.map((d, i) => (
                <span
                  key={`day1-lbl-${i}`}
                  className={hoveredDayIndex1 === i ? 'text-slate-950 dark:text-white font-black' : ''}
                >
                  {d.dayName}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Board Footer */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-zinc-400 pt-2">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
            100% Private on Your Device
          </span>
          <span className="font-semibold text-slate-900 dark:text-zinc-200">
            {totalScheduleEvents} Events Scheduled
          </span>
        </div>
      </div>

      {/* Bento Board 2: Notes & Documents Activity */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-none transition-all flex flex-col justify-between">
        <div>
          {/* Board Header */}
          <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-850 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white">
                <FileText className="w-5 h-5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                    Notes & Documents
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 dark:bg-zinc-850 dark:text-white font-bold border border-slate-300 dark:border-zinc-800">
                    AUTO-SAVED
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                  Your written notes, step-by-step guides, and uploaded files.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateNewNote}
              className="text-xs font-mono shrink-0 hidden sm:flex items-center gap-1"
            >
              <span>New Note</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Quick Metrics Cluster */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono uppercase text-slate-600 dark:text-zinc-400 font-semibold block">
                Notes & Guides
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {totalNotes + totalManuals}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  ({totalNotes} notes, {totalManuals} guides)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono uppercase text-slate-600 dark:text-zinc-400 font-semibold block">
                Files & Documents
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-950 dark:text-white">
                  {totalDocuments}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  files ({totalPages} pages)
                </span>
              </div>
            </div>
          </div>

          {/* Straight Graph Board */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-canvas-inset/50 border border-slate-200 dark:border-zinc-800 mb-4">
            <div className="flex items-center justify-between text-xs font-mono mb-3">
              <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-slate-900 dark:text-white" />
                7-Day Activity
              </span>
              <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-semibold">
                {activeDay2.dayName}: <strong className="text-slate-950 dark:text-white">{activeDay2.knowledgeTotal} item(s)</strong> ({activeDay2.notes} notes, {activeDay2.documents + activeDay2.manuals} files)
              </span>
            </div>

            {/* Straight Bar Chart Columns */}
            <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2 pb-1 border-b border-slate-200 dark:border-zinc-800">
              {daysData.map((d, i) => {
                const heightPct = Math.max(Math.round((d.knowledgeTotal / maxBoard2) * 100), 6);
                const isHovered = hoveredDayIndex2 === i;

                return (
                  <div
                    key={`bar2-${i}`}
                    onMouseEnter={() => setHoveredDayIndex2(i)}
                    onMouseLeave={() => setHoveredDayIndex2(null)}
                    className="flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                  >
                    <div className="w-full flex justify-center items-end h-full">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all duration-200 ${
                          isHovered
                            ? 'bg-slate-700 dark:bg-zinc-200 shadow-md scale-y-105 origin-bottom'
                            : d.knowledgeTotal > 0
                            ? 'bg-slate-900 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.25)]'
                            : 'bg-slate-200 dark:bg-zinc-800'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 mt-2">
              {daysData.map((d, i) => (
                <span
                  key={`day2-lbl-${i}`}
                  className={hoveredDayIndex2 === i ? 'text-slate-950 dark:text-white font-black' : ''}
                >
                  {d.dayName}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Board Footer */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-zinc-400 pt-2">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
            <span>AI Assistant: {isConnected ? selectedModel || 'Local Model' : 'Offline'}</span>
          </span>
          <span className="font-semibold text-slate-900 dark:text-zinc-200">
            Stored Privately on Your Mac
          </span>
        </div>
      </div>
    </div>
  );
};
