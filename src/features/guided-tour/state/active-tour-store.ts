import { useSyncExternalStore } from 'react';
import { getTour, isValidTourIdentity, type TourId } from '../tours/registry';
import type { TourDefinition, TourDismissReason, TourStartSource } from '../types';
import { INITIAL_TOUR_STATE, tourReducer, type TourMachineAction, type TourMachineState } from './tour-machine';

/**
 * ACTIVE TOUR STORE — module store (`useSyncExternalStore`), not context, so `startTour` is
 * callable from anywhere (event handlers, outside FeatureFlag/AppShell boundaries). The one
 * global `TourHost` runs `useTourRunner`, which performs side effects and dispatches here.
 *
 * `target` (the resolved Element of the shown step) lives in the snapshot so "phase became
 * showing" and "its target" always commit in the same render; it is `null` for centered /
 * target-less steps and whenever the step is not `showing`.
 */

export interface ActiveTourSnapshot {
  definition: TourDefinition | null;
  source: TourStartSource;
  /** Incremented on every successful start; distinguishes runs that reuse step indexes. */
  runId: number;
  machine: TourMachineState;
  target: Element | null;
}

const IDLE_SNAPSHOT: ActiveTourSnapshot = {
  definition: null,
  source: 'manual',
  runId: 0,
  machine: INITIAL_TOUR_STATE,
  target: null,
};

let snapshot: ActiveTourSnapshot = IDLE_SNAPSHOT;
const listeners = new Set<() => void>();

function setSnapshot(next: ActiveTourSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveTourSnapshot(): ActiveTourSnapshot {
  return snapshot;
}

export function useActiveTourSnapshot(): ActiveTourSnapshot {
  return useSyncExternalStore(subscribe, getActiveTourSnapshot, () => IDLE_SNAPSHOT);
}

/**
 * Runs the reducer. `target` is applied only when the action actually moved the machine into
 * `showing` (a stale/ignored `step-ready` therefore never leaks its element). Any transition
 * out of `showing` clears the target.
 */
export function dispatchTour(action: TourMachineAction, target: Element | null = null): void {
  const prev = snapshot;
  const machine = tourReducer(prev.machine, action);
  if (machine === prev.machine) return;
  const showing = machine.status === 'active' && machine.phase === 'showing';
  const nextTarget = !showing ? null : action.type === 'step-ready' ? target : prev.target;
  setSnapshot({
    ...prev,
    machine,
    target: nextTarget,
    // `reset` returns to idle, dropping the finished run's definition.
    definition: machine.status === 'idle' ? null : prev.definition,
  });
}

/** Swap the element of the currently shown step (re-resolved or lost); no-op unless `showing`. */
export function setShownTarget(target: Element | null): void {
  const { machine } = snapshot;
  if (machine.status !== 'active' || machine.phase !== 'showing') return;
  if (snapshot.target === target) return;
  setSnapshot({ ...snapshot, target });
}

/**
 * Starts a tour by registry id or inline definition. Returns `false` (no-op) when a tour is
 * `active` OR `ended` (the runner's end effects — persist, callbacks, `reset` — must run first),
 * when the id is unknown, or when id/version are invalid.
 */
export function startTour(
  idOrDefinition: TourId | TourDefinition,
  options: { source?: TourStartSource } = {}
): boolean {
  if (snapshot.machine.status !== 'idle') return false;

  let definition: TourDefinition | undefined;
  if (typeof idOrDefinition === 'string') {
    definition = getTour(idOrDefinition);
    if (!definition) {
      console.error(`[guided-tour] unknown tour id "${idOrDefinition}"`);
      return false;
    }
  } else {
    definition = idOrDefinition;
  }
  if (!isValidTourIdentity(definition.id, definition.version)) return false;

  const machine = tourReducer(snapshot.machine, {
    type: 'start',
    tourId: definition.id,
    stepCount: definition.steps.length,
  });
  setSnapshot({
    definition,
    source: options.source ?? 'manual',
    runId: snapshot.runId + 1,
    machine,
    target: null,
  });
  return true;
}

/** Ends the active tour as a dismissal (default: the Skip button). No-op when none is active. */
export function stopTour(reason: TourDismissReason = 'skip-button'): void {
  dispatchTour({ type: 'end', reason });
}

/** Test-only: forget module state between tests. */
export function resetActiveTourForTests(): void {
  setSnapshot({ ...IDLE_SNAPSHOT, runId: snapshot.runId });
}
