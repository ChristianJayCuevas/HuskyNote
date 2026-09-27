import React, { useState } from 'react';
import { ArrowUpCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  APP_VERSION,
  RELEASES_PAGE_URL,
  checkForUpdate,
  getLastUpdateResult,
  isUpdateCheckEnabled,
  setUpdateCheckEnabled,
  type UpdateCheckResult,
} from '../../services/updates/update-checker';

function describe(result: UpdateCheckResult): string {
  const when = new Date(result.checkedAt).toLocaleString();
  if (result.status === 'update') return `Version ${result.version} is available (checked ${when}).`;
  if (result.status === 'current') return `You have the latest version (checked ${when}).`;
  return `${result.reason} (checked ${when})`;
}

/** Opt-in check for new HuskyNote releases on GitHub. */
export const UpdateSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(isUpdateCheckEnabled);
  const [result, setResult] = useState<UpdateCheckResult | null>(getLastUpdateResult);
  const [checking, setChecking] = useState(false);

  const toggle = () => {
    setUpdateCheckEnabled(!enabled);
    setEnabled(!enabled);
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      setResult(await checkForUpdate({ force: true }));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      id="section-updates"
      className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-4 scroll-mt-6 transition-colors duration-500"
    >
      <div className="flex items-center gap-2.5">
        <ArrowUpCircle className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
        <div>
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Updates</h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">You are on HuskyNote v{APP_VERSION}.</p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggle}
          className="mt-0.5 w-4 h-4 accent-slate-900 dark:accent-white"
        />
        <span>
          <span className="block text-xs font-semibold text-slate-900 dark:text-zinc-100">Check for new versions</span>
          <span className="block mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">
            Once a day, HuskyNote asks GitHub whether a newer release exists and shows a notice if it does. Nothing from
            your workspace is sent. Off by default, since it is the only request the app makes to an outside server.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={checkNow} disabled={checking}>
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Checking...' : 'Check now'}</span>
        </Button>
        <a
          href={result?.status === 'update' ? result.url : RELEASES_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white underline-offset-2 hover:underline"
        >
          Releases on GitHub <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {result && <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">{describe(result)}</p>}
    </div>
  );
};
