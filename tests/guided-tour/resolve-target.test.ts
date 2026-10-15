/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTargetVisible, isTourTargetKey, resolveTarget, TOUR_ATTR, waitForTarget } from '../../src/features/guided-tour/lib/resolve-target';

/** jsdom has no layout: getClientRects() is always empty. Stub it per element. */
function setVisible(el: Element, visible: boolean) {
  el.getClientRects = () => (visible ? [{}] : []) as unknown as DOMRectList;
}

function makeTarget(key: string, visible = true): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute(TOUR_ATTR, key);
  setVisible(el, visible);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('isTourTargetKey', () => {
  it('accepts lowercase kebab keys only', () => {
    expect(isTourTargetKey('home-create-board')).toBe(true);
    expect(isTourTargetKey('a1')).toBe(true);
    expect(isTourTargetKey('')).toBe(false);
    expect(isTourTargetKey('Upper')).toBe(false);
    expect(isTourTargetKey('a b')).toBe(false);
    expect(isTourTargetKey('a"]')).toBe(false);
    expect(isTourTargetKey('a_b')).toBe(false);
  });
});

describe('isTargetVisible', () => {
  it('requires connected and client rects', () => {
    const el = makeTarget('x');
    expect(isTargetVisible(el)).toBe(false); // not connected
    document.body.append(el);
    expect(isTargetVisible(el)).toBe(true);
    setVisible(el, false);
    expect(isTargetVisible(el)).toBe(false);
  });
});

describe('resolveTarget', () => {
  it('returns the matching visible element', () => {
    const el = makeTarget('alpha');
    document.body.append(el);
    expect(resolveTarget('alpha')).toBe(el);
  });

  it('returns null when nothing matches', () => {
    expect(resolveTarget('missing')).toBeNull();
  });

  it('skips a hidden duplicate for the visible one', () => {
    const hidden = makeTarget('dup', false);
    const shown = makeTarget('dup', true);
    document.body.append(hidden, shown);
    expect(resolveTarget('dup')).toBe(shown);
  });

  it('returns null when every match is hidden', () => {
    document.body.append(makeTarget('dup', false));
    expect(resolveTarget('dup')).toBeNull();
  });

  it('scopes the query to root', () => {
    const outside = makeTarget('scoped');
    const container = document.createElement('section');
    const inside = makeTarget('scoped');
    container.append(inside);
    document.body.append(outside, container);
    expect(resolveTarget('scoped', container)).toBe(inside);
  });

  it('warns in dev when more than one visible match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = makeTarget('two');
    document.body.append(first, makeTarget('two'));
    expect(resolveTarget('two')).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a single visible match among hidden ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.append(makeTarget('one', false), makeTarget('one'));
    resolveTarget('one');
    expect(warn).not.toHaveBeenCalled();
  });

  it('invalid key: console.error and null, no selector built', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = vi.spyOn(document, 'querySelectorAll');
    expect(resolveTarget('a"] , body [x="')).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('function target: visible element returned', () => {
    const el = makeTarget('fn');
    document.body.append(el);
    expect(resolveTarget(() => el)).toBe(el);
  });

  it('function target: hidden, disconnected or null result gives null', () => {
    const hidden = makeTarget('fn', false);
    document.body.append(hidden);
    expect(resolveTarget(() => hidden)).toBeNull();
    expect(resolveTarget(() => makeTarget('detached'))).toBeNull();
    expect(resolveTarget(() => null)).toBeNull();
  });

  it('function target that throws: logged, null', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      resolveTarget(() => {
        throw new Error('boom');
      })
    ).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('waitForTarget', () => {
  it('resolves immediately when present, without observing', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const el = makeTarget('now');
    document.body.append(el);
    await expect(waitForTarget('now', { timeoutMs: 1000 })).resolves.toBe(el);
    expect(observe).not.toHaveBeenCalled();
  });

  it('resolves when the target mounts later', async () => {
    const promise = waitForTarget('later', { timeoutMs: 3000 });
    const el = makeTarget('later');
    document.body.append(el);
    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBe(el);
  });

  it('resolves when a mounted-but-hidden target becomes visible (class change)', async () => {
    const el = makeTarget('reveal', false);
    document.body.append(el);
    const promise = waitForTarget('reveal', { timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(20);
    setVisible(el, true);
    el.setAttribute('class', 'open');
    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBe(el);
  });

  it('skips a hidden duplicate and resolves the visible one that mounts', async () => {
    const hidden = makeTarget('dup', false);
    document.body.append(hidden);
    const promise = waitForTarget('dup', { timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(20);
    const shown = makeTarget('dup', true);
    document.body.append(shown);
    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBe(shown);
  });

  it('function target is awaited the same way', async () => {
    let el: HTMLElement | null = null;
    const promise = waitForTarget(() => el, { timeoutMs: 3000 });
    el = makeTarget('fn');
    document.body.append(el);
    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBe(el);
  });

  it('coalesces a burst of mutations into one re-check per frame', async () => {
    const query = vi.spyOn(document, 'querySelectorAll');
    const promise = waitForTarget('burst', { timeoutMs: 3000 });
    query.mockClear();
    for (let i = 0; i < 5; i++) document.body.append(document.createElement('i'));
    await vi.advanceTimersByTimeAsync(20);
    expect(query).toHaveBeenCalledTimes(1);
    document.body.append(makeTarget('burst'));
    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.not.toBeNull();
  });

  it('times out to null and disconnects the observer', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const promise = waitForTarget('never', { timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(2999);
    expect(disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('abort resolves null, disconnects the observer, clears timers', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const controller = new AbortController();
    const promise = waitForTarget('never', {
      timeoutMs: 3000,
      signal: controller.signal,
    });
    document.body.append(document.createElement('i')); // schedules a frame
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(promise).resolves.toBeNull();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('already-aborted signal resolves null without observing', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const el = makeTarget('present');
    document.body.append(el);
    const controller = new AbortController();
    controller.abort();
    await expect(waitForTarget('present', { timeoutMs: 1000, signal: controller.signal })).resolves.toBeNull();
    expect(observe).not.toHaveBeenCalled();
  });

  it('disconnects the observer and clears timers on success', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const promise = waitForTarget('ok', { timeoutMs: 3000 });
    document.body.append(makeTarget('ok'));
    await vi.advanceTimersByTimeAsync(20);
    await promise;
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('invalid key resolves null immediately with one console.error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    await expect(waitForTarget('Bad Key', { timeoutMs: 1000 })).resolves.toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(observe).not.toHaveBeenCalled();
  });

  it('observes only the documented attributes', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const promise = waitForTarget('attrs', { timeoutMs: 100 });
    expect(observe).toHaveBeenCalledWith(
      document,
      expect.objectContaining({
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'data-tour'],
      })
    );
    await vi.advanceTimersByTimeAsync(100);
    await promise;
  });
});
