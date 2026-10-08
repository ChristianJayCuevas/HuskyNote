import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWorkspace } from '../context/workspace-context';
import { useAI } from '../context/ai-context';
import { ai } from '../services/ai/active-provider';
import { cn } from '@/lib/utils';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { EmptyState } from '../components/ui/empty-state';
import { Field } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { PageContainer, PageHeader } from '../components/ui/page';
import { Textarea } from '../components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import type { ScheduleEvent, ScheduleCategory, GoogleCalendarConfig } from '../types';
import { downloadIcsFile, downloadMultipleEventsIcs } from '../services/calendar/ics-generator';
import {
  getGoogleCalendarConfig,
  disconnectGoogleCalendar,
  authenticateGoogleCalendar,
  createGoogleCalendarEvent,
  fetchUpcomingGoogleCalendarEvents,
} from '../services/calendar/google-calendar';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Sparkles,
  Laptop,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  ShieldCheck,
} from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Categorical data colors for schedule categories (dots only; labels stay in text tokens) */
const CATEGORY_DOT: Record<ScheduleCategory, string> = {
  meeting: 'bg-chart-1',
  'deep-work': 'bg-chart-3',
  review: 'bg-chart-4',
  manual: 'bg-chart-5',
  deadline: 'bg-chart-2',
};

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const ScheduleView: React.FC = () => {
  const { addToast, setActiveView } = useWorkspace();

  const openGoogleSettings = () => {
    try {
      localStorage.setItem('huskynote-settings-tab', 'integrations');
    } catch {
      /* storage unavailable */
    }
    try {
      // A stale ?tab= in the address bar would win over the tab chosen above
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      /* ignore */
    }
    setActiveView('settings');
  };
  const { isConnected: isAIOfflineOrOnline, selectedModel } = useAI();

  // Reactive IndexedDB events
  const dbEvents = useLiveQuery(() => db.schedule.toArray(), []) || [];

  const todayStr = useMemo(() => formatIso(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  // Google Calendar integration state
  const [gcalConfig, setGcalConfig] = useState<GoogleCalendarConfig>(() => getGoogleCalendarConfig());
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

  // Events grouped by date, in time order (titles shown in the month grid)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const ev of [...dbEvents].sort((a, b) => a.time.localeCompare(b.time))) {
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
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
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCalendarMonth(now);
    setSelectedDate(formatIso(now));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

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
    await db.schedule.update(ev.id, { completed: !ev.completed });
  };

  const handleDeleteEvent = async (id: string) => {
    await db.schedule.delete(id);
    addToast('Event removed from schedule.', 'info');
  };

  const handleAddToComputerCalendar = async (ev: ScheduleEvent) => {
    downloadIcsFile(ev);
    await db.schedule.update(ev.id, { addedToComputerCalendar: true });
    addToast(`Generated .ics for "${ev.title}". Opening in Computer Calendar.`, 'success');
  };

  const handleSyncToGoogleCalendar = async (ev: ScheduleEvent) => {
    const res = await createGoogleCalendarEvent(ev);
    if (res.success) {
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
    try {
      const res = await authenticateGoogleCalendar();
      if (res.success) {
        setGcalConfig(getGoogleCalendarConfig());
        addToast(`Connected to Google Calendar (${res.userEmail}).`, 'success');
      } else {
        addToast(res.error || 'Google authentication was cancelled.', 'warning');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGoogleCalendar();
    setGcalConfig(getGoogleCalendarConfig());
    addToast('Disconnected Google Calendar.', 'info');
  };

  const handleSyncGoogleEvents = async () => {
    setIsSyncingGoogle(true);
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

    try {
      const [recentNotes, recentMeetings] = await Promise.all([
        db.notes.orderBy('updatedAt').reverse().limit(4).toArray(),
        db.meetings.orderBy('startTime').reverse().filter((m) => !m.mergedInto).limit(3).toArray(),
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
    <PageContainer width="wide">
      <PageHeader
        title="Calendar & Automated Schedule"
        description="Add events by voice, import .ics files, or connect Google Calendar."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportMonthIcs}
              title="Export all plotted events to Computer Calendar (.ics)"
            >
              <Download />
              <span>Export to Computer (.ics)</span>
            </Button>
            <Button variant="default" size="sm" onClick={handleGenerateAISchedule} disabled={isGeneratingSchedule}>
              <Sparkles className={cn(isGeneratingSchedule && 'animate-spin')} />
              <span>{isGeneratingSchedule ? 'Optimizing...' : 'AI Plot Schedule'}</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: Calendar Grid & Agenda List */}
        <div className="min-w-0 space-y-8">
          {/* Month Calendar */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">{monthLabel}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleJumpToToday}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  aria-label="Previous Month"
                >
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={handleNextMonth} title="Next Month" aria-label="Next Month">
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 border-t">
              {WEEKDAYS.map((day) => (
                <span key={day} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {day}
                </span>
              ))}
            </div>

            {/* Calendar Date Cells */}
            <div className="grid grid-cols-7 border-t">
              {calendarDays.map((cell, idx) => {
                const cellEvents = eventsByDate.get(cell.dateStr) || [];
                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                    }}
                    aria-pressed={cell.isSelected}
                    aria-current={cell.isToday ? 'date' : undefined}
                    className={cn(
                      'flex min-h-16 min-w-0 flex-col items-start gap-1 border-b border-r p-1 text-left transition-colors duration-100 hover:bg-accent/50 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20 sm:p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
                      cell.isSelected && 'bg-accent hover:bg-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
                        cell.isToday
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : cell.isCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/60',
                        cell.isSelected && !cell.isToday && 'font-semibold'
                      )}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Event indicators: titles from sm, category dots on phones */}
                    {cell.eventCount > 0 && (
                      <>
                        <div aria-hidden="true" className="flex flex-wrap gap-0.5 px-1 sm:hidden">
                          {cellEvents.slice(0, 3).map((ev) => (
                            <span key={ev.id} className={cn('size-1.5 rounded-full', CATEGORY_DOT[ev.category] ?? 'bg-muted-foreground')} />
                          ))}
                        </div>
                        <div className="hidden w-full min-w-0 space-y-0.5 sm:block">
                          {cellEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              className={cn(
                                'flex w-full min-w-0 items-center gap-1 rounded-sm border bg-card px-1 py-px text-xs text-foreground shadow-xs',
                                ev.completed && 'text-muted-foreground line-through',
                                !cell.isCurrentMonth && 'opacity-60'
                              )}
                            >
                              <span className={cn('size-1.5 shrink-0 rounded-full', CATEGORY_DOT[ev.category] ?? 'bg-muted-foreground')} />
                              <span className="truncate">{ev.title}</span>
                            </div>
                          ))}
                          {cell.eventCount > 2 && (
                            <div className="px-1 text-xs text-muted-foreground">+{cell.eventCount - 2} more</div>
                          )}
                        </div>
                        <span className="sr-only">
                          {cell.eventCount} {cell.eventCount === 1 ? 'event' : 'events'}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Agenda / Plotted Events List */}
          <section className="space-y-3">
            <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{selectedDateLabel}</h2>
                <span className="text-xs text-muted-foreground">
                  {eventsForSelectedDate.length} plotted event(s) •{' '}
                  {eventsForSelectedDate.filter((e) => e.completed).length} completed
                </span>
              </div>

              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={activeFilter}
                onValueChange={(value) => value && setActiveFilter(value as 'selected-day' | 'all')}
                aria-label="Agenda filter"
              >
                <ToggleGroupItem value="selected-day">This Day</ToggleGroupItem>
                <ToggleGroupItem value="all">All Plotted ({dbEvents.length})</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {displayedEvents.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title={`No events plotted for ${selectedDate}.`}
                description="Mention dates and times during meetings, or use the form on the right to plot an event."
                className="py-10"
              />
            ) : (
              <ul className="-mx-2">
                {displayedEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="group flex flex-col gap-2 rounded-md px-2 py-2.5 transition-colors duration-100 hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Checkbox
                        checked={ev.completed}
                        onCheckedChange={() => toggleEventComplete(ev)}
                        title="Toggle completion"
                        aria-label="Toggle completion"
                        className="mt-0.5"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {ev.date} @ {ev.time}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">({ev.durationMin}m)</span>
                          <Badge variant="secondary" className="font-normal">
                            <span className={cn('size-1.5 rounded-full', CATEGORY_DOT[ev.category] ?? 'bg-muted-foreground')} />
                            {ev.category}
                          </Badge>

                          {ev.detectedFrom && (
                            <Badge variant="outline" className="font-normal">
                              <Sparkles />
                              AI DETECTED
                            </Badge>
                          )}
                        </div>

                        <h3
                          className={cn(
                            'mt-0.5 truncate text-sm font-medium',
                            ev.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                          )}
                        >
                          {ev.title}
                        </h3>

                        {ev.notes && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{ev.notes}</p>}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 items-center gap-1 self-end pl-7 sm:self-center sm:pl-0">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleAddToComputerCalendar(ev)}
                        className={cn('text-muted-foreground', ev.addedToComputerCalendar && 'text-success hover:text-success')}
                        title="Add to Computer Calendar (.ics)"
                      >
                        {ev.addedToComputerCalendar ? <Check /> : <Laptop />}
                        <span className="hidden sm:inline">.ics</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSyncToGoogleCalendar(ev)}
                        className={cn('text-muted-foreground', ev.syncedToGoogle && 'text-success hover:text-success')}
                        title="Sync to Google Calendar"
                      >
                        {ev.syncedToGoogle ? <Check /> : <Globe />}
                        <span className="hidden sm:inline">Google</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                        title="Delete Event"
                        aria-label="Delete Event"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: Add Event Form, Google Calendar Sync, privacy note */}
        <div className="space-y-4">
          {/* Quick Add Event Form */}
          <Card>
            <form onSubmit={handleAddEvent}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Plus className="size-4 text-muted-foreground" />
                  <span>Plot Schedule Event</span>
                </CardTitle>
                <CardAction>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{selectedDate}</span>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Event / Task Title" htmlFor="schedule-event-title">
                  <Input
                    id="schedule-event-title"
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Architecture Sync & Code Review"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date (YYYY-MM-DD)" htmlFor="schedule-event-date">
                    <Input
                      id="schedule-event-date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Start Time" htmlFor="schedule-event-time">
                    <Input
                      id="schedule-event-time"
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Duration (min)" htmlFor="schedule-event-duration">
                    <Input
                      id="schedule-event-duration"
                      type="number"
                      value={newEventDuration}
                      onChange={(e) => setNewEventDuration(Number(e.target.value))}
                      min={15}
                      step={15}
                      className="tabular-nums"
                    />
                  </Field>
                  <Field label="Category" htmlFor="schedule-event-category">
                    <NativeSelect
                      id="schedule-event-category"
                      value={newEventCategory}
                      onChange={(e) => setNewEventCategory(e.target.value as any)}
                    >
                      <option value="meeting">Meeting</option>
                      <option value="deep-work">Deep Work</option>
                      <option value="review">Review</option>
                      <option value="manual">Manual / SOP</option>
                      <option value="deadline">Deadline</option>
                    </NativeSelect>
                  </Field>
                </div>

                <Field label="Notes & Agenda" htmlFor="schedule-event-notes">
                  <Textarea
                    id="schedule-event-notes"
                    value={newEventNotes}
                    onChange={(e) => setNewEventNotes(e.target.value)}
                    placeholder="Optional meeting agenda, attendees, or details..."
                    rows={2}
                    className="min-h-14 resize-none"
                  />
                </Field>

                <Button variant="default" type="submit" className="w-full">
                  <Plus />
                  <span>Insert into Schedule</span>
                </Button>
              </CardContent>
            </form>
          </Card>

          {/* Google Calendar Sync & Auth Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe className="size-4 text-muted-foreground" />
                <span>Google Calendar Sync</span>
              </CardTitle>
              <CardAction>
                <Badge variant={gcalConfig.isConnected ? 'success' : 'secondary'} dot>
                  {gcalConfig.isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {gcalConfig.isConnected ? (
                <>
                  <div className="space-y-1 rounded-md bg-muted p-3 text-xs">
                    <div className="font-medium text-foreground">Account: {gcalConfig.userEmail || 'Active Google Token'}</div>
                    <p className="text-muted-foreground">
                      Direct two-way calendar sync active. Detected events can be pushed directly to Google Calendar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncGoogleEvents}
                      disabled={isSyncingGoogle}
                      className="flex-1"
                    >
                      <Globe />
                      <span>{isSyncingGoogle ? 'Syncing...' : 'Pull Google Events'}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnectGoogle}
                      className="text-destructive hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Connect your Google account to sync detected meeting events directly to Google Calendar.
                  </p>

                  {!gcalConfig.clientId && (
                    <Button type="button" variant="link" size="xs" onClick={openGoogleSettings} className="h-auto px-0 text-muted-foreground underline hover:text-foreground">
                      Connect Google Calendar in Settings
                    </Button>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnectGoogle}
                    disabled={isConnectingGoogle}
                    className="w-full"
                  >
                    <Globe />
                    <span>{isConnectingGoogle ? 'Authorizing...' : 'Connect Google Calendar'}</span>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Privacy & Offline Guarantee */}
          <Alert>
            <ShieldCheck />
            <AlertTitle>100% Local Scheduling Engine</AlertTitle>
            <AlertDescription className="text-xs">
              Date detection from audio and meeting transcripts runs completely on-device. Computer Calendar (.ics) downloads launch Apple Calendar or Outlook locally without sending data to any remote server.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </PageContainer>
  );
};
