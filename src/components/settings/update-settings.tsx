import React, { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { PageSection } from '../ui/page';
import { Switch } from '../ui/switch';
import { SettingsRow } from './settings-row';
import {
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
    <PageSection id="section-updates" className="scroll-mt-6" title="Updates" description="Get a notice when a new release of HuskyNote is available.">
      <div>
        <SettingsRow
          htmlFor="update-check-enabled"
          label="Check for new versions"
          description="Once a day, HuskyNote asks GitHub whether a newer release exists and shows a notice if it does. Nothing from your workspace is sent. Off by default, since it is the only request the app makes to an outside server."
        >
          <Switch id="update-check-enabled" checked={enabled} onCheckedChange={toggle} />
        </SettingsRow>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={checkNow} disabled={checking}>
          <RefreshCw className={cn(checking && 'animate-spin')} />
          <span>{checking ? 'Checking...' : 'Check now'}</span>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={result?.status === 'update' ? result.url : RELEASES_PAGE_URL} target="_blank" rel="noopener noreferrer">
            Releases on GitHub <ExternalLink />
          </a>
        </Button>
      </div>
      {result && <p className="text-xs leading-relaxed text-muted-foreground">{describe(result)}</p>}
    </PageSection>
  );
};
