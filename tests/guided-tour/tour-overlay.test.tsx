/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '../../src/context/language-context';
import type { TourStep } from '../../src/features/guided-tour/types';
import { TourOverlay, type TourOverlayProps } from '../../src/features/guided-tour/components/tour-overlay';

type BoxLike = { top: number; left: number; width: number; height: number };

const CARD_SIZE: BoxLike = { top: 0, left: 0, width: 340, height: 200 };
const ZERO_BOX: BoxLike = { top: 0, left: 0, width: 0, height: 0 };

let cardBox: BoxLike;
let boxes: WeakMap<Element, BoxLike>;
let rafQueue: FrameRequestCallback[];
let resizeObservers: Array<{
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}>;
let reducedMotion: boolean;

function toDomRect({ top, left, width, height }: BoxLike): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

/** Runs every queued animation frame once (frames queued by those frames wait for the next flush). */
function flushFrames() {
  const queued = rafQueue;
  rafQueue = [];
  act(() => {
    for (const callback of queued) callback(0);
  });
}

/** A connected target with a stubbed rect and layout (jsdom has none). */
function makeTarget(box: BoxLike): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  boxes.set(el, box);
  el.getClientRects = () => [toDomRect(box)] as unknown as DOMRectList;
  return el;
}

function hideTarget(el: HTMLElement) {
  el.getClientRects = () => [] as unknown as DOMRectList;
}

const STEP: TourStep = { id: 'create-board', title: 'Create a board', body: 'Upload things.', target: 'create-board' };

function setup(overrides: Partial<TourOverlayProps> = {}) {
  const props: TourOverlayProps = {
    step: STEP,
    index: 1,
    total: 3,
    target: null,
    phase: 'showing',
    onNext: vi.fn(),
    onBack: vi.fn(),
    onDismiss: vi.fn(),
    onTargetLost: vi.fn(),
    ...overrides,
  };
  const view = render(<TourOverlay {...props} />, { wrapper: LanguageProvider });
  return {
    props,
    ...view,
    update: (next: Partial<TourOverlayProps>) => view.rerender(<TourOverlay {...props} {...next} />),
  };
}

const layer = () => document.querySelector<HTMLElement>('[data-slot="guided-tour"]');
const catchLayer = () => document.querySelector<HTMLElement>('[data-slot="guided-tour-catch"]');
const ring = () => document.querySelector<HTMLElement>('[data-slot="guided-tour-ring"]');
const arrow = () => document.querySelector<HTMLElement>('[data-slot="guided-tour-arrow"]');
const card = () => screen.getByRole('dialog');

beforeEach(() => {
  cardBox = CARD_SIZE;
  boxes = new WeakMap();
  rafQueue = [];
  resizeObservers = [];
  reducedMotion = false;

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('role') === 'dialog') return toDomRect(cardBox);
    return toDomRect(boxes.get(this) ?? ZERO_BOX);
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => rafQueue.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        resizeObservers.push({ callback, observe: this.observe, disconnect: this.disconnect });
      }
    }
  );
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reducedMotion && query.includes('reduce'), media: query }),
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  // @ts-expect-error -- remove the jsdom gap stubs between tests
  delete Element.prototype.scrollIntoView;
  // @ts-expect-error -- remove the matchMedia stub between tests
  delete window.matchMedia;
});

describe('structure', () => {
  it('portals one fixed layer to document.body', () => {
    const { container } = setup();
    expect(layer()).not.toBeNull();
    expect(layer()?.parentElement).toBe(document.body);
    expect(container.querySelector('[data-slot="guided-tour"]')).toBeNull();
    expect(layer()).toHaveAttribute('tabindex', '-1');
  });

  it('gives the card dialog semantics labelled by the title and described by the body', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Create a board' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent('Upload things.');
  });

  it('is not aria-modal on an interactive step', () => {
    setup({ step: { ...STEP, interactive: true } });
    expect(card()).toHaveAttribute('aria-modal', 'false');
  });

  it('renders ReactNode bodies', () => {
    setup({ step: { ...STEP, body: <strong>Bold body</strong> } });
    expect(screen.getByText('Bold body').tagName).toBe('STRONG');
  });
});

describe('eyebrow', () => {
  it('uses the step eyebrow when given', () => {
    setup({ step: { ...STEP, eyebrow: 'New' } });
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it("says Welcome on the first target-less step and You're set on the last", () => {
    const welcome: TourStep = { id: 'welcome', title: 'Hi', body: 'b' };
    const { update } = setup({ step: welcome, index: 0, total: 3 });
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    update({ step: { ...welcome, id: 'done' }, index: 2 });
    expect(screen.getByText("You're set")).toBeInTheDocument();
  });

  it('falls back to Step n of m when the step has a target', () => {
    setup({ index: 0, total: 3 });
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });
});

describe('controls', () => {
  it('hides Back on the first step and shows it afterwards', () => {
    const { update } = setup({ index: 0 });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    update({ index: 1 });
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('shows Done on the last step and Next otherwise', () => {
    const { update } = setup({ index: 1, total: 3 });
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    update({ index: 2 });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('shows the n / total counter and one dot per step with the current one active', () => {
    setup({ index: 1, total: 4 });
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    const dots = card().querySelectorAll('[data-slot="guided-tour-dot"]');
    expect(dots).toHaveLength(4);
    expect(card().querySelectorAll('[data-active]')).toHaveLength(1);
    expect(dots[1]).toHaveAttribute('data-active');
  });

  it('wires each button and the backdrop to its callback', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(props.onDismiss).toHaveBeenLastCalledWith('skip-button');
    fireEvent.click(screen.getByRole('button', { name: 'Close tour' }));
    expect(props.onDismiss).toHaveBeenLastCalledWith('close-button');
    fireEvent.click(catchLayer() as HTMLElement);
    expect(props.onDismiss).toHaveBeenLastCalledWith('backdrop');
    expect(props.onDismiss).toHaveBeenCalledTimes(3);
  });

  it('does not dismiss when the card itself is clicked', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText('Create a board'));
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});

describe('keyboard', () => {
  it('Escape dismisses, ArrowRight advances, ArrowLeft goes back', () => {
    const { props } = setup();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(props.onDismiss).toHaveBeenCalledWith('escape');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('ArrowLeft on the first step is not handled and not prevented', () => {
    const { props } = setup({ index: 0 });
    const notPrevented = fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(props.onBack).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it('prevents default only for handled keys', () => {
    setup();
    expect(fireEvent.keyDown(document.body, { key: 'ArrowRight' })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: 'a' })).toBe(true);
  });

  it('ignores keys that came from an input outside the overlay', () => {
    const { props } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(props.onDismiss).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
    expect(props.onBack).not.toHaveBeenCalled();
  });

  it('ignores keys that came from a contenteditable element', () => {
    const { props } = setup();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    fireEvent.keyDown(editable, { key: 'Escape' });
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('ignores keys another handler already prevented', () => {
    const { props } = setup();
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('keydown', prevent, { capture: true });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    document.removeEventListener('keydown', prevent, { capture: true });
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier held or during IME composition', () => {
    const { props } = setup();
    fireEvent.keyDown(document.body, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'Escape', isComposing: true });
    expect(props.onNext).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('adds one document listener and removes it on unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { props, unmount } = setup();
    const keydownAdds = add.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(1);

    unmount();
    expect(remove.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});

describe('focus and live region', () => {
  it('focuses Next on a shown step and returns focus to the trigger on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = setup();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
  });

  it('focuses Done on the last step', () => {
    setup({ index: 2, total: 3 });
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('keeps focus where it already is inside the card', () => {
    const { update } = setup();
    const skip = screen.getByRole('button', { name: 'Skip' });
    skip.focus();
    update({ target: null });
    expect(skip).toHaveFocus();
  });

  it('announces the step politely', () => {
    const { update } = setup({ index: 1, total: 3 });
    const live = document.querySelector('[data-slot="guided-tour-live"]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Step 2 of 3: Create a board');
    update({ index: 2, step: { id: 'tasks', title: 'All tasks', body: 'b' } });
    expect(live).toHaveTextContent('Step 3 of 3: All tasks');
  });
});

describe('entering phase', () => {
  it('keeps the layer mounted but renders no card, and parks focus on the layer', () => {
    const { update } = setup();
    const before = layer();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();

    update({ phase: 'entering', index: 2 });
    expect(layer()).toBe(before);
    expect(layer()).toHaveAttribute('data-phase', 'entering');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-slot="guided-tour-live"]')).toBeEmptyDOMElement();
    expect(layer()).toHaveFocus();

    update({ phase: 'showing', index: 2 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Done|Next/ })).toHaveFocus();
  });

  it('dims through the catch layer when entering with no ring yet', () => {
    setup({ phase: 'entering' });
    expect(catchLayer()).toHaveAttribute('data-dim');
    expect(ring()).toBeNull();
  });
});

describe('placement', () => {
  it('keeps the card unready until its real size is measured', () => {
    cardBox = ZERO_BOX;
    setup();
    expect(card()).not.toHaveAttribute('data-ready');
    expect(card()).not.toHaveAttribute('data-placement');
  });

  it('centers a step with no target: no arrow, no ring, dimmed catch layer', () => {
    setup({ step: { id: 'welcome', title: 'Hi', body: 'b' }, index: 0, target: null });
    expect(card()).toHaveAttribute('data-ready');
    expect(card()).toHaveAttribute('data-placement', 'center');
    expect(arrow()).toBeNull();
    expect(ring()).toBeNull();
    expect(catchLayer()).toHaveAttribute('data-dim');
    // 1024x768 jsdom viewport, 340x200 card.
    expect(card().style.left).toBe('342px');
    expect(card().style.top).toBe('284px');
  });

  it('draws ring + arrow for a target and keeps the catch layer clear', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });

    expect(card()).toHaveAttribute('data-placement', 'bottom');
    expect(card()).toHaveAttribute('data-ready');
    // spot = target padded by 8 -> 292,92 116x56; card sits 16 below it.
    expect(card().style.top).toBe('164px');
    expect(card().style.left).toBe('180px');

    expect(arrow()).toHaveAttribute('data-side', 'top');
    expect(arrow()?.style.getPropertyValue('--tour-arrow-offset')).toBe('170px');

    expect(ring()).not.toBeNull();
    expect(ring()?.style.transform).toBe('translate3d(292px, 92px, 0)');
    expect(ring()?.style.width).toBe('116px');
    expect(ring()?.style.height).toBe('56px');
    expect(catchLayer()).not.toHaveAttribute('data-dim');
  });

  it('centers with a ring but no arrow when nothing fits beside the target', () => {
    const target = makeTarget({ top: 0, left: 0, width: 1024, height: 768 });
    setup({ target });
    expect(ring()).not.toBeNull();
    expect(card()).toHaveAttribute('data-placement', 'center');
    expect(arrow()).toBeNull();
  });

  it('falls back to a centered card and a dimmed catch layer for an off-screen target', () => {
    const target = makeTarget({ top: 5000, left: 0, width: 100, height: 40 });
    setup({ target });
    expect(ring()).toBeNull();
    expect(card()).toHaveAttribute('data-placement', 'center');
    expect(catchLayer()).toHaveAttribute('data-dim');
  });

  it('re-measures when the window resizes', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });
    expect(ring()?.style.transform).toBe('translate3d(292px, 92px, 0)');

    boxes.set(target, { top: 200, left: 300, width: 100, height: 40 });
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(ring()?.style.transform).toBe('translate3d(292px, 192px, 0)');
  });

  it('re-measures on any scroll without scrolling again', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });

    boxes.set(target, { top: 150, left: 300, width: 100, height: 40 });
    fireEvent.scroll(document.body);
    flushFrames();
    expect(ring()?.style.transform).toBe('translate3d(292px, 142px, 0)');
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });

  it('observes the card and target with ResizeObserver and disconnects on unmount', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    const { unmount } = setup({ target });
    expect(resizeObservers).toHaveLength(1);
    expect(resizeObservers[0].observe).toHaveBeenCalledWith(card());
    expect(resizeObservers[0].observe).toHaveBeenCalledWith(target);

    unmount();
    expect(resizeObservers[0].disconnect).toHaveBeenCalled();
  });

  it('works when ResizeObserver is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });
    expect(card()).toHaveAttribute('data-ready');
  });
});

describe('interactive step', () => {
  it('cuts a clip-path hole into the catch layer so clicks reach the target', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ step: { ...STEP, interactive: true }, target });
    const clip = catchLayer()?.style.clipPath ?? '';
    expect(clip).toContain('polygon(evenodd');
    expect(clip).toContain('292px 92px');
  });

  it('leaves the catch layer unclipped on a normal step', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });
    expect(catchLayer()?.style.clipPath).toBe('');
  });
});

describe('scrolling the target into view', () => {
  it('scrolls once, centered, when the target is outside the viewport', () => {
    const target = makeTarget({ top: 900, left: 300, width: 100, height: 40 });
    const { update } = setup({ target });
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' });

    // Same step again (re-render, resize): no further scroll.
    update({ target });
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does not scroll when the target is already in view', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    setup({ target });
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  });

  it('uses instant scrolling under prefers-reduced-motion', () => {
    reducedMotion = true;
    const target = makeTarget({ top: 900, left: 300, width: 100, height: 40 });
    setup({ target });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'auto' });
  });

  it('survives a missing scrollIntoView and matchMedia', () => {
    // @ts-expect-error -- simulate the jsdom gaps
    delete Element.prototype.scrollIntoView;
    // @ts-expect-error -- simulate the jsdom gaps
    delete window.matchMedia;
    const target = makeTarget({ top: 900, left: 300, width: 100, height: 40 });
    expect(() => setup({ target })).not.toThrow();
  });
});

describe('target lost', () => {
  it('fires onTargetLost once when the target stops being visible', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    const { props } = setup({ target });
    expect(props.onTargetLost).not.toHaveBeenCalled();

    hideTarget(target);
    fireEvent(window, new Event('resize'));
    flushFrames();
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(props.onTargetLost).toHaveBeenCalledTimes(1);
  });

  it('re-arms when the target comes back, so a second loss is reported again', () => {
    const box = { top: 100, left: 300, width: 100, height: 40 };
    const target = makeTarget(box);
    const { props } = setup({ target });

    hideTarget(target);
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(props.onTargetLost).toHaveBeenCalledTimes(1);

    target.getClientRects = () => [toDomRect(box)] as unknown as DOMRectList;
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(props.onTargetLost).toHaveBeenCalledTimes(1);

    hideTarget(target);
    fireEvent(window, new Event('resize'));
    flushFrames();
    expect(props.onTargetLost).toHaveBeenCalledTimes(2);
  });

  it('fires onTargetLost when the target is removed from the document', () => {
    const target = makeTarget({ top: 100, left: 300, width: 100, height: 40 });
    const { props } = setup({ target });
    target.remove();
    fireEvent.scroll(document.body);
    flushFrames();
    expect(props.onTargetLost).toHaveBeenCalledTimes(1);
  });
});
