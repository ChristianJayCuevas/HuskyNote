/**
 * Pure geometry for the guided tour: the spotlight rect around a target and
 * where the coachmark card sits next to it. Nothing here reads `window` or the
 * DOM; the caller measures and passes the viewport in, so every function is
 * unit-testable in a plain node environment.
 *
 * All rects are viewport coordinates (what `getBoundingClientRect` returns),
 * because the overlay is `position: fixed`.
 */

export type Rect = { top: number; left: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type PlacementSide = 'top' | 'bottom' | 'left' | 'right';

export type CardPlacement = {
  /** Which side of the target the card sits on, or `center` (no arrow). */
  side: PlacementSide | 'center';
  /** Card position in viewport px, already clamped into the viewport margin. */
  top: number;
  left: number;
  /**
   * Arrow on the card, or `null` when centered. `side` is the CARD edge the
   * arrow is drawn on, so it faces the target (a card placed `bottom` of the
   * target has its arrow on its `top` edge). `offset` is the distance from the
   * card's left edge (top/bottom arrows) or top edge (left/right arrows) to the
   * arrow's center.
   */
  arrow: { side: PlacementSide; offset: number } | null;
};

export const TOUR_LAYOUT = {
  /** Breathing room between the target and the spotlight ring. */
  pad: 8,
  /** Gap between the spotlight and the card. */
  gap: 16,
  /** Minimum distance from the card to any viewport edge. */
  margin: 12,
  cardMaxWidth: 340,
  arrowSize: 12,
  /** Keeps the arrow center away from the card's rounded corners. */
  arrowInset: 22,
} as const;

/** `min` wins when the range is inverted (card larger than the viewport). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Card width: 340px, or the viewport minus both side margins on narrow screens. */
export function cardWidth(viewport: Viewport): number {
  return Math.max(0, Math.min(TOUR_LAYOUT.cardMaxWidth, viewport.width - TOUR_LAYOUT.margin * 2));
}

/**
 * The target padded by `pad` and clamped to the viewport, or `null` when the
 * target itself lies fully off-screen (so the card centers instead of pointing
 * at nothing). The off-screen test uses the unpadded target.
 */
export function spotlightRect(target: Rect, viewport: Viewport, pad: number = TOUR_LAYOUT.pad): Rect | null {
  const targetRight = target.left + target.width;
  const targetBottom = target.top + target.height;
  if (targetRight <= 0 || targetBottom <= 0 || target.left >= viewport.width || target.top >= viewport.height) {
    return null;
  }

  const left = Math.max(0, target.left - pad);
  const top = Math.max(0, target.top - pad);
  const right = Math.min(viewport.width, targetRight + pad);
  const bottom = Math.min(viewport.height, targetBottom + pad);
  return { top, left, width: right - left, height: bottom - top };
}

const AUTO_ORDER: readonly PlacementSide[] = ['bottom', 'top', 'right', 'left'];

/** Arrow on the card edge facing the target. */
const ARROW_EDGE: Record<PlacementSide, PlacementSide> = {
  bottom: 'top',
  top: 'bottom',
  right: 'left',
  left: 'right',
};

/**
 * Seats the card next to the spot. Tries the preferred side first (when it is
 * an explicit side), then bottom, top, right, left; the first side where the
 * whole card fits inside the viewport margin wins. Nothing fits (or no spot)
 * → centered with no arrow.
 */
export function computeCardPlacement({
  spot,
  card,
  viewport,
  preferred = 'auto',
}: {
  spot: Rect | null;
  card: { width: number; height: number };
  viewport: Viewport;
  preferred?: PlacementSide | 'auto';
}): CardPlacement {
  const { gap, margin, arrowInset } = TOUR_LAYOUT;
  const minLeft = margin;
  const minTop = margin;
  const maxLeft = viewport.width - margin - card.width;
  const maxTop = viewport.height - margin - card.height;

  if (spot) {
    const spotCenterX = spot.left + spot.width / 2;
    const spotCenterY = spot.top + spot.height / 2;
    const fitsHorizontally = card.width <= viewport.width - margin * 2;
    const fitsVertically = card.height <= viewport.height - margin * 2;

    const order = preferred === 'auto' ? AUTO_ORDER : [preferred, ...AUTO_ORDER.filter((s) => s !== preferred)];

    for (const side of order) {
      if (side === 'bottom' || side === 'top') {
        const top = side === 'bottom' ? spot.top + spot.height + gap : spot.top - gap - card.height;
        if (!fitsHorizontally || top < minTop || top > maxTop) continue;
        const left = clamp(spotCenterX - card.width / 2, minLeft, maxLeft);
        return {
          side,
          top,
          left,
          arrow: {
            side: ARROW_EDGE[side],
            offset: clamp(spotCenterX - left, arrowInset, card.width - arrowInset),
          },
        };
      }

      const left = side === 'right' ? spot.left + spot.width + gap : spot.left - gap - card.width;
      if (!fitsVertically || left < minLeft || left > maxLeft) continue;
      const top = clamp(spotCenterY - card.height / 2, minTop, maxTop);
      return {
        side,
        top,
        left,
        arrow: {
          side: ARROW_EDGE[side],
          offset: clamp(spotCenterY - top, arrowInset, card.height - arrowInset),
        },
      };
    }
  }

  return {
    side: 'center',
    top: clamp((viewport.height - card.height) / 2, minTop, maxTop),
    left: clamp((viewport.width - card.width) / 2, minLeft, maxLeft),
    arrow: null,
  };
}

/**
 * `clip-path` for the interactive catch layer: the whole viewport minus a
 * rectangular hole equal to `spot`, so pointer events fall through to the
 * target. A single evenodd polygon: outer rect, a zero-width bridge to the
 * hole, the hole, and the bridge back.
 */
export function spotlightClipPath(spot: Rect, viewport: Viewport): string {
  const { left, top } = spot;
  const right = spot.left + spot.width;
  const bottom = spot.top + spot.height;
  const points = [
    [0, 0],
    [viewport.width, 0],
    [viewport.width, viewport.height],
    [0, viewport.height],
    [0, 0],
    [left, top],
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
    [0, 0],
  ];
  return `polygon(evenodd, ${points.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
}

/**
 * True when the rect lies entirely inside the viewport inset by `margin`.
 * A rect taller or wider than the viewport is never "in" it.
 */
export function isRectInViewport(rect: Rect, viewport: Viewport, margin = 0): boolean {
  return (
    rect.left >= margin &&
    rect.top >= margin &&
    rect.left + rect.width <= viewport.width - margin &&
    rect.top + rect.height <= viewport.height - margin
  );
}
