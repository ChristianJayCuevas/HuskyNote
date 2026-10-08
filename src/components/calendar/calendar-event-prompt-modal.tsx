import React, { useState } from 'react';
import type { ScheduleEvent } from '../../types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { downloadIcsFile } from '../../services/calendar/ics-generator';
import { createGoogleCalendarEvent, getGoogleCalendarConfig } from '../../services/calendar/google-calendar';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { Calendar, Clock, Laptop, Globe, Check, ArrowRight } from 'lucide-react';

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
  const [addedComputerIds, setAddedComputerIds] = useState<Set<string>>(new Set());
  const [syncedGoogleIds, setSyncedGoogleIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddToComputerCalendar = async (event: ScheduleEvent) => {
    downloadIcsFile(event);
    setAddedComputerIds((prev) => new Set(prev).add(event.id));

    // Update in Dexie
    await db.schedule.update(event.id, { addedToComputerCalendar: true });
    addToast(`Added "${event.title}" to Computer Calendar (.ics).`, 'success');
    if (onEventAdded) onEventAdded(event);
  };

  const handleSyncToGoogle = async (event: ScheduleEvent) => {
    setIsProcessing(true);
    try {
      const res = await createGoogleCalendarEvent(event);
      if (res.success) {
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
    <Dialog
      open={isOpen && events.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Scheduled Events Detected</DialogTitle>
            <Badge variant="secondary">Local AI</Badge>
          </div>
          <DialogDescription>
            Local AI identified {events.length} scheduled event(s) from your meeting discussion.
          </DialogDescription>
        </DialogHeader>

        {/* Event List */}
        <DialogBody>
          <ul className="divide-y rounded-lg border">
            {events.map((ev) => {
              const isAddedComputer = addedComputerIds.has(ev.id) || ev.addedToComputerCalendar;
              const isSyncedGoogle = syncedGoogleIds.has(ev.id) || ev.syncedToGoogle;

              return (
                <li key={ev.id} className="flex flex-col justify-between gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{ev.title}</span>
                      <Badge variant="secondary" className="font-normal">
                        {ev.category}
                      </Badge>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 tabular-nums text-foreground">
                        <Calendar className="size-3 text-muted-foreground" />
                        {ev.date}
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="size-3" />
                        {ev.time} ({ev.durationMin}m)
                      </span>
                    </div>

                    {ev.detectedFrom?.snippet && (
                      <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">"{ev.detectedFrom.snippet}"</p>
                    )}
                  </div>

                  {/* Event Action Buttons */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant={isAddedComputer ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleAddToComputerCalendar(ev)}
                      title="Add to Apple Calendar, Outlook, or native computer calendar"
                    >
                      {isAddedComputer ? <Check className="text-success" /> : <Laptop />}
                      <span>{isAddedComputer ? 'Added to OS' : 'Computer (.ics)'}</span>
                    </Button>

                    <Button
                      variant={isSyncedGoogle ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleSyncToGoogle(ev)}
                      disabled={isProcessing}
                      title="Sync to Google Calendar"
                    >
                      {isSyncedGoogle ? <Check className="text-success" /> : <Globe />}
                      <span>{isSyncedGoogle ? 'Google Synced' : 'Google Cal'}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogBody>

        <DialogFooter className="sm:items-center sm:justify-between">
          <Button variant="link" size="sm" onClick={handleViewSchedule} className="px-0">
            <span>View all in HuskyNote Schedule</span>
            <ArrowRight />
          </Button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={handleAddAllToComputer}>
              <Laptop />
              <span>Add All to Computer (.ics)</span>
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              <span>Done</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
