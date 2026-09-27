import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, ExternalLink, X } from 'lucide-react';
import { checkForUpdate, dismissUpdate, isUpdateDismissed, type UpdateCheckResult } from '../../services/updates/update-checker';

/** Slim bar under the topbar when update checks are on and a newer release exists. */
export const UpdateBanner: React.FC = () => {
  const [update, setUpdate] = useState<Extract<UpdateCheckResult, { status: 'update' }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Does nothing unless the user turned update checks on in Settings
    checkForUpdate().then((result) => {
      if (!cancelled && result?.status === 'update' && !isUpdateDismissed(result.version)) setUpdate(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  return (
    <div className="shrink-0 flex items-center gap-3 pl-4 pr-16 py-2 border-b text-xs bg-slate-50 border-slate-200 text-slate-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
      <ArrowUpCircle className="w-4 h-4 shrink-0 text-slate-600 dark:text-zinc-400" />
      <span className="flex-1 min-w-0 truncate">
        HuskyNote <strong>v{update.version}</strong> is available.
      </span>
      <a
        href={update.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
      >
        View release <ExternalLink className="w-3 h-3" />
      </a>
      <button
        type="button"
        onClick={() => {
          dismissUpdate(update.version);
          setUpdate(null);
        }}
        className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
        title="Dismiss until the next release"
        aria-label="Dismiss update notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
