import { startTour, stopTour, useActiveTourSnapshot } from '../state/active-tour-store';

export interface UseTourResult {
  /** `start(idOrDefinition, { source })`: `false` when a tour is active/ending or the id is unknown. */
  start: typeof startTour;
  /** `stop(reason)`: ends the active tour as a dismissal (default `'skip-button'`). */
  stop: typeof stopTour;
  /** Id of the running tour; `null` when none (or while it is being wrapped up). */
  activeTourId: string | null;
  isActive: boolean;
}

/**
 * Public tour API for components. Flag-agnostic: gate the callers, not the engine.
 * `startTour`/`stopTour` are also exported directly for non-React callers.
 */
export function useTour(): UseTourResult {
  const { machine } = useActiveTourSnapshot();
  const isActive = machine.status === 'active';
  return { start: startTour, stop: stopTour, activeTourId: isActive ? machine.tourId : null, isActive };
}
