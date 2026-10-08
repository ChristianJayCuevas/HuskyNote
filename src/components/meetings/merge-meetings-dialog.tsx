import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Meeting } from '../../types';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Field } from '../ui/field';
import { Spinner } from '../ui/spinner';
import { meetingDurationSeconds } from '../../services/meetings/meeting-report';
import { isUnfinishedRecording, mergeMeetings } from '../../services/meetings/merge';

const PLACEHOLDER_TITLES = new Set(['', 'Meeting Title', 'Meeting recording']);
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const minutesOf = (seconds: number) => (seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`);
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
/** Best guess of when a recording ended; unfinished ones use their last transcript line */
const estimatedEnd = (m: Meeting) => m.endTime
  ?? m.startTime + m.transcript.reduce((latest, s) => Math.max(latest, s.timestampSeconds || 0), 0) * 1000;

interface MergeMeetingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Meeting;
  onMerged: (mergedId: string) => void;
  onError: (message: string) => void;
}

/** Pick recordings to combine with this meeting into one */
export const MergeMeetingsDialog: React.FC<MergeMeetingsDialogProps> = ({ open, onOpenChange, current, onMerged, onError }) => {
  const candidates = useLiveQuery(
    () => db.meetings.orderBy('startTime').reverse().filter((m) => !m.mergedInto && !m.parts?.length).limit(40).toArray(),
    []
  ) ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set([current.id]));
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);

  // When opened: preselect this meeting plus other same-day recordings that have content
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current || candidates.length === 0) return;
    initialized.current = true;
    const sameDayWithContent = candidates.filter((m) => m.id === current.id
      || (sameDay(m.startTime, current.startTime) && (m.transcript.length > 0 || m.manualNotes.trim())));
    setSelected(new Set(sameDayWithContent.map((m) => m.id)));
    const named = sameDayWithContent.find((m) => !PLACEHOLDER_TITLES.has(m.title.trim()));
    setTitle(named?.title ?? `Meeting on ${new Date(current.startTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`);
  }, [open, candidates, current]);

  const chosen = useMemo(
    () => candidates.filter((m) => selected.has(m.id)).sort((a, b) => a.startTime - b.startTime),
    [candidates, selected]
  );
  const span = chosen.length >= 2
    ? `${timeOf(chosen[0].startTime)} – ${timeOf(Math.max(...chosen.map(estimatedEnd)))}`
    : null;

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      next.add(current.id);
      return next;
    });
  };

  const handleMerge = async () => {
    setBusy(true);
    try {
      const mergedId = await mergeMeetings(chosen.map((m) => m.id), title);
      onOpenChange(false);
      onMerged(mergedId);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Merge meetings</DialogTitle>
          <DialogDescription>
            Combine recordings of the same meeting, for example after a recording was cut off and restarted.
            Transcripts, notes and screenshots are joined in time order. The originals stay saved, and you can unmerge at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Title for the merged meeting" htmlFor="merge-title">
            <Input id="merge-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} disabled={busy} />
          </Field>
          <fieldset className="space-y-1">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Recordings to merge</legend>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border p-1">
              {candidates.map((m) => {
                const isCurrent = m.id === current.id;
                const unfinished = isUnfinishedRecording(m);
                const seconds = meetingDurationSeconds(m);
                return (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 transition-colors duration-100 hover:bg-accent has-[:disabled]:cursor-default">
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.has(m.id)}
                        disabled={isCurrent || busy}
                        onCheckedChange={(checked) => toggle(m.id, checked === true)}
                        aria-label={`Include ${m.title} from ${timeOf(m.startTime)}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                          <span className="truncate">{m.title || 'Untitled meeting'}</span>
                          {isCurrent && <Badge variant="secondary">This meeting</Badge>}
                          {unfinished && <Badge variant="warning">Unfinished</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {new Date(m.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {timeOf(m.startTime)}
                          {' · '}{unfinished ? 'length measured when merged' : minutesOf(seconds)}
                          {' · '}{m.transcript.length} transcript lines
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <p className="text-sm text-muted-foreground" role="status">
            {chosen.length >= 2
              ? `${chosen.length} recordings, ${span}. Unfinished recordings are finished first; phrases still waiting to be transcribed get up to a minute to finish.`
              : 'Choose at least one more recording.'}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void handleMerge()} disabled={busy || chosen.length < 2}>
            {busy && <Spinner className="size-4" />}
            <span>{busy ? 'Merging…' : `Merge ${chosen.length} meetings`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
