import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWorkspace } from '../context/workspace-context';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { PageContainer, PageHeader } from '../components/ui/page';
import { cn } from '@/lib/utils';
import { createEmptyNote } from '../services/notes/actions';
import { collectOpenActionItems, setActionItemDone } from '../services/meetings/action-items';
import { isAiReportMissing, meetingDurationSeconds } from '../services/meetings/meeting-report';
import type { Meeting } from '../types';
import { FileText, Mic, FileUp, Video, Plus, ArrowRight, Calendar, Check, Sparkles, HelpCircle } from 'lucide-react';

const DAY_MS = 86_400_000;

const isoDate = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Monday 00:00 of the week containing the date */
const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const formatMinutes = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
};

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

/** Section panel: a bordered card with a small header row */
const panel = 'rounded-lg border bg-card text-card-foreground';
const panelTitle = 'text-base font-semibold text-foreground';
/** Clickable secondary line under a list item (meeting reference) */
const metaLink = 'max-w-full truncate rounded-sm text-left text-xs text-muted-foreground transition-colors duration-100 hover:text-foreground hover:underline underline-offset-2';

const StatTile: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <Card className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
  </Card>
);

interface DayActivity {
  date: Date;
  seconds: number;
  meetings: number;
}

/** Meeting time per day for the last 14 days, as columns with a hover readout */
const MeetingTimeChart: React.FC<{ days: DayActivity[] }> = ({ days }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.seconds), 0);
  // Round the scale up to a clean step so the top gridline reads well
  const step = max <= 1800 ? 900 : max <= 3600 ? 1800 : 3600;
  const scale = Math.max(step, Math.ceil(max / step) * step);
  const total = days.reduce((sum, d) => sum + d.seconds, 0);
  const active = hovered !== null ? days[hovered] : null;

  return (
    <section className={cn(panel, 'p-4')} aria-labelledby="meeting-time-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="meeting-time-title" className={panelTitle}>Meeting time</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{formatMinutes(total)} in 14 days</span>
      </div>
      {/* Mouse-only readout; the sr-only table below carries the same data for assistive tech */}
      <div className="mt-1 h-4 text-xs tabular-nums text-muted-foreground" aria-hidden="true">
        {active
          ? `${active.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatMinutes(active.seconds)} · ${active.meetings} meeting${active.meetings === 1 ? '' : 's'}`
          : 'Hover a day for details'}
      </div>
      <div className="relative mt-6 h-32" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="absolute -top-5 right-0 text-xs tabular-nums text-muted-foreground">{formatMinutes(scale)}</span>
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        <div className="absolute inset-0 flex items-end gap-0.5">
          {days.map((day, i) => (
            <div
              key={i}
              className="flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={cn(
                  'w-full max-w-6 rounded-t-[4px] transition-opacity duration-100',
                  day.seconds > 0 && 'bg-chart-1',
                  hovered !== null && hovered !== i && 'opacity-50'
                )}
                style={{ height: day.seconds > 0 ? `${Math.max(3, (day.seconds / scale) * 100)}%` : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-0.5 text-xs text-muted-foreground" aria-hidden="true">
        {days.map((day, i) => (
          <div key={i} className={cn('flex-1 text-center', i === days.length - 1 && 'font-semibold text-foreground')}>
            {day.date.toLocaleDateString(undefined, { weekday: 'narrow' })}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Meeting time per day, last 14 days</caption>
        <tbody>
          {days.map((day, i) => (
            <tr key={i}>
              <th scope="row">{day.date.toLocaleDateString()}</th>
              <td>{formatMinutes(day.seconds)}</td>
              <td>{day.meetings} meetings</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const DashboardView: React.FC = () => {
  const { setActiveView, setActiveNoteId, setActiveMeetingId, setActiveDocumentId, setActiveManualId, addToast } = useWorkspace();

  const now = new Date();
  const today = isoDate(now);
  const weekStart = startOfWeek(now).getTime();
  const lastWeekStart = weekStart - 7 * DAY_MS;
  const since = Math.min(lastWeekStart, startOfDay(now).getTime() - 34 * DAY_MS);
  const inSevenDays = isoDate(new Date(now.getTime() + 7 * DAY_MS));

  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().limit(8).toArray(), []) ?? [];
  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().limit(8).toArray(), []) ?? [];
  const manuals = useLiveQuery(() => db.manuals.orderBy('updatedAt').reverse().limit(8).toArray(), []) ?? [];
  // The last five weeks of meetings drive the stats, chart, action items and questions
  const meetings = useLiveQuery(() => db.meetings.where('startTime').aboveOrEqual(since).filter((m) => !m.mergedInto).reverse().sortBy('startTime'), [since]) ?? [];
  const notesThisWeek = useLiveQuery(() => db.notes.where('updatedAt').aboveOrEqual(weekStart).count(), [weekStart]) ?? 0;
  const notesLastWeek = useLiveQuery(() => db.notes.where('updatedAt').between(lastWeekStart, weekStart).count(), [lastWeekStart, weekStart]) ?? 0;
  const upcoming = useLiveQuery(
    () => db.schedule.where('date').between(today, inSevenDays, true, true).toArray()
      .then((items) => items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))),
    [today, inSevenDays]
  ) ?? [];

  const openMeeting = (id: string) => {
    setActiveMeetingId(id);
    setActiveView('meetings');
  };

  const stats = useMemo(() => {
    const inRange = (m: Meeting, from: number, to: number) => m.startTime >= from && m.startTime < to;
    const thisWeek = meetings.filter((m) => inRange(m, weekStart, Infinity));
    const lastWeek = meetings.filter((m) => inRange(m, lastWeekStart, weekStart));
    const seconds = (list: Meeting[]) => list.reduce((sum, m) => sum + meetingDurationSeconds(m), 0);
    return { thisWeek, lastWeek, thisWeekSeconds: seconds(thisWeek), lastWeekSeconds: seconds(lastWeek) };
  }, [meetings, weekStart, lastWeekStart]);

  const days = useMemo<DayActivity[]>(() => {
    // Recomputed when the date changes; built from calendar dates so daylight-saving shifts don't skip a day
    const todayStart = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - 13 + i);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      const onDay = meetings.filter((m) => m.startTime >= date.getTime() && m.startTime < end.getTime());
      return { date, seconds: onDay.reduce((sum, m) => sum + meetingDurationSeconds(m), 0), meetings: onDay.length };
    });
  }, [meetings, today]);

  const actionItems = useMemo(() => collectOpenActionItems(meetings), [meetings]);
  const actionMeetingCount = new Set(actionItems.map((a) => a.meetingId)).size;
  const missingReports = meetings.filter((m) => isAiReportMissing(m)).slice(0, 3);
  const openQuestions = meetings
    .filter((m) => !isAiReportMissing(m))
    .slice(0, 3)
    .flatMap((m) => (m.summary?.followUpTasks ?? []).map((q) => ({ meetingId: m.id, meetingTitle: m.title, question: q })))
    .slice(0, 5);

  const recent = [
    ...notes.map((note) => ({ id: note.id, type: 'Note', title: note.title || 'Untitled Note', timestamp: note.updatedAt, icon: FileText, open: () => { setActiveNoteId(note.id); setActiveView('notes'); } })),
    ...meetings.slice(0, 8).map((meeting) => ({ id: meeting.id, type: 'Meeting', title: meeting.title, timestamp: meeting.startTime, icon: Mic, open: () => openMeeting(meeting.id) })),
    ...documents.map((document) => ({ id: document.id, type: 'Document', title: document.title, timestamp: document.createdAt, icon: FileUp, open: () => { setActiveDocumentId(document.id); setActiveView('documents'); } })),
    ...manuals.map((manual) => ({ id: manual.id, type: 'Guide', title: manual.title, timestamp: manual.updatedAt, icon: Video, open: () => { setActiveManualId(manual.id); setActiveView('manuals'); } })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);

  const upcomingByDay = upcoming.slice(0, 8).reduce<Array<{ date: string; items: typeof upcoming }>>((groups, event) => {
    const group = groups.find((g) => g.date === event.date);
    if (group) group.items.push(event);
    else groups.push({ date: event.date, items: [event] });
    return groups;
  }, []);
  const dayLabel = (date: string) => {
    if (date === today) return 'Today';
    if (date === isoDate(new Date(now.getTime() + DAY_MS))) return 'Tomorrow';
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const createNote = async () => {
    try { setActiveNoteId(await createEmptyNote()); setActiveView('notes'); }
    catch { addToast('Could not create a note. Check available storage and retry.', 'error'); }
  };
  const openAction = (view: 'meetings' | 'documents', action: 'meeting' | 'upload') => {
    const url = new URL(window.location.href);
    url.searchParams.set('action', action);
    window.history.replaceState(window.history.state, '', url.toString());
    setActiveView(view);
  };
  const completeActionItem = async (meetingId: string, index: number) => {
    try {
      await setActionItemDone(meetingId, index, true);
      addToast('Action item marked done.', 'success');
    } catch {
      addToast('Could not update the action item. Please try again.', 'error');
    }
  };

  const isEmpty = !recent.length && !upcoming.length;

  const todayCount = upcoming.filter((e) => e.date === today && !e.completed).length;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={greeting(now.getHours())}
        titleClassName="text-3xl font-bold"
        description={
          <>
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {todayCount > 0 && ` · ${todayCount} on your schedule today`}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Create">
            <Button variant="default" size="sm" onClick={() => void createNote()}><Plus />New Note</Button>
            <Button variant="outline" size="sm" onClick={() => openAction('meetings', 'meeting')}><Mic />Meeting setup</Button>
            <Button variant="outline" size="sm" onClick={() => openAction('documents', 'upload')}><FileUp />Upload</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveView('studio')}><Video />Guide recorder</Button>
          </div>
        }
      />

      {isEmpty ? (
        <section className="rounded-lg border border-dashed">
          <EmptyState
            icon={FileText}
            title="Start with a note"
            description="Write a thought or a task. You can set up recording and AI whenever you need them."
            actionLabel="Create your first note"
            onAction={() => void createNote()}
          />
        </section>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Meeting time this week" value={formatMinutes(stats.thisWeekSeconds)} detail={`Last week ${formatMinutes(stats.lastWeekSeconds)}`} />
            <StatTile label="Meetings this week" value={String(stats.thisWeek.length)} detail={`Last week ${stats.lastWeek.length}`} />
            <StatTile
              label="Open action items"
              value={String(actionItems.length)}
              detail={actionItems.length ? `From ${actionMeetingCount} meeting${actionMeetingCount === 1 ? '' : 's'}` : 'All caught up'}
            />
            <StatTile label="Notes edited this week" value={String(notesThisWeek)} detail={`Last week ${notesLastWeek}`} />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="min-w-0 space-y-6">
              <section className={panel} aria-labelledby="action-items-title">
                <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
                  <h3 id="action-items-title" className={panelTitle}>Open action items</h3>
                  <span className="text-xs text-muted-foreground">Last 5 weeks</span>
                </div>
                {!actionItems.length ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">
                    {meetings.length ? 'Nothing open. Action items from your meeting reports show up here.' : 'Action items from your meeting reports show up here.'}
                  </p>
                ) : (
                  <ul className="px-2 pb-2">
                    {actionItems.slice(0, 6).map((item) => (
                      <li key={`${item.meetingId}:${item.index}`} className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-accent/50">
                        <button
                          type="button"
                          onClick={() => void completeActionItem(item.meetingId, item.index)}
                          className="group/check relative mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input transition-colors duration-100 after:absolute after:-inset-2 hover:border-success hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          title="Mark done"
                          aria-label={`Mark done: ${item.task}`}
                        >
                          <Check className="size-3 text-success opacity-0 group-hover/check:opacity-100" strokeWidth={3} aria-hidden="true" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground">{item.task}</p>
                          <button type="button" onClick={() => openMeeting(item.meetingId)} className={cn(metaLink, 'mt-0.5')}>
                            {item.meetingTitle} · {shortDate(item.meetingStart)}
                          </button>
                        </div>
                        {item.owner && (
                          <Badge variant="secondary" className="max-w-36 truncate">
                            {item.owner}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {actionItems.length > 6 && (
                  <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                    {actionItems.length - 6} more in your meeting reports
                  </p>
                )}
              </section>

              <MeetingTimeChart days={days} />

              <section className={panel} aria-labelledby="recent-title">
                <h3 id="recent-title" className={cn(panelTitle, 'px-4 pb-2 pt-4')}>Recent work</h3>
                {!recent.length ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">Notes, meetings, documents and guides you open show up here.</p>
                ) : (
                  <div className="px-2 pb-2">
                    {recent.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type + ':' + item.id}
                          type="button"
                          onClick={item.open}
                          className="group/row flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{item.type} · {shortDate(item.timestamp)}</div>
                          </div>
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-100 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 coarse:opacity-100" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <section className={panel} aria-labelledby="upcoming-title">
                <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
                  <h3 id="upcoming-title" className={panelTitle}>Coming up</h3>
                  <Button variant="ghost" size="xs" className="-mr-2 text-muted-foreground" onClick={() => setActiveView('schedule')}>
                    Schedule
                    <ArrowRight />
                  </Button>
                </div>
                {!upcomingByDay.length ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing scheduled in the next 7 days.</p>
                ) : (
                  <div className="space-y-4 px-4 pb-4 pt-1">
                    {upcomingByDay.map((group) => (
                      <div key={group.date}>
                        <div className="mb-2 text-xs font-medium text-muted-foreground">{dayLabel(group.date)}</div>
                        <div className="space-y-2.5">
                          {group.items.map((event) => (
                            <div key={event.id} className="flex gap-3">
                              {event.completed
                                ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                                : <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                              <div className="min-w-0">
                                <div className={cn('truncate text-sm font-medium', event.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>{event.title}</div>
                                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{event.time} · {event.durationMin} min</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {upcoming.length > 8 && <p className="text-xs text-muted-foreground">{upcoming.length - 8} more this week</p>}
                  </div>
                )}
              </section>

              {missingReports.length > 0 && (
                <section className={panel} aria-labelledby="missing-reports-title">
                  <h3 id="missing-reports-title" className={cn(panelTitle, 'flex items-center gap-2 px-4 pb-2 pt-4')}>
                    <Sparkles className="size-4 text-warning" aria-hidden="true" />
                    Meetings without a report
                  </h3>
                  <ul className="px-2 pb-2">
                    {missingReports.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => openMeeting(m.id)}
                          className="group/row flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{m.title}</span>
                            <span className="block text-xs tabular-nums text-muted-foreground">{shortDate(m.startTime)} · {formatMinutes(meetingDurationSeconds(m))}</span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-foreground underline-offset-4 group-hover/row:underline">Generate</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className={panel} aria-labelledby="questions-title">
                <h3 id="questions-title" className={cn(panelTitle, 'flex items-center gap-2 px-4 pb-2 pt-4')}>
                  <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
                  Open questions
                </h3>
                {!openQuestions.length ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">Follow-ups and open questions from your recent meetings show up here.</p>
                ) : (
                  <ul className="space-y-3 px-4 pb-4 pt-1">
                    {openQuestions.map((q, i) => (
                      <li key={i}>
                        <p className="text-sm leading-snug text-foreground">{q.question}</p>
                        <button type="button" onClick={() => openMeeting(q.meetingId)} className={cn(metaLink, 'mt-0.5')}>
                          {q.meetingTitle}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
