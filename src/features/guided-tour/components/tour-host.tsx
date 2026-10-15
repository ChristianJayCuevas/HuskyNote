import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ViewType } from '@/context/workspace-context';
import { useTourRunner, type TourLifecycleEvent } from '../hooks/use-tour-runner';
import { isTargetVisible } from '../lib/resolve-target';
import type { ShowView } from '../types';
import { TourOverlay } from './tour-overlay';

/** The one `TourHost` instance that runs the engine; later ones render nothing. */
let hostOwner: object | null = null;
const hostListeners = new Set<() => void>();

function setHostOwner(next: object | null) {
  hostOwner = next;
  for (const listener of hostListeners) listener();
}

function subscribeHostOwner(listener: () => void) {
  hostListeners.add(listener);
  return () => {
    hostListeners.delete(listener);
  };
}

/** HuskyNote collects no usage data: tour events are only logged while developing. */
function reportLifecycle(event: TourLifecycleEvent): void {
  if (import.meta.env.DEV && event.type === 'aborted') {
    console.info(`[guided-tour] tour "${event.tourId}" aborted (${event.reason}) after ${event.stepsShown} step(s)`);
  }
}

/**
 * Focus fallback for tours that end on another view. The focus trap returns focus to the element
 * focused at start, but when that trigger is gone (its menu closed, its view unmounted),
 * `focus()` silently fails and focus falls to `<body>`. Land on the visible `<main>` instead
 * (tabindex -1 only for as long as it holds focus).
 */
function focusMainLandmark(): void {
  const main = Array.from(document.querySelectorAll('main')).find(isTargetVisible);
  if (!main) return;
  if (!main.hasAttribute('tabindex')) {
    main.setAttribute('tabindex', '-1');
    main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
  }
  main.focus({ preventScroll: true });
}

export interface TourHostProps {
  /** The app's current main view. */
  activeView: ViewType;
  /** Opens a view for a step (see `showAppView`). */
  showView: ShowView;
}

function ActiveTourHost({ activeView, showView }: TourHostProps) {
  const runner = useTourRunner({ activeView, showView, onLifecycle: reportLifecycle });
  const { step, phase } = runner;
  const running = phase !== null && step !== null;

  // Steps this screen skips (`showIf`, such as the sidebar on phones) are left out of
  // "Step n of m" and the dots, so the count doesn't jump
  const counted = runner.definition?.steps.filter((s) => !s.showIf || s.showIf()) ?? [];
  const position = step ? counted.indexOf(step) : -1;
  const index = position >= 0 ? position : runner.index;
  const total = position >= 0 ? counted.length : runner.total;

  // Element focused when the tour began. A layout effect runs before the overlay's focus trap
  // (a passive effect) moves focus into the tour.
  const startFocusRef = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (running) startFocusRef.current = document.activeElement;
  }, [running]);

  // Runs after the overlay unmounted, i.e. after the trap's attempt to return focus.
  useEffect(() => {
    if (running) return;
    const origin = startFocusRef.current;
    startFocusRef.current = null;
    if (!(origin instanceof HTMLElement) || origin === document.body) return;
    if (isTargetVisible(origin)) return; // the trap restored it
    const focused = document.activeElement;
    if (focused && focused !== document.body) return; // focus already landed somewhere real
    focusMainLandmark();
  }, [running]);

  // Never keyed by step/index: a remount would re-capture a tour button as the trigger.
  return running ? (
    <TourOverlay
      step={step}
      index={index}
      total={total}
      target={runner.target}
      phase={phase}
      onNext={runner.next}
      onBack={runner.back}
      onDismiss={runner.dismiss}
      onTargetLost={runner.targetLost}
    />
  ) : null;
}

/**
 * The one global tour runner + overlay. Mount once near the app root, inside the language
 * provider, and never conditionally: a finished run stays "busy" until a host wraps it up.
 * A second mounted host warns in dev and renders nothing.
 */
export function TourHost(props: TourHostProps) {
  const [token] = useState(() => ({}));
  const primary = useSyncExternalStore(subscribeHostOwner, () => hostOwner === token, () => false);

  useEffect(() => {
    if (hostOwner !== null) {
      if (import.meta.env.DEV) {
        console.warn('[guided-tour] a second <TourHost /> is mounted; only one is allowed, ignoring it');
      }
      return;
    }
    setHostOwner(token);
    return () => {
      if (hostOwner === token) setHostOwner(null);
    };
  }, [token]);

  return primary ? <ActiveTourHost {...props} /> : null;
}
