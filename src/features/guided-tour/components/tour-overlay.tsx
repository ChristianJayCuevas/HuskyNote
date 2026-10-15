import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage } from '@/context/language-context';

import { useFocusTrap } from '../hooks/use-focus-trap';
import { useTourGeometry } from '../hooks/use-tour-geometry';
import { useTourKeyboard } from '../hooks/use-tour-keyboard';
import { fillText } from '../lib/fill-text';
import { spotlightClipPath } from '../lib/placement';
import type { TourDismissReason, TourStep } from '../types';
import { TourCard } from './tour-card';
import './guided-tour.css';

export interface TourOverlayProps {
  step: TourStep;
  index: number;
  total: number;
  /** Resolved target for the step, or `null` (no target, or `onMissing: 'center'`). */
  target: Element | null;
  /** `entering`: the step is being resolved, the card is not shown yet. */
  phase: 'entering' | 'showing';
  onNext: () => void;
  onBack: () => void;
  onDismiss: (reason: TourDismissReason) => void;
  /** The target stopped being visible while the step was showing. */
  onTargetLost: () => void;
}

/**
 * The guided tour's presentation layer, controlled entirely by props (no tour
 * logic): a dim spotlight around `target` plus a coachmark card. Portaled to
 * `<body>` as one fixed layer that stays mounted for the whole
 * tour; it is the focus-trap container, so focus returns to the trigger when
 * the tour ends.
 *
 * While `phase` is `entering` the layer stays up but the card is not rendered
 * (so a half-resolved step is never announced or focusable) and the ring holds
 * its last rect; focus parks on the layer until the next card shows.
 */
export function TourOverlay({
  step,
  index,
  total,
  target,
  phase,
  onNext,
  onBack,
  onDismiss,
  onTargetLost,
}: TourOverlayProps) {
  const { t } = useLanguage();
  const showing = phase === 'showing';
  const stepKey = `${index}:${step.id}`;
  const titleId = useId();
  const bodyId = useId();

  const rootRef = useFocusTrap<HTMLDivElement>(true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  const { spot, placement, viewport } = useTourGeometry({
    active: showing,
    stepKey,
    target,
    cardRef,
    preferred: step.placement,
    onTargetLost,
  });

  useTourKeyboard({ rootRef, onNext, onBack: index > 0 ? onBack : undefined, onDismiss });

  // Declared after `useFocusTrap`, so it runs after the trap's own initial
  // focus. Each shown step lands on Next/Done; while entering, the old card is
  // gone, so focus parks on the layer instead of leaking to the page behind.
  useEffect(() => {
    if (showing) {
      // Runs once per freshly mounted card, so focus can only be on the trap's
      // own first-focusable pick (Close); the effect never re-runs mid-step.
      primaryRef.current?.focus();
    } else if (!rootRef.current?.contains(document.activeElement)) {
      rootRef.current?.focus({ preventScroll: true });
    }
  }, [showing, stepKey, rootRef]);

  const holeClipPath = showing && step.interactive && spot && viewport ? spotlightClipPath(spot, viewport) : undefined;
  const ringStyle: CSSProperties | undefined = spot
    ? {
        width: spot.width,
        height: spot.height,
        transform: `translate3d(${spot.left}px, ${spot.top}px, 0)`,
      }
    : undefined;

  return createPortal(
    <div ref={rootRef} tabIndex={-1} className="guided-tour" data-slot="guided-tour" data-phase={phase}>
      {/* Click-catch layer: dims on its own only when the ring isn't drawn. */}
      <div
        className="guided-tour-catch"
        data-slot="guided-tour-catch"
        data-dim={spot ? undefined : ''}
        style={holeClipPath ? { clipPath: holeClipPath } : undefined}
        aria-hidden="true"
        onClick={() => onDismiss('backdrop')}
      />
      {spot ? <div className="guided-tour-ring" data-slot="guided-tour-ring" style={ringStyle} aria-hidden="true" /> : null}

      {showing ? (
        <TourCard
          step={step}
          index={index}
          total={total}
          placement={placement}
          cardRef={cardRef}
          primaryRef={primaryRef}
          titleId={titleId}
          bodyId={bodyId}
          onNext={onNext}
          onBack={onBack}
          onDismiss={onDismiss}
        />
      ) : null}

      <div className="sr-only" role="status" aria-live="polite" data-slot="guided-tour-live">
        {showing ? fillText(t('tour.controls.announce'), { n: index + 1, total, title: t(step.title) }) : ''}
      </div>
    </div>,
    document.body
  );
}
