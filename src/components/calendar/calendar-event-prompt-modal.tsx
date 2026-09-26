import React, { useState } from 'react';
import type { ScheduleEvent } from '../../types';
import { Button } from '../ui/button';
import { downloadIcsFile } from '../../services/calendar/ics-generator';
import { createGoogleCalendarEvent, getGoogleCalendarConfig } from '../../services/calendar/google-calendar';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { useSound } from '../../context/sound-context';
import {
  Calendar,
  Clock,
  Laptop,
  Globe,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CalendarEventPromptModalProps {
  events: ScheduleEvent[];
  isOpen: boolean;
  onClose: () => void;
  onEventAdded?: (event: ScheduleEvent) => void;
}

export const CalendarEventPromptModal: React.FC<CalendarEventPromptModalProps> = ({
  events,
  isOpen,
  onClose,
  onEventAdded,
}) => {
  const { addToast, setActiveView } = useWorkspace();
  const { playPop, playChime } = useSound();
  const [addedComputerIds, setAddedComputerIds] = useState<Set<string>>(new Set());
  const [syncedGoogleIds, setSyncedGoogleIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || events.length === 0) return null;

  const handleAddToComputerCalendar = async (event: ScheduleEvent) => {
    playPop();
    downloadIcsFile(event);
    setAddedComputerIds((prev) => new Set(prev).add(event.id));

    // Update in Dexie
    await db.schedule.update(event.id, { addedToComputerCalendar: true });
    addToast(`Added "${event.title}" to Computer Calendar (.ics).`, 'success');
    if (onEventAdded) onEventAdded(event);
  };

  const handleSyncToGoogle = async (event: ScheduleEvent) => {
    playPop();
    setIsProcessing(true);
    try {
      const res = await createGoogleCalendarEvent(event);
      if (res.success) {
        playChime();
        setSyncedGoogleIds((prev) => new Set(prev).add(event.id));
        await db.schedule.update(event.id, {
          syncedToGoogle: true,
          googleCalendarEventId: res.eventId,
        });
        addToast(`Synced "${event.title}" to Google Calendar.`, 'success');
        if (onEventAdded) onEventAdded(event);
      } else {
        addToast(res.error || 'Failed to sync to Google Calendar.', 'warning');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddAllToComputer = async () => {
    playPop();
    for (const ev of events) {
      downloadIcsFile(ev);
      await db.schedule.update(ev.id, { addedToComputerCalendar: true });
    }
    setAddedComputerIds(new Set(events.map((e) => e.id)));
    addToast(`Added ${events.length} event(s) to Computer Calendar.`, 'success');
  };

  const handleViewSchedule = () => {
    onClose();
    setActiveView('schedule');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white shadow-2xl p-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white">
              <Sparkles className="w-5 h-5 text-slate-900 dark:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                  Scheduled Events Detected
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white font-bold border border-slate-300 dark:border-white/20">
                  Local AI
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                Local AI identified {events.length} scheduled event(s) from your meeting discussion.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Event List */}
        <div className="py-4 space-y-3 max-h-80 overflow-y-auto relative z-10">
          {events.map((ev) => {
            const isAddedComputer = addedComputerIds.has(ev.id) || ev.addedToComputerCalendar;
            const isSyncedGoogle = syncedGoogleIds.has(ev.id) || ev.syncedToGoogle;

            return (
              <div
                key={ev.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-950 dark:text-white truncate">
                      {ev.title}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 font-semibold">
                      {ev.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-3 h-3 text-slate-900 dark:text-white" />
                      {ev.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-900 dark:text-white" />
                      {ev.time} ({ev.durationMin}m)
                    </span>
                  </div>

                  {ev.detectedFrom?.snippet && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 italic line-clamp-1">
                      "{ev.detectedFrom.snippet}"
                    </p>
                  )}
                </div>

                {/* Event Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAddToComputerCalendar(ev)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                      isAddedComputer
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                    }`}
                    title="Add to Apple Calendar, Outlook, or native computer calendar"
                  >
                    {isAddedComputer ? <Check className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
                    <span>{isAddedComputer ? 'Added to OS' : 'Computer (.ics)'}</span>
                  </button>

                  <button
                    onClick={() => handleSyncToGoogle(ev)}
                    disabled={isProcessing}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                      isSyncedGoogle
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                    }`}
                    title="Sync to Google Calendar"
                  >
                    {isSyncedGoogle ? <Check className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>{isSyncedGoogle ? 'Google Synced' : 'Google Cal'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <button
            onClick={handleViewSchedule}
            className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1"
          >
            <span>View all in HuskyNote Schedule</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAllToComputer}
              className="text-xs"
            >
              <Laptop className="w-3.5 h-3.5 mr-1" />
              <span>Add All to Computer (.ics)</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              <span>Done</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
