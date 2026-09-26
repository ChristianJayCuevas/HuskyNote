import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import { speechStatus, type SpeechEngineStatus } from '../../services/audio/whisper-engine';

export function useSpeechStatus(): SpeechEngineStatus {
  const [status, setStatus] = useState<SpeechEngineStatus>(speechStatus.get());
  useEffect(() => speechStatus.subscribe(setStatus), []);
  return status;
}

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
      <div className="fixed bottom-4 left-4 z-50 w-72 px-3.5 py-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl text-xs text-slate-800 dark:text-zinc-200">
        <div className="flex items-center gap-2 font-medium">
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{downloading ? `Downloading speech model ${progress}%` : 'Starting the speech model...'}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500 leading-normal">
          {downloading
            ? 'One-time download. Transcription then runs entirely on this device.'
            : 'Audio is being captured and will be transcribed in a moment.'}
        </p>
        {downloading && (
          <div className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-slate-900 dark:bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (status.state === 'error' && status.message && status.message !== dismissedMessage) {
    return (
      <div className="fixed bottom-4 left-4 z-50 w-72 flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl text-xs text-slate-800 dark:text-zinc-200">
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 leading-normal">
          <div className="font-medium">Transcription problem</div>
          <div className="text-slate-500 dark:text-zinc-400 mt-0.5 break-words">{status.message}</div>
        </div>
        <button
          onClick={() => setDismissedMessage(status.message ?? null)}
          className="text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 p-0.5 rounded transition-colors"
          aria-label="Dismiss transcription error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return null;
};
