import { describe, expect, it } from 'vitest';

import {
  TOUR_LAYOUT,
  cardWidth,
  computeCardPlacement,
  isRectInViewport,
  spotlightClipPath,
  spotlightRect,
  type Rect,
} from '../../src/features/guided-tour/lib/placement';

const viewport = { width: 1000, height: 800 };
const card = { width: 340, height: 200 };

describe('TOUR_LAYOUT', () => {
  it('matches the shared contract', () => {
    expect(TOUR_LAYOUT).toEqual({
      pad: 8,
      gap: 16,
      margin: 12,
      cardMaxWidth: 340,
      arrowSize: 12,
      arrowInset: 22,
    });
  });
});

describe('cardWidth', () => {
  it('caps at 340 on wide viewports', () => {
    expect(cardWidth({ width: 1280, height: 800 })).toBe(340);
    expect(cardWidth({ width: 364, height: 800 })).toBe(340);
  });

  it('shrinks to viewport minus both margins on narrow viewports', () => {
    expect(cardWidth({ width: 360, height: 640 })).toBe(336);
    expect(cardWidth({ width: 320, height: 640 })).toBe(296);
  });

  it('never goes negative', () => {
    expect(cardWidth({ width: 10, height: 10 })).toBe(0);
  });
});

describe('spotlightRect', () => {
  it('pads the target by the default pad', () => {
    const target: Rect = { top: 100, left: 200, width: 50, height: 30 };
    expect(spotlightRect(target, viewport)).toEqual({ top: 92, left: 192, width: 66, height: 46 });
  });

  it('honours a custom pad', () => {
    const target: Rect = { top: 100, left: 200, width: 50, height: 30 };
    expect(spotlightRect(target, viewport, 0)).toEqual(target);
  });

  it('clamps to the viewport on every edge', () => {
    const target: Rect = { top: -20, left: -30, width: 1100, height: 900 };
    expect(spotlightRect(target, viewport)).toEqual({ top: 0, left: 0, width: 1000, height: 800 });
  });

  it('keeps the visible part of a partially visible target', () => {
    const target: Rect = { top: 780, left: 100, width: 50, height: 100 };
    expect(spotlightRect(target, viewport)).toEqual({ top: 772, left: 92, width: 66, height: 28 });
  });

  it('returns null when the target is fully off-screen', () => {
    expect(spotlightRect({ top: -100, left: 10, width: 50, height: 100 }, viewport)).toBeNull();
    expect(spotlightRect({ top: 800, left: 10, width: 50, height: 100 }, viewport)).toBeNull();
    expect(spotlightRect({ top: 10, left: -50, width: 50, height: 100 }, viewport)).toBeNull();
    expect(spotlightRect({ top: 10, left: 1000, width: 50, height: 100 }, viewport)).toBeNull();
  });

  it('does not let the pad pull an off-screen target back on-screen', () => {
    expect(spotlightRect({ top: 805, left: 10, width: 50, height: 20 }, viewport)).toBeNull();
  });
});

describe('computeCardPlacement', () => {
  const centered: Rect = { top: 300, left: 400, width: 100, height: 50 };

  it("auto prefers bottom, centered on the spot with an arrow on the card's top edge", () => {
    const result = computeCardPlacement({ spot: centered, card, viewport });
    expect(result).toEqual({
      side: 'bottom',
      top: 366,
      left: 280,
      arrow: { side: 'top', offset: 170 },
    });
  });

  it('falls back to top when bottom does not fit', () => {
    const spot: Rect = { top: 600, left: 400, width: 100, height: 50 };
    const result = computeCardPlacement({ spot, card, viewport });
    expect(result.side).toBe('top');
    expect(result.top).toBe(384);
    expect(result.arrow).toEqual({ side: 'bottom', offset: 170 });
  });

  it('falls back to right when neither bottom nor top fit', () => {
    const spot: Rect = { top: 20, left: 100, width: 100, height: 760 };
    const result = computeCardPlacement({ spot, card, viewport });
    expect(result).toEqual({
      side: 'right',
      top: 300,
      left: 216,
      arrow: { side: 'left', offset: 100 },
    });
  });

  it('falls back to left when bottom, top and right do not fit', () => {
    const spot: Rect = { top: 20, left: 700, width: 280, height: 760 };
    const result = computeCardPlacement({ spot, card, viewport });
    expect(result).toEqual({
      side: 'left',
      top: 300,
      left: 344,
      arrow: { side: 'right', offset: 100 },
    });
  });

  it('centers with no arrow when no side fits', () => {
    const spot: Rect = { top: 0, left: 0, width: 1000, height: 800 };
    expect(computeCardPlacement({ spot, card, viewport })).toEqual({
      side: 'center',
      top: 300,
      left: 330,
      arrow: null,
    });
  });

  it('centers with no arrow when there is no spot', () => {
    expect(computeCardPlacement({ spot: null, card, viewport })).toEqual({
      side: 'center',
      top: 300,
      left: 330,
      arrow: null,
    });
  });

  it('uses an explicit preferred side when it fits', () => {
    expect(computeCardPlacement({ spot: centered, card, viewport, preferred: 'right' }).side).toBe('right');
    expect(computeCardPlacement({ spot: centered, card, viewport, preferred: 'left' }).side).toBe('left');
    expect(computeCardPlacement({ spot: centered, card, viewport, preferred: 'top' }).side).toBe('top');
  });

  it('falls back to the auto order when the explicit side does not fit', () => {
    const nearTop: Rect = { top: 20, left: 400, width: 100, height: 50 };
    // Not enough room above, so `top` falls through to bottom.
    expect(computeCardPlacement({ spot: nearTop, card, viewport, preferred: 'top' }).side).toBe('bottom');
    const nearRight: Rect = { top: 300, left: 900, width: 90, height: 50 };
    // No room on the right, so `right` falls through to bottom.
    expect(computeCardPlacement({ spot: nearRight, card, viewport, preferred: 'right' }).side).toBe('bottom');
  });

  it("treats preferred 'auto' like no preference", () => {
    expect(computeCardPlacement({ spot: centered, card, viewport, preferred: 'auto' })).toEqual(
      computeCardPlacement({ spot: centered, card, viewport })
    );
  });

  it('clamps the card into the margin on the left and right', () => {
    const leftEdge = computeCardPlacement({
      spot: { top: 300, left: 0, width: 40, height: 50 },
      card,
      viewport,
    });
    expect(leftEdge.left).toBe(TOUR_LAYOUT.margin);

    const rightEdge = computeCardPlacement({
      spot: { top: 300, left: 960, width: 40, height: 50 },
      card,
      viewport,
    });
    expect(rightEdge.left).toBe(viewport.width - TOUR_LAYOUT.margin - card.width);
  });

  it('clamps the card into the margin vertically for left/right sides', () => {
    const shortViewport = { width: 1000, height: 300 };
    const nearTop = computeCardPlacement({
      spot: { top: 0, left: 100, width: 50, height: 200 },
      card,
      viewport: shortViewport,
    });
    expect(nearTop.side).toBe('right');
    expect(nearTop.top).toBe(TOUR_LAYOUT.margin);

    const nearBottom = computeCardPlacement({
      spot: { top: 100, left: 100, width: 50, height: 200 },
      card,
      viewport: shortViewport,
    });
    expect(nearBottom.side).toBe('right');
    expect(nearBottom.top).toBe(shortViewport.height - TOUR_LAYOUT.margin - card.height);
  });

  it('clamps the arrow offset to the inset at both ends of a horizontal card', () => {
    const low = computeCardPlacement({
      spot: { top: 300, left: 0, width: 40, height: 50 },
      card,
      viewport,
    });
    // Spot center (20) is only 8px from the clamped card edge (12).
    expect(low.arrow).toEqual({ side: 'top', offset: TOUR_LAYOUT.arrowInset });

    const high = computeCardPlacement({
      spot: { top: 300, left: 960, width: 40, height: 50 },
      card,
      viewport,
    });
    expect(high.arrow).toEqual({ side: 'top', offset: card.width - TOUR_LAYOUT.arrowInset });
  });

  it('clamps the arrow offset to the inset on a vertical card', () => {
    const result = computeCardPlacement({
      spot: { top: 0, left: 100, width: 50, height: 20 },
      card,
      viewport,
      preferred: 'right',
    });
    expect(result.side).toBe('right');
    expect(result.top).toBe(TOUR_LAYOUT.margin);
    expect(result.arrow).toEqual({ side: 'left', offset: TOUR_LAYOUT.arrowInset });

    const bottom = computeCardPlacement({
      spot: { top: 780, left: 100, width: 50, height: 20 },
      card,
      viewport,
      preferred: 'right',
    });
    expect(bottom.arrow).toEqual({
      side: 'left',
      offset: card.height - TOUR_LAYOUT.arrowInset,
    });
  });

  it('keeps the arrow pointing at the spot center when not clamped', () => {
    const spot: Rect = { top: 300, left: 520, width: 60, height: 50 };
    const result = computeCardPlacement({ spot, card, viewport });
    expect(result.arrow).not.toBeNull();
    expect(result.left + result.arrow!.offset).toBe(spot.left + spot.width / 2);
  });

  it('fits a 360px viewport with the 336px card', () => {
    const narrow = { width: 360, height: 640 };
    const narrowCard = { width: cardWidth(narrow), height: 180 };
    const bottom = computeCardPlacement({
      spot: { top: 100, left: 20, width: 100, height: 40 },
      card: narrowCard,
      viewport: narrow,
    });
    expect(bottom.side).toBe('bottom');
    expect(bottom.left).toBe(12);
    expect(bottom.arrow).toEqual({ side: 'top', offset: 58 });
  });

  it('never picks left/right on a 360px viewport and centers when top/bottom are blocked', () => {
    const narrow = { width: 360, height: 640 };
    const narrowCard = { width: cardWidth(narrow), height: 180 };
    const result = computeCardPlacement({
      spot: { top: 20, left: 20, width: 320, height: 600 },
      card: narrowCard,
      viewport: narrow,
    });
    expect(result).toEqual({ side: 'center', top: 230, left: 12, arrow: null });
  });

  it('keeps a card taller than the viewport pinned to the top margin', () => {
    const result = computeCardPlacement({
      spot: null,
      card: { width: 340, height: 900 },
      viewport,
    });
    expect(result.side).toBe('center');
    expect(result.top).toBe(TOUR_LAYOUT.margin);
  });
});

describe('spotlightClipPath', () => {
  it('returns an evenodd polygon with a rectangular hole equal to the spot', () => {
    const clip = spotlightClipPath({ top: 10, left: 20, width: 30, height: 40 }, { width: 100, height: 200 });
    expect(clip).toBe(
      'polygon(evenodd, ' +
        '0px 0px, 100px 0px, 100px 200px, 0px 200px, 0px 0px, ' +
        '20px 10px, 20px 50px, 50px 50px, 50px 10px, 20px 10px, 0px 0px)'
    );
  });
});

describe('isRectInViewport', () => {
  it('is true when fully inside', () => {
    expect(isRectInViewport({ top: 10, left: 10, width: 100, height: 100 }, viewport)).toBe(true);
  });

  it('is false when any edge sticks out', () => {
    expect(isRectInViewport({ top: -1, left: 10, width: 100, height: 100 }, viewport)).toBe(false);
    expect(isRectInViewport({ top: 10, left: -1, width: 100, height: 100 }, viewport)).toBe(false);
    expect(isRectInViewport({ top: 750, left: 10, width: 100, height: 100 }, viewport)).toBe(false);
    expect(isRectInViewport({ top: 10, left: 950, width: 100, height: 100 }, viewport)).toBe(false);
  });

  it('applies the margin as an inset', () => {
    const rect: Rect = { top: 5, left: 100, width: 100, height: 100 };
    expect(isRectInViewport(rect, viewport)).toBe(true);
    expect(isRectInViewport(rect, viewport, 12)).toBe(false);
  });

  it('is false for a rect larger than the viewport', () => {
    expect(isRectInViewport({ top: 0, left: 0, width: 1000, height: 900 }, viewport)).toBe(false);
  });
});
