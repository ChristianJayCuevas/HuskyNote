import { useCallback, useEffect, useRef } from 'react';
import type { ViewType } from '@/context/workspace-context';
import { waitForTarget } from '../lib/resolve-target';
import { dispatchTour, getActiveTourSnapshot, setShownTarget, useActiveTourSnapshot } from '../state/active-tour-store';
import { markTourProgress } from '../state/tour-progress';
import type {
  ShowView,
  ShowViewOptions,
  TourDefinition,
  TourDismissReason,
  TourEndReason,
  TourStartSource,
  TourStep,
  TourStepContext,
} from '../types';

/** Default wait for a step's target. */
export const DEFAULT_TARGET_TIMEOUT_MS = 3000;
/** Wait after switching views: the new view mounts (and may load its data) before its target exists. */
export const NAVIGATION_TARGET_TIMEOUT_MS = 10_000;
/** Re-check window for `targetLost` when the step has no `timeoutMs`. */
export const TARGET_LOST_RECHECK_MS = 1500;

/** Emitted by the runner for the host. Fired once per run each. */
export type TourLifecycleEvent =
  | { type: 'started'; tourId: string; tourVersion: number; source: TourStartSource }
  | { type: 'completed'; tourId: string; tourVersion: number; stepsShown: number }
  | {
      type: 'skipped';
      tourId: string;
      tourVersion: number;
      stepIndex: number;
      stepId: string;
      reason: TourEndReason;
      stepsShown: number;
    }
  | { type: 'aborted'; tourId: string; tourVersion: number; reason: TourEndReason; stepsShown: number };

export interface UseTourRunnerOptions {
  /** The app's current main view. */
  activeView: ViewType;
  /** Switches the main view; steps reach it through `ctx.showView`. */
  showView: ShowView;
  onLifecycle?: (event: TourLifecycleEvent) => void;
}

/**
 * What the host (and `TourOverlay`) needs. All `null`/`0` while no tour is active.
 *
 * - `definition`: running tour.
 * - `step`: `definition.steps[index]`, set while `entering` AND `showing`.
 * - `index` / `total`: current 0-based index and step count.
 * - `phase`: `'entering'` (switching views / awaiting target; show nothing for the step yet) or `'showing'`.
 * - `target`: resolved Element of the SHOWN step; `null` while entering, for target-less steps,
 *   and for steps centered by the `center` missing policy.
 * - `next()` / `back()`: ignored unless `showing` (double-click safe).
 * - `dismiss(reason)`: ends as skipped.
 * - `targetLost()`: the overlay saw the shown target stop being visible. Re-resolves via
 *   `waitForTarget` (window `step.timeoutMs ?? TARGET_LOST_RECHECK_MS`). Found again -> the new
 *   element replaces `target`. Still gone -> the step's missing policy: `'center'` keeps the step
 *   with `target = null`; `'skip'` (default) moves on in the direction of travel (`next`, or `back`
 *   when travelling backward, and `next` at index 0), which ends the tour as completed after the
 *   last step. Calls while a re-check is in flight, or for target-less steps, are ignored.
 */
export interface TourRunner {
  definition: TourDefinition | null;
  step: TourStep | null;
  index: number;
  total: number;
  phase: 'entering' | 'showing' | null;
  target: Element | null;
  next: () => void;
  back: () => void;
  dismiss: (reason: TourDismissReason) => void;
  targetLost: () => void;
}

interface ShownStep {
  runId: number;
  index: number;
  definition: TourDefinition;
  controller: AbortController;
}

/**
 * Host-only: runs the active tour's side effects (`beforeEnter` and the view it opens, target
 * wait, `onExit`, persistence, callbacks, lifecycle) and feeds results to the reducer. Mount
 * exactly once.
 *
 * Stale results: each `entering` pass owns one AbortController, aborted on cleanup; results are
 * dispatched only while `!signal.aborted`, so a late result of an ended/replaced pass is dropped
 * even when a restarted run lands on the same index.
 */
export function useTourRunner({ activeView, showView, onLifecycle }: UseTourRunnerOptions): TourRunner {
  const { definition, source, runId, machine, target } = useActiveTourSnapshot();

  const activeViewRef = useRef(activeView);
  const showViewRef = useRef(showView);
  const onLifecycleRef = useRef(onLifecycle);
  /** View the engine's own switch is heading to; reaching it is not "the user left". */
  const expectedViewRef = useRef<ViewType | null>(null);
  /** The last switch requested, so an effect replay (StrictMode) does not switch twice. */
  const lastRequestRef = useRef<string | null>(null);
  const viewWaitersRef = useRef(new Set<(view: ViewType) => void>());
  const prevViewRef = useRef(activeView);
  const shownRef = useRef<ShownStep | null>(null);
  const startedRunRef = useRef(0);
  const endedRunRef = useRef(0);
  const lostCheckRef = useRef<AbortController | null>(null);

  // Declared first so every other effect in a commit sees the latest values.
  useEffect(() => {
    activeViewRef.current = activeView;
    showViewRef.current = showView;
    onLifecycleRef.current = onLifecycle;
  });

  const emit = useCallback((event: TourLifecycleEvent) => {
    try {
      onLifecycleRef.current?.(event);
    } catch (error) {
      console.error('[guided-tour] onLifecycle threw', error);
    }
  }, []);

  /** Asks the app for a view. Same view with no options: nothing to do (no extra history entry). */
  const requestView = useCallback((view: ViewType, options?: ShowViewOptions) => {
    const switching = view !== activeViewRef.current;
    if (!switching && !options) return;
    const request = JSON.stringify([view, options ?? null]);
    // An effect replay (StrictMode) must not switch twice while the first switch is on its way.
    if (switching && expectedViewRef.current === view && lastRequestRef.current === request) return;
    if (switching) expectedViewRef.current = view;
    lastRequestRef.current = request;
    showViewRef.current(view, options);
  }, []);

  /** Resolves true once the app shows `view`; false on abort/timeout. */
  const waitForView = useCallback(
    (view: ViewType, signal: AbortSignal, timeoutMs: number) =>
      new Promise<boolean>((resolve) => {
        if (signal.aborted) return resolve(false);
        if (activeViewRef.current === view) return resolve(true);
        const waiters = viewWaitersRef.current;
        const finish = (ok: boolean) => {
          waiters.delete(waiter);
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          resolve(ok);
        };
        const waiter = (current: ViewType) => {
          if (current === view) finish(true);
        };
        const onAbort = () => finish(false);
        const timer = setTimeout(() => finish(false), timeoutMs);
        waiters.add(waiter);
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    []
  );

  // A view change the engine did not ask for while a step is showing: the user left the tour.
  useEffect(() => {
    if (prevViewRef.current === activeView) return;
    prevViewRef.current = activeView;
    for (const waiter of [...viewWaitersRef.current]) waiter(activeView);
    if (expectedViewRef.current !== null && activeView === expectedViewRef.current) {
      expectedViewRef.current = null;
      return;
    }
    const { machine: current } = getActiveTourSnapshot();
    if (current.status === 'active' && current.phase === 'showing') {
      dispatchTour({ type: 'end', reason: 'navigation' });
    }
  }, [activeView]);

  // `started` lifecycle, once per run.
  useEffect(() => {
    if (!definition || startedRunRef.current === runId) return;
    startedRunRef.current = runId;
    emit({ type: 'started', tourId: definition.id, tourVersion: definition.version, source });
  }, [definition, runId, source, emit]);

  // One pass per `entering` step: beforeEnter (and the view it opens) -> target -> ready/missing.
  const enteringIndex = machine.status === 'active' && machine.phase === 'entering' ? machine.index : null;
  useEffect(() => {
    if (enteringIndex === null || !definition) return;
    const step = definition.steps[enteringIndex];
    if (!step) return;
    const index = enteringIndex;
    const controller = new AbortController();
    const { signal } = controller;
    let requestedView: ViewType | null = null;

    const ctx: TourStepContext = {
      tourId: definition.id,
      stepId: step.id,
      index,
      signal,
      showView: (view, options) => {
        requestedView = view;
        requestView(view, options);
      },
    };
    const missing = () => {
      if (signal.aborted) return;
      dispatchTour({ type: 'step-missing', index, policy: step.onMissing ?? 'skip' });
    };

    void (async () => {
      if (step.showIf && !step.showIf()) {
        dispatchTour({ type: 'step-missing', index, policy: 'skip' });
        return;
      }

      if (step.beforeEnter) {
        try {
          await step.beforeEnter(ctx);
        } catch (error) {
          console.error(`[guided-tour] beforeEnter of step "${step.id}" threw`, error);
          missing();
          return;
        }
        if (signal.aborted) return;
      }

      // Show nothing for the step until its view is open: a target that also exists on the
      // old view (the sidebar, the top bar) must not resolve early.
      if (requestedView !== null) {
        const arrived = await waitForView(requestedView, signal, step.timeoutMs ?? NAVIGATION_TARGET_TIMEOUT_MS);
        if (signal.aborted) return;
        if (!arrived) {
          console.warn(`[guided-tour] step "${step.id}": view "${requestedView}" did not open in time`);
          missing();
          return;
        }
      }

      if (!step.target) {
        dispatchTour({ type: 'step-ready', index });
        return;
      }

      const timeoutMs = step.timeoutMs ?? (requestedView !== null ? NAVIGATION_TARGET_TIMEOUT_MS : DEFAULT_TARGET_TIMEOUT_MS);
      const element = await waitForTarget(step.target, { timeoutMs, signal });
      if (signal.aborted) return;
      if (element) {
        dispatchTour({ type: 'step-ready', index }, element);
      } else {
        console.warn(`[guided-tour] step "${step.id}": target not found after ${timeoutMs}ms`);
        missing();
      }
    })();

    return () => controller.abort();
  }, [definition, runId, enteringIndex, requestView, waitForView]);

  // `onExit` exactly once when a shown step is left (next/back/skip-missing/end).
  useEffect(() => {
    const showingIndex = machine.status === 'active' && machine.phase === 'showing' ? machine.index : null;
    const shown = shownRef.current;
    if (shown && (shown.runId !== runId || shown.index !== showingIndex)) {
      shownRef.current = null;
      const step = shown.definition.steps[shown.index];
      try {
        step?.onExit?.({
          tourId: shown.definition.id,
          stepId: step.id,
          index: shown.index,
          signal: shown.controller.signal,
          showView: requestView,
        });
      } catch (error) {
        console.error(`[guided-tour] onExit of step "${step?.id}" threw`, error);
      }
      shown.controller.abort();
    }
    if (showingIndex !== null && definition && !shownRef.current) {
      shownRef.current = { runId, index: showingIndex, definition, controller: new AbortController() };
    }
  }, [machine, runId, definition, requestView]);

  // Wrap-up: persist, definition callback, lifecycle, then `reset` so the next start is allowed.
  useEffect(() => {
    if (machine.status !== 'ended' || !definition || endedRunRef.current === runId) return;
    endedRunRef.current = runId;
    expectedViewRef.current = null;
    lastRequestRef.current = null;
    const { outcome, reason, index, shownCount } = machine;
    const base = { tourId: definition.id, tourVersion: definition.version };

    // Only the definition callback is guarded here; `emit` guards itself, so a throwing
    // onComplete/onSkip never drops the lifecycle event.
    const runCallback = (callback: () => void) => {
      try {
        callback();
      } catch (error) {
        console.error('[guided-tour] tour callback threw', error);
      }
    };
    if (outcome === 'completed') {
      markTourProgress(definition.id, definition.version, 'completed');
      runCallback(() => definition.onComplete?.());
      emit({ type: 'completed', ...base, stepsShown: shownCount });
    } else if (outcome === 'skipped') {
      const stepId = definition.steps[index]?.id ?? '';
      markTourProgress(definition.id, definition.version, 'skipped');
      runCallback(() => definition.onSkip?.({ index, stepId, reason }));
      emit({ type: 'skipped', ...base, stepIndex: index, stepId, reason, stepsShown: shownCount });
    } else {
      emit({ type: 'aborted', ...base, reason, stepsShown: shownCount });
    }
    dispatchTour({ type: 'reset' });
  }, [machine, definition, runId, emit]);

  // A re-check in flight belongs to the step it started on.
  const stepKey = machine.status === 'active' ? `${runId}:${machine.index}:${machine.phase}` : 'none';
  useEffect(
    () => () => {
      lostCheckRef.current?.abort();
      lostCheckRef.current = null;
    },
    [stepKey]
  );

  const next = useCallback(() => dispatchTour({ type: 'next' }), []);
  const back = useCallback(() => dispatchTour({ type: 'back' }), []);
  const dismiss = useCallback((reason: TourDismissReason) => dispatchTour({ type: 'end', reason }), []);

  const targetLost = useCallback(() => {
    const started = getActiveTourSnapshot();
    const { machine: current, definition: running, target: shownTarget } = started;
    if (current.status !== 'active' || current.phase !== 'showing' || !running || !shownTarget) return;
    const index = current.index;
    const step = running.steps[index];
    if (!step?.target || lostCheckRef.current) return;

    const controller = new AbortController();
    lostCheckRef.current = controller;
    void waitForTarget(step.target, {
      timeoutMs: step.timeoutMs ?? TARGET_LOST_RECHECK_MS,
      signal: controller.signal,
    }).then((element) => {
      if (lostCheckRef.current === controller) lostCheckRef.current = null;
      if (controller.signal.aborted) return;
      const now = getActiveTourSnapshot();
      if (
        now.runId !== started.runId ||
        now.machine.status !== 'active' ||
        now.machine.phase !== 'showing' ||
        now.machine.index !== index
      ) {
        return;
      }
      if (element) return setShownTarget(element);
      if (step.onMissing === 'center') return setShownTarget(null);
      // Skip in the direction of travel; at index 0 there is nothing behind us.
      dispatchTour({ type: now.machine.direction === -1 && index > 0 ? 'back' : 'next' });
    });
  }, []);

  const active = machine.status === 'active' ? machine : null;
  return {
    definition: active ? definition : null,
    step: active && definition ? (definition.steps[active.index] ?? null) : null,
    index: active?.index ?? 0,
    total: active?.stepCount ?? 0,
    phase: active?.phase ?? null,
    target,
    next,
    back,
    dismiss,
    targetLost,
  };
}
