import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, ExternalLink, X } from 'lucide-react';
import { checkForUpdate, dismissUpdate, isUpdateDismissed, type UpdateCheckResult } from '../../services/updates/update-checker';
import { Button } from '../ui/button';

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
    <div role="status" className="flex shrink-0 items-center gap-3 border-b bg-muted px-4 py-2 text-sm">
      <ArrowUpCircle className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        HuskyNote <strong className="font-semibold">v{update.version}</strong> is available.
      </span>
      <Button asChild variant="outline" size="xs">
        <a href={update.url} target="_blank" rel="noopener noreferrer">
          View release <ExternalLink />
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          dismissUpdate(update.version);
          setUpdate(null);
        }}
        className="text-muted-foreground"
        title="Dismiss until the next release"
        aria-label="Dismiss update notice"
      >
        <X />
      </Button>
    </div>
  );
};
