import { useEffect, useRef } from 'react';
import { getActiveTourSnapshot, startTour } from '../state/active-tour-store';
import { useTourProgress } from '../state/tour-progress';
import { getTour, type TourId } from '../tours/registry';

/** Re-check cadence while a modal dialog is open or another tour is running. */
export const AUTO_START_RECHECK_MS = 500;
/** Give up (until the next mount) after this long. */
export const AUTO_START_GIVE_UP_MS = 10_000;

export interface UseTourAutoStartOptions {
  /** Consumer-owned gate (e.g. a fresh workspace on the local app). The engine itself is never gated. */
  enabled: boolean;
}

/** Open modal UI the tour must not cover: Radix dialogs, alert dialogs and sheets, or a native dialog. */
const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], dialog[open]';

function isBlocked(): boolean {
  return document.querySelector(OPEN_DIALOG) !== null || getActiveTourSnapshot().machine.status !== 'idle';
}

/**
 * Starts `tourId` once per mount with `source: 'auto'` when the tour was never completed or skipped
 * on this device. Waits while a dialog is open or a tour is running (re-checks every 500ms,
 * gives up after 10s). Never runs on the server or before progress is readable (`undefined`).
 */
export function useTourAutoStart(tourId: TourId, { enabled }: UseTourAutoStartOptions): void {
  const progress = useTourProgress(tourId, getTour(tourId)?.version ?? 1);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || progress !== null || startedRef.current) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let waitedMs = 0;
    const attempt = () => {
      if (isBlocked()) {
        if (waitedMs >= AUTO_START_GIVE_UP_MS) return;
        waitedMs += AUTO_START_RECHECK_MS;
        timer = setTimeout(attempt, AUTO_START_RECHECK_MS);
        return;
      }
      startedRef.current = true;
      startTour(tourId, { source: 'auto' });
    };
    attempt();
    return () => clearTimeout(timer);
  }, [enabled, progress, tourId]);
}

/** Renders nothing; place under whatever provider supplies `enabled`. */
export function TourAutoStart({ tourId, enabled = true }: { tourId: TourId; enabled?: boolean }): null {
  useTourAutoStart(tourId, { enabled });
  return null;
}
