import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import {
  cancelRecordingImport, clearRecordingImport, getRecordingImport, subscribeRecordingImport, type RecordingImportState,
} from '../../services/meetings/meeting-import';

const PHASE_LABEL: Record<RecordingImportState['phase'], string> = {
  reading: 'Reading the audio',
  'loading-model': 'Loading the speech model',
  transcribing: 'Transcribing',
  done: 'Transcribed',
  cancelled: 'Import stopped',
  error: 'Import failed',
};

/** Progress of a recording being transcribed in the background */
export const ImportProgress: React.FC<{ onOpen: (meetingId: string) => void }> = ({ onOpen }) => {
  const [job, setJob] = useState<RecordingImportState | null>(getRecordingImport());
  useEffect(() => subscribeRecordingImport(setJob), []);
  if (!job) return null;

  const running = ['reading', 'loading-model', 'transcribing'].includes(job.phase);
  const percent = Math.round(job.fraction * 100);
  const detail = job.phase === 'transcribing'
    ? `${formatSecondsToTime(job.processedSeconds)} of ${formatSecondsToTime(job.totalSeconds)} · ${job.lines} lines`
    : job.phase === 'reading' ? `${percent}%`
    : job.phase === 'cancelled' ? (job.lines ? `The first ${formatSecondsToTime(job.processedSeconds)} were saved.` : 'Nothing was saved.')
    : job.phase === 'error' ? job.error
    : job.phase === 'done' ? `${job.lines} lines` : '';

  return (
    <div className="mx-3 mb-2 rounded-lg border bg-card p-3" role="status" aria-live="off">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
          <p className={job.phase === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            {PHASE_LABEL[job.phase]}{detail ? ` · ${detail}` : ''}
          </p>
        </div>
        {running ? (
          <Button size="xs" variant="ghost" onClick={cancelRecordingImport}>Stop</Button>
        ) : (
          <div className="flex shrink-0 gap-1">
            {job.meetingId && job.lines > 0 && <Button size="xs" variant="ghost" onClick={() => onOpen(job.meetingId!)}>Open</Button>}
            <Button size="xs" variant="ghost" onClick={clearRecordingImport}>Dismiss</Button>
          </div>
        )}
      </div>
      {running && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${job.phase === 'loading-model' ? 100 : percent}%` }} />
        </div>
      )}
    </div>
  );
};
