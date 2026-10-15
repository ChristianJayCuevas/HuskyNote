import type { TourDismissReason, TourEndReason, TourOutcome } from '../types';

/**
 * Pure tour state machine. No React, no DOM, no timers: the runner performs
 * side effects (navigation, target waiting) and feeds results back as actions.
 *
 * Race protection: `next`/`back` are ignored unless the step is `showing`, and
 * `step-ready`/`step-missing` are ignored unless their `index` matches the
 * `entering` step, so double-clicks and late async results are harmless.
 */

export type TourMachineState =
  | { status: 'idle' }
  | {
      status: 'active';
      tourId: string;
      stepCount: number;
      index: number;
      direction: 1 | -1;
      phase: 'entering' | 'showing';
      /** Steps actually displayed so far (center + ready both count). */
      shownCount: number;
    }
  | {
      status: 'ended';
      tourId: string;
      index: number;
      outcome: TourOutcome;
      reason: TourEndReason;
      shownCount: number;
    };

export type TourMachineAction =
  | { type: 'start'; tourId: string; stepCount: number; startIndex?: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'step-ready'; index: number }
  | { type: 'step-missing'; index: number; policy: 'skip' | 'center' }
  | { type: 'end'; reason: TourDismissReason | 'navigation' | 'error' }
  | { type: 'reset' };

export const INITIAL_TOUR_STATE: TourMachineState = { status: 'idle' };

export function outcomeForReason(reason: TourEndReason): TourOutcome {
  switch (reason) {
    case 'done':
      return 'completed';
    case 'skip-button':
    case 'close-button':
    case 'escape':
    case 'backdrop':
      return 'skipped';
    case 'navigation':
    case 'error':
    case 'no-targets':
      return 'aborted';
  }
}

type ActiveState = Extract<TourMachineState, { status: 'active' }>;

function endTour(state: ActiveState, reason: TourEndReason): TourMachineState {
  return {
    status: 'ended',
    tourId: state.tourId,
    index: state.index,
    outcome: outcomeForReason(reason),
    reason,
    shownCount: state.shownCount,
  };
}

/** Ran off either end of the step list while skipping missing targets. */
function endPastBounds(state: ActiveState): TourMachineState {
  // Edge case: if anything was shown the user saw the tour, so it counts as
  // completed; otherwise every target was missing and the tour aborts.
  return endTour(state, state.shownCount > 0 ? 'done' : 'no-targets');
}

function skipMissingStep(state: ActiveState): TourMachineState {
  const next = state.index + state.direction;
  if (next >= state.stepCount) return endPastBounds(state);
  if (next < 0) {
    // Edge case: skipping backward past the first step flips direction and
    // lands on index 1 (the step the user came back from). If the tour has no
    // index 1, treat it like running past the end.
    if (state.stepCount < 2) return endPastBounds(state);
    return { ...state, index: 1, direction: 1, phase: 'entering' };
  }
  return { ...state, index: next, phase: 'entering' };
}

export function tourReducer(state: TourMachineState, action: TourMachineAction): TourMachineState {
  switch (action.type) {
    case 'start': {
      if (state.status === 'active') return state;
      const { tourId, stepCount } = action;
      // Edge case: non-integer / non-positive stepCount is treated as empty.
      if (!Number.isInteger(stepCount) || stepCount <= 0) {
        return {
          status: 'ended',
          tourId,
          index: 0,
          outcome: 'aborted',
          reason: 'no-targets',
          shownCount: 0,
        };
      }
      // Edge case: an invalid/out-of-range startIndex falls back to 0.
      const startIndex = action.startIndex;
      const index =
        startIndex !== undefined && Number.isInteger(startIndex) && startIndex >= 0 && startIndex < stepCount
          ? startIndex
          : 0;
      return {
        status: 'active',
        tourId,
        stepCount,
        index,
        direction: 1,
        phase: 'entering',
        shownCount: 0,
      };
    }

    case 'next': {
      if (state.status !== 'active' || state.phase !== 'showing') return state;
      if (state.index >= state.stepCount - 1) return endTour(state, 'done');
      return {
        ...state,
        index: state.index + 1,
        direction: 1,
        phase: 'entering',
      };
    }

    case 'back': {
      if (state.status !== 'active' || state.phase !== 'showing') return state;
      if (state.index <= 0) return state;
      return {
        ...state,
        index: state.index - 1,
        direction: -1,
        phase: 'entering',
      };
    }

    case 'step-ready': {
      if (state.status !== 'active' || state.phase !== 'entering') return state;
      if (action.index !== state.index) return state;
      return { ...state, phase: 'showing', shownCount: state.shownCount + 1 };
    }

    case 'step-missing': {
      if (state.status !== 'active' || state.phase !== 'entering') return state;
      if (action.index !== state.index) return state;
      if (action.policy === 'center') {
        return {
          ...state,
          phase: 'showing',
          shownCount: state.shownCount + 1,
        };
      }
      return skipMissingStep(state);
    }

    case 'end': {
      if (state.status !== 'active') return state;
      return endTour(state, action.reason);
    }

    case 'reset':
      return INITIAL_TOUR_STATE;
  }
}
