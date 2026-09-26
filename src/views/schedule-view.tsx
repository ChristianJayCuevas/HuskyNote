import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWorkspace } from '../context/workspace-context';
import { useSound } from '../context/sound-context';
import { useAI } from '../context/ai-context';
import { ai } from '../services/ai/active-provider';
import { Button } from '../components/ui/button';
import { TiltCard } from '../components/ui/tilt-card';
import type { ScheduleEvent, ScheduleCategory, GoogleCalendarConfig } from '../types';
import { downloadIcsFile, downloadMultipleEventsIcs } from '../services/calendar/ics-generator';
import {
  getGoogleCalendarConfig,
  saveGoogleCalendarConfig,
  disconnectGoogleCalendar,
  authenticateGoogleCalendar,
  createGoogleCalendarEvent,
  fetchUpcomingGoogleCalendarEvents,
  getGoogleCalendarWebTemplateUrl,
} from '../services/calendar/google-calendar';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Sparkles,
  Laptop,
  Globe,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  ExternalLink,
  CalendarCheck,
  Tag,
  Download,
  Flame,
  ShieldCheck,
} from 'lucide-react';

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const ScheduleView: React.FC = () => {
  const { addToast } = useWorkspace();
  const { playThock, playChime, playPop } = useSound();
  const { isConnected: isAIOfflineOrOnline, selectedModel } = useAI();

  // Reactive IndexedDB events
  const dbEvents = useLiveQuery(() => db.schedule.toArray(), []) || [];

  const todayStr = useMemo(() => formatIso(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Google Calendar integration state
  const [gcalConfig, setGcalConfig] = useState<GoogleCalendarConfig>(() => getGoogleCalendarConfig());
  const [customClientId, setCustomClientId] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);

  // Form states
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('10:00');
  const [newEventDuration, setNewEventDuration] = useState(30);
  const [newEventCategory, setNewEventCategory] = useState<ScheduleCategory>('meeting');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'selected-day' | 'all'>('selected-day');

  // Clean up any previously seeded sample events so the calendar starts completely clean
  useEffect(() => {
    async function cleanSeedEvents() {
      try {
        const seeded = await db.schedule.filter((ev) => ev.id.startsWith('ev-seed-')).toArray();
        if (seeded.length > 0) {
          await db.schedule.bulkDelete(seeded.map((s) => s.id));
        }
      } catch (err) {
        console.warn('[HuskyNote] Failed to remove sample schedule events:', err);
      }
    }
    cleanSeedEvents();
  }, []);

  // Events plotted on the selected date
  const eventsForSelectedDate = useMemo(() => {
    return dbEvents
      .filter((ev) => ev.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [dbEvents, selectedDate]);

  // All events for the current active filter
  const displayedEvents = useMemo(() => {
    if (activeFilter === 'all') {
      return [...dbEvents].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    }
    return eventsForSelectedDate;
  }, [dbEvents, eventsForSelectedDate, activeFilter]);

  // Count of events mapped by date (for calendar day dots)
  const eventCountsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of dbEvents) {
      map.set(ev.date, (map.get(ev.date) || 0) + 1);
    }
    return map;
  }, [dbEvents]);

  // Calendar matrix calculations
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      eventCount: number;
    }> = [];

    // Preceding month trailing days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const str = formatIso(d);
      days.push({
        dateStr: str,
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isSelected: str === selectedDate,
        eventCount: eventCountsByDate.get(str) || 0,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const str = formatIso(d);
      days.push({
        dateStr: str,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: str === todayStr,
        isSelected: str === selectedDate,
        eventCount: eventCountsByDate.get(str) || 0,
      });
    }

    // Trailing days to fill 42 cells grid (6 rows)
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const str = formatIso(d);
      days.push({
        dateStr: str,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isSelected: str === selectedDate,
        eventCount: eventCountsByDate.get(str) || 0,
      });
    }

    return days;
  }, [calendarMonth, todayStr, selectedDate, eventCountsByDate]);

  const handlePrevMonth = () => {
    playPop();
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    playPop();
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    playPop();
    const now = new Date();
    setCalendarMonth(now);
    setSelectedDate(formatIso(now));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    playPop();
    const item: ScheduleEvent = {
      id: `ev-${Date.now()}`,
      title: newEventTitle.trim(),
      date: selectedDate,
      time: newEventTime,
      durationMin: Number(newEventDuration) || 30,
      category: newEventCategory,
      completed: false,
      notes: newEventNotes.trim() || undefined,
      createdAt: Date.now(),
    };

    await db.schedule.put(item);
    setNewEventTitle('');
    setNewEventNotes('');
    addToast(`Plotted "${item.title}" on ${item.date}.`, 'success');
  };

  const toggleEventComplete = async (ev: ScheduleEvent) => {
    playChime();
    await db.schedule.update(ev.id, { completed: !ev.completed });
  };

  const handleDeleteEvent = async (id: string) => {
    playThock();
    await db.schedule.delete(id);
    addToast('Event removed from schedule.', 'info');
  };

  const handleAddToComputerCalendar = async (ev: ScheduleEvent) => {
    playPop();
    downloadIcsFile(ev);
    await db.schedule.update(ev.id, { addedToComputerCalendar: true });
    addToast(`Generated .ics for "${ev.title}". Opening in Computer Calendar.`, 'success');
  };

  const handleSyncToGoogleCalendar = async (ev: ScheduleEvent) => {
    playPop();
    const res = await createGoogleCalendarEvent(ev);
    if (res.success) {
      playChime();
      await db.schedule.update(ev.id, {
        syncedToGoogle: true,
        googleCalendarEventId: res.eventId,
      });
      addToast(`Synced "${ev.title}" to Google Calendar.`, 'success');
    } else {
      addToast(res.error || 'Failed to sync to Google Calendar.', 'warning');
    }
  };

  const handleExportMonthIcs = () => {
    playPop();
    if (dbEvents.length === 0) {
      addToast('No events to export.', 'info');
      return;
    }
    downloadMultipleEventsIcs(dbEvents, `huskynote-full-schedule-${selectedDate}.ics`);
    addToast(`Exported ${dbEvents.length} events to Computer Calendar (.ics).`, 'success');
  };

  // Google Calendar Connect via OAuth
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    playThock();
    try {
      const res = await authenticateGoogleCalendar(customClientId.trim() || undefined);
      if (res.success) {
        setGcalConfig(getGoogleCalendarConfig());
        playChime();
        addToast(`Connected to Google Calendar (${res.userEmail}).`, 'success');
      } else {
        addToast(res.error || 'Google authentication was cancelled.', 'warning');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    playThock();
    disconnectGoogleCalendar();
    setGcalConfig(getGoogleCalendarConfig());
    addToast('Disconnected Google Calendar.', 'info');
  };

  const handleSyncGoogleEvents = async () => {
    setIsSyncingGoogle(true);
    playThock();
    try {
      const res = await fetchUpcomingGoogleCalendarEvents();
      if (res.success && res.events) {
        let addedCount = 0;
        for (const gEv of res.events) {
          const exists = dbEvents.some(
            (e) => e.googleCalendarEventId === gEv.googleCalendarEventId
          );
          if (!exists) {
            await db.schedule.put(gEv);
            addedCount++;
          }
        }
        setGcalConfig(getGoogleCalendarConfig());
        playChime();
        addToast(`Pulled ${addedCount} upcoming event(s) from Google Calendar.`, 'success');
      } else {
        addToast(res.error || 'Failed to pull Google Calendar events.', 'warning');
      }
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // AI Schedule Generator for Selected Date
  const handleGenerateAISchedule = async () => {
    if (!isAIOfflineOrOnline || !selectedModel) {
      addToast('Local AI (Ollama) is offline. Start Ollama to use AI scheduling.', 'warning');
      return;
    }

    setIsGeneratingSchedule(true);
    playThock();

    try {
      const [recentNotes, recentMeetings] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().limit(4).toArray(),
        db.meetings.orderBy('startTime').reverse().limit(3).toArray(),
      ]);

      const context = [
        ...recentNotes.map((n) => `Note: ${n.title}`),
        ...recentMeetings.map((m) => `Meeting: ${m.title} - ${m.summary?.overview || ''}`),
      ].join('\n');

      const prompt = `You are an executive scheduling assistant.
Based on the user's active work and meetings:
${context || 'Software engineering, document analysis, and system architecture'}

Generate an optimized 4-item chronological daily schedule for date ${selectedDate}.
Respond STRICTLY with a valid JSON array of objects formatted as:
[{"title": "Task Name", "time": "09:00", "durationMin": 45, "category": "deep-work", "notes": "Brief focus note"}]
Valid categories are: "meeting", "deep-work", "review", "manual", "deadline". Return only the JSON array.`;

      const response = await ai.generate(prompt, { model: selectedModel });
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          const newEv: ScheduleEvent = {
            id: `ai-ev-${Date.now()}-${i}`,
            title: item.title || 'Focus Session',
            date: selectedDate,
            time: item.time || '10:00',
            durationMin: Number(item.durationMin) || 45,
            category: ['meeting', 'deep-work', 'review', 'manual', 'deadline'].includes(item.category)
              ? item.category
              : 'deep-work',
            completed: false,
            notes: item.notes || 'Synthesized by Local AI from notes and meetings.',
            detectedFrom: {
              source: 'ai',
              sourceTitle: 'Local AI Schedule Optimizer',
            },
            createdAt: Date.now(),
          };
          await db.schedule.put(newEv);
        }
        playChime();
        addToast(`AI generated and plotted ${parsed.length} slots for ${selectedDate}.`, 'success');
      } else {
        throw new Error('Could not parse AI response JSON.');
      }
    } catch (err: any) {
      console.warn('[HuskyNote] AI scheduling error:', err);
      addToast('Failed to parse AI schedule. Reverting to manual entry.', 'error');
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const monthLabel = calendarMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full select-none font-sans transition-colors duration-500">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 bg-slate-50/95 dark:bg-black/95 backdrop-blur-md pb-5 pt-1 -mt-2 mb-8 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-500">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
                Calendar & Automated Schedule
              </h1>
              <p className="text-xs text-slate-700 dark:text-zinc-300 mt-0.5 font-medium">
                Live speech date plotting, Computer Calendar (.ics) sync, and Google Calendar integration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMonthIcs}
            className="text-xs font-mono"
            title="Export all plotted events to Computer Calendar (.ics)"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>Export to Computer (.ics)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerateAISchedule}
            disabled={isGeneratingSchedule}
            className="text-xs font-mono"
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1 ${isGeneratingSchedule ? 'animate-spin' : ''}`} />
            <span>{isGeneratingSchedule ? 'Optimizing...' : 'AI Plot Schedule'}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left 7 Cols: Calendar Grid & Agenda List */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interactive Month Calendar Card */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-xl transition-all">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  {monthLabel}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleJumpToToday}
                  className="text-xs px-2.5 py-1 font-mono font-bold"
                >
                  Today
                </Button>
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-white/10 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-2">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Calendar Date Cells */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((cell, idx) => {
                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => {
                      playPop();
                      setSelectedDate(cell.dateStr);
                    }}
                    className={`relative min-h-[3rem] sm:min-h-[3.6rem] p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all ${
                      cell.isSelected
                        ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500'
                        : cell.isToday
                        ? 'border-slate-400 dark:border-white/30 bg-slate-100 dark:bg-white/5 font-extrabold'
                        : cell.isCurrentMonth
                        ? 'border-slate-200 dark:border-zinc-850 hover:border-slate-400 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/40'
                        : 'border-transparent text-slate-400 dark:text-zinc-600 opacity-40 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-mono ${
                          cell.isSelected
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : cell.isToday
                            ? 'font-bold text-slate-950 dark:text-white'
                            : cell.isCurrentMonth
                            ? 'text-slate-800 dark:text-zinc-300'
                            : 'text-slate-400 dark:text-zinc-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {cell.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Today" />
                      )}
                    </div>

                    {/* Event Pill Indicator */}
                    {cell.eventCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                          {cell.eventCount} {cell.eventCount === 1 ? 'event' : 'events'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda / Plotted Events List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight">
                  {selectedDateLabel}
                </h3>
                <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 font-medium">
                  {eventsForSelectedDate.length} plotted event(s) •{' '}
                  {eventsForSelectedDate.filter((e) => e.completed).length} completed
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-white/10 p-0.5 rounded-lg text-xs font-mono">
                <button
                  onClick={() => setActiveFilter('selected-day')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeFilter === 'selected-day'
                      ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  This Day
                </button>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                  }`}
                >
                  All Plotted ({dbEvents.length})
                </button>
              </div>
            </div>

            {displayedEvents.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-white/15 text-center bg-white/60 dark:bg-zinc-950/60">
                <CalendarIcon className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                  No events plotted for {selectedDate}.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
                  Mention dates and times during meetings, or use the form on the right to plot an event.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedEvents.map((ev) => {
                  const categoryBadge = 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-white/10 dark:text-white dark:border-white/20';

                  return (
                    <div
                      key={ev.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        ev.completed
                          ? 'bg-slate-100/60 dark:bg-zinc-950/40 border-slate-200 dark:border-zinc-900 opacity-60'
                          : 'bg-white dark:bg-zinc-950 border-slate-300 dark:border-white/10 shadow-xs hover:border-slate-400 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => toggleEventComplete(ev)}
                          className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            ev.completed
                              ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-black'
                              : 'border-slate-300 dark:border-zinc-700 hover:border-slate-500 dark:hover:border-zinc-400'
                          }`}
                          title="Toggle completion"
                        >
                          {ev.completed && <Check className="w-3.5 h-3.5" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                              {ev.date} @ {ev.time}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                              ({ev.durationMin}m)
                            </span>
                            <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border font-bold ${categoryBadge}`}>
                              {ev.category}
                            </span>

                            {ev.detectedFrom && (
                              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white border border-slate-300 dark:border-white/20 flex items-center gap-1 font-bold">
                                <Sparkles className="w-2.5 h-2.5 text-slate-900 dark:text-white" />
                                AI DETECTED
                              </span>
                            )}
                          </div>

                          <h4
                            className={`text-sm font-bold tracking-tight mt-1 truncate ${
                              ev.completed
                                ? 'line-through text-slate-400 dark:text-zinc-600'
                                : 'text-slate-950 dark:text-white'
                            }`}
                          >
                            {ev.title}
                          </h4>

                          {ev.notes && (
                            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                              {ev.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleAddToComputerCalendar(ev)}
                          className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                            ev.addedToComputerCalendar
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50'
                              : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                          title="Add to Computer Calendar (.ics)"
                        >
                          <Laptop className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">.ics</span>
                        </button>

                        <button
                          onClick={() => handleSyncToGoogleCalendar(ev)}
                          className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
                            ev.syncedToGoogle
                              ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50'
                              : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                          title="Sync to Google Calendar"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Google</span>
                        </button>

                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Add Event Form & Google Calendar Sync */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Add Event Form */}
          <form
            onSubmit={handleAddEvent}
            className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-950 space-y-4 shadow-sm dark:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Plot Schedule Event</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                {selectedDate}
              </span>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                Event / Task Title
              </label>
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="e.g. Architecture Sync & Code Review"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                  Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                  Start Time
                </label>
                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={newEventDuration}
                  onChange={(e) => setNewEventDuration(Number(e.target.value))}
                  min={15}
                  step={15}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                  Category
                </label>
                <select
                  value={newEventCategory}
                  onChange={(e) => setNewEventCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white outline-none focus:border-emerald-500"
                >
                  <option value="meeting">Meeting</option>
                  <option value="deep-work">Deep Work</option>
                  <option value="review">Review</option>
                  <option value="manual">Manual / SOP</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block mb-1 font-bold">
                Notes & Agenda
              </label>
              <textarea
                value={newEventNotes}
                onChange={(e) => setNewEventNotes(e.target.value)}
                placeholder="Optional meeting agenda, attendees, or details..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 outline-none focus:border-emerald-500 resize-none font-medium"
              />
            </div>

            <Button variant="primary" size="sm" type="submit" className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Insert into Schedule</span>
            </Button>
          </form>

          {/* Google Calendar Sync & Auth Panel */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-xl space-y-4 transition-all">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight">
                  Google Calendar Sync
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 ${
                  gcalConfig.isConnected
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40'
                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    gcalConfig.isConnected ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {gcalConfig.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {gcalConfig.isConnected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-xs space-y-1">
                  <div className="font-bold text-blue-900 dark:text-blue-200">
                    Account: {gcalConfig.userEmail || 'Active Google Token'}
                  </div>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Direct two-way calendar sync active. Detected events can be pushed directly to Google Calendar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncGoogleEvents}
                    disabled={isSyncingGoogle}
                    className="flex-1 text-xs"
                  >
                    <Globe className="w-3.5 h-3.5 mr-1" />
                    <span>{isSyncingGoogle ? 'Syncing...' : 'Pull Google Events'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGoogle}
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Connect your Google account to sync detected meeting events directly to Google Calendar.
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 uppercase block font-bold">
                    Google OAuth Client ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-xs text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 outline-none font-mono"
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="w-full text-xs"
                >
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  <span>{isConnectingGoogle ? 'Authorizing...' : 'Connect Google Calendar'}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Privacy & Offline Guarantee Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100/60 dark:bg-zinc-950/60 font-mono text-xs space-y-2 text-slate-700 dark:text-zinc-400">
            <div className="flex items-center gap-2 text-slate-950 dark:text-zinc-200 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>100% Local Scheduling Engine</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Date detection from audio and meeting transcripts runs completely on-device. Computer Calendar (.ics) downloads launch Apple Calendar or Outlook locally without sending data to any remote server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
