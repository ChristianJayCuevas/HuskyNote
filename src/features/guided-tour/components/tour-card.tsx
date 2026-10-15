import type { CSSProperties, ReactNode, Ref } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { fillText } from '../lib/fill-text';
import type { CardPlacement } from '../lib/placement';
import type { TourDismissReason, TourStep } from '../types';

type Translate = (path: string, fallback?: string) => string;

/** Eyebrow copy: the step's own, else a first/last greeting on target-less steps, else "Step n of m". */
function eyebrowFor(step: TourStep, index: number, total: number, t: Translate): string {
  if (step.eyebrow) return t(step.eyebrow);
  if (step.target === undefined) {
    if (index === 0) return t('tour.controls.welcome');
    if (index === total - 1) return t('tour.controls.finished');
  }
  return fillText(t('tour.controls.stepOf'), { n: index + 1, total });
}

/** A step's body: translated when it is a key (or plain text), rendered as given otherwise. */
function bodyFor(body: ReactNode, t: Translate): ReactNode {
  return typeof body === 'string' ? t(body) : body;
}

/**
 * The coachmark: eyebrow, title, body, progress dots + counter, and the
 * Skip / Back / Next actions. Positioned and measured by TourOverlay; it stays
 * at opacity 0 until `placement` is known.
 */
export function TourCard({
  step,
  index,
  total,
  placement,
  cardRef,
  primaryRef,
  titleId,
  bodyId,
  onNext,
  onBack,
  onDismiss,
}: {
  step: TourStep;
  index: number;
  total: number;
  /** `null` until the card has been measured. */
  placement: CardPlacement | null;
  cardRef: Ref<HTMLDivElement>;
  /** The Next / Done button, focused on each shown step. */
  primaryRef: Ref<HTMLButtonElement>;
  titleId: string;
  bodyId: string;
  onNext: () => void;
  onBack: () => void;
  onDismiss: (reason: TourDismissReason) => void;
}) {
  const { t } = useLanguage();
  const isLast = index === total - 1;
  const style: CSSProperties = placement ? { top: placement.top, left: placement.left } : {};

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal={!step.interactive}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Not an overflow container itself (that would clip the arrow); a stacking context, so the
      // arrow (z-index -1) paints over the card's border but under its content
      className="pointer-events-auto absolute left-0 top-0 isolate w-[min(340px,calc(100vw-24px))] rounded-xl border bg-popover text-popover-foreground opacity-0 shadow-xl data-[ready]:opacity-100 data-[ready]:animate-in data-[ready]:fade-in-0 data-[ready]:slide-in-from-bottom-1 motion-reduce:data-[ready]:animate-none"
      style={style}
      data-slot="guided-tour-card"
      data-ready={placement ? '' : undefined}
      data-placement={placement?.side}
    >
      {placement?.arrow ? (
        <span
          className="guided-tour-arrow"
          data-slot="guided-tour-arrow"
          data-side={placement.arrow.side}
          style={{ '--tour-arrow-offset': `${placement.arrow.offset}px` } as CSSProperties}
          aria-hidden="true"
        />
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 text-muted-foreground"
        aria-label={t('tour.controls.close')}
        onClick={() => onDismiss('close-button')}
      >
        <X aria-hidden="true" />
      </Button>

      <div className="max-h-[calc(100dvh-24px)] overflow-auto rounded-[inherit] p-4">
        <p className="mb-1 pr-8 text-xs font-medium text-muted-foreground">{eyebrowFor(step, index, total, t)}</p>
        <h2 id={titleId} className="mb-1.5 pr-8 text-base font-semibold leading-snug">
          {t(step.title)}
        </h2>
        <div id={bodyId} className="text-sm leading-relaxed text-muted-foreground">
          {bodyFor(step.body, t)}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-border data-[active]:w-4 data-[active]:bg-foreground"
                  data-slot="guided-tour-dot"
                  data-active={i === index ? '' : undefined}
                />
              ))}
            </div>
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {fillText(t('tour.controls.counter'), { n: index + 1, total })}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onDismiss('skip-button')}>
              {t('tour.controls.skip')}
            </Button>
            {index > 0 ? (
              <Button variant="outline" size="sm" onClick={onBack}>
                {t('tour.controls.back')}
              </Button>
            ) : null}
            <Button ref={primaryRef} size="sm" onClick={onNext}>
              {isLast ? t('tour.controls.done') : t('tour.controls.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
