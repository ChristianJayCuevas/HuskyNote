/**
 * Exports: useSpeechStatus, SpeechStatusIndicator
 *
 * Bottom-left card for the on-device speech model download and transcription errors
 * (rendered once by AppLayout).
 */
import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import { speechStatus, type SpeechEngineStatus } from '../../services/audio/speech-engine';
import { Button } from './button';

export function useSpeechStatus(): SpeechEngineStatus {
  const [status, setStatus] = useState<SpeechEngineStatus>(speechStatus.get());
  useEffect(() => speechStatus.subscribe(setStatus), []);
  return status;
}

const cardClass =
  'fixed bottom-4 left-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover px-3.5 py-3 text-sm text-popover-foreground shadow-lg';

/**
 * Shows the on-device speech model download and transcription errors,
 * wherever transcription was started from.
 */
export const SpeechStatusIndicator: React.FC = () => {
  const status = useSpeechStatus();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  if (status.state === 'loading') {
    const downloading = status.progress !== undefined && status.progress < 100;
    const progress = status.progress ?? 0;
    return (
      <div role="status" className={cardClass}>
        <div className="flex items-center gap-2 font-medium">
          <Download className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {downloading
              ? `Downloading ${status.engineName ?? 'speech model'} ${progress}%`
              : `Starting ${status.engineName ?? 'the speech model'}...`}
          </span>
        </div>
        <p className="mt-1 text-xs leading-normal text-muted-foreground">
          {downloading
            ? 'One-time download. Transcription then runs entirely on this device.'
            : 'Preparing local recognition. Recording status is shown separately.'}
        </p>
        {downloading && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-foreground transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (status.state === 'error' && status.message && status.message !== dismissedMessage) {
    return (
      <div className={`${cardClass} flex items-start gap-2.5`}>
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 leading-normal">
          <div className="font-medium">Transcription problem</div>
          <div className="mt-0.5 break-words text-xs text-muted-foreground">{status.message}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissedMessage(status.message ?? null)}
          className="-mr-1.5 -mt-1 text-muted-foreground"
          aria-label="Dismiss transcription error"
        >
          <X />
        </Button>
      </div>
    );
  }

  return null;
};
