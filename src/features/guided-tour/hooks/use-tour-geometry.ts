import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import {
  TOUR_LAYOUT,
  computeCardPlacement,
  isRectInViewport,
  spotlightRect,
  type CardPlacement,
  type PlacementSide,
  type Rect,
  type Viewport,
} from '../lib/placement';
import { isTargetVisible } from '../lib/resolve-target';

type Geometry = { key: string; spot: Rect | null; placement: CardPlacement | null; viewport: Viewport };

function toRect({ top, left, width, height }: DOMRect): Rect {
  return { top, left, width, height };
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function samePlacement(a: CardPlacement | null, b: CardPlacement | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.side === b.side &&
    a.top === b.top &&
    a.left === b.left &&
    a.arrow?.side === b.arrow?.side &&
    a.arrow?.offset === b.arrow?.offset
  );
}

function currentViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Scrolls the target into view when its raw rect isn't fully inside the
 * viewport margin. A target taller than the viewport is never "inside", so it
 * scrolls once and is then left alone (the caller runs this once per step).
 */
function scrollTargetIntoView(target: Element) {
  if (!isTargetVisible(target) || typeof target.scrollIntoView !== 'function') return;
  if (isRectInViewport(toRect(target.getBoundingClientRect()), currentViewport(), TOUR_LAYOUT.margin)) return;
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

/**
 * Measures the target and the (rendered) card, and derives the spotlight rect
 * and the card placement from them. `active` is true while the card is mounted
 * (the step is `showing`).
 *
 * - `placement` stays `null` until the real card size is known and belongs to
 *   `stepKey`, so the card is never placed from a `{0,0}` size or a stale step;
 * - the target is scrolled into view once per step, before the first measure;
 * - re-measures (never re-scrolls) on ResizeObserver (target + card, when the
 *   browser has it), window resize and any scroll (capture, passive), all
 *   throttled to one frame;
 * - `onTargetLost` fires once per step when the target stops being visible.
 *
 * `spot` (and its `viewport`) outlives `active` on purpose: while the next step is `entering` the
 * ring holds its last rect, so it can slide to the next target.
 */
export function useTourGeometry({
  active,
  stepKey,
  target,
  cardRef,
  preferred = 'auto',
  onTargetLost,
}: {
  active: boolean;
  /** Identifies the step; placement is only valid for the key it was measured under. */
  stepKey: string;
  target: Element | null;
  cardRef: RefObject<HTMLElement | null>;
  preferred?: PlacementSide | 'auto';
  onTargetLost: () => void;
}): { spot: Rect | null; placement: CardPlacement | null; viewport: Viewport | null } {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const onTargetLostRef = useRef(onTargetLost);
  const lostRef = useRef(false);
  const scrolledForRef = useRef<string | null>(null);

  useEffect(() => {
    onTargetLostRef.current = onTargetLost;
  });

  const measure = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    if (target && !isTargetVisible(target)) {
      if (!lostRef.current) {
        lostRef.current = true;
        onTargetLostRef.current();
      }
      return;
    }
    // Visible again: re-arm, so a later loss of the same target is reported too.
    lostRef.current = false;

    const viewport = currentViewport();
    const spot = target ? spotlightRect(toRect(target.getBoundingClientRect()), viewport) : null;
    const cardBox = card.getBoundingClientRect();
    const placement =
      cardBox.width > 0 && cardBox.height > 0
        ? computeCardPlacement({
            spot,
            card: { width: cardBox.width, height: cardBox.height },
            viewport,
            preferred,
          })
        : null;

    setGeometry((prev) =>
      prev &&
      prev.key === stepKey &&
      prev.viewport.width === viewport.width &&
      prev.viewport.height === viewport.height &&
      sameRect(prev.spot, spot) &&
      samePlacement(prev.placement, placement)
        ? prev
        : { key: stepKey, spot, placement, viewport }
    );
  }, [cardRef, target, preferred, stepKey]);

  // Scroll first (once per step), then measure, so the spot is never computed
  // from a pre-scroll position and wrongly seen as off-screen.
  useLayoutEffect(() => {
    if (!active) return;
    lostRef.current = false;
    if (target && scrolledForRef.current !== stepKey) {
      scrolledForRef.current = stepKey;
      scrollTargetIntoView(target);
    }
    measure();
  }, [active, stepKey, target, measure]);

  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      if (cardRef.current) observer.observe(cardRef.current);
      if (target) observer.observe(target);
    }

    return () => {
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, { capture: true });
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active, cardRef, target, measure]);

  return {
    spot: geometry?.spot ?? null,
    placement: geometry && geometry.key === stepKey ? geometry.placement : null,
    // The viewport the spot was measured in, for the interactive clip-path.
    viewport: geometry?.viewport ?? null,
  };
}
