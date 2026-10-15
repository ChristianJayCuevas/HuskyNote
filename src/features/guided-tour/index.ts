/**
 * Public API of the guided-tour feature. `TourHost` is deliberately absent: it is mounted once in
 * `src/App.tsx` (import it from `./components/tour-host`). Store/runner internals
 * (`dispatchTour`, `setShownTarget`, `useTourRunner`, ...) stay private.
 */
export { startTour } from './state/active-tour-store';
export { startTourAfterDialogs } from './lib/start-after-dialogs';
export { useTour, type UseTourResult } from './hooks/use-tour';
export { TourTrigger, type TourTriggerProps } from './components/tour-trigger';
export { TourAutoStart, useTourAutoStart, type UseTourAutoStartOptions } from './hooks/use-tour-auto-start';
export { resetTourProgress } from './state/tour-progress';
export type { TourId } from './tours/registry';
export type {
  TourDefinition,
  TourDismissReason,
  TourEndReason,
  TourOutcome,
  TourPlacement,
  TourStartSource,
  TourStep,
  TourStepContext,
  TourTarget,
} from './types';
