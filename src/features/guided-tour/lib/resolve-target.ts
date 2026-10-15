import type { TourTarget } from '../types';

/** Attribute that marks an element as a tour target: `<button data-tour="search">`. */
export const TOUR_ATTR = 'data-tour';

/**
 * Keys are restricted to lowercase kebab so they can sit inside a CSS attribute selector
 * without escaping (no selector injection is possible).
 */
const TOUR_KEY_PATTERN = /^[a-z0-9-]+$/;

const isDev = import.meta.env.DEV;

export function isTourTargetKey(key: string): boolean {
  return TOUR_KEY_PATTERN.test(key);
}

/**
 * Connected and laid out. Hidden copies (the desktop sidebar while the phone sidebar sheet is
 * open, `hidden` subtrees, display:none) have no client rects, so this filters them out.
 */
export function isTargetVisible(el: Element): boolean {
  return el.isConnected && el.getClientRects().length > 0;
}

/** First visible match for the target, or null. Never throws. */
export function resolveTarget(target: TourTarget, root: ParentNode = document): Element | null {
  if (typeof target === 'function') {
    let el: Element | null;
    try {
      el = target();
    } catch (error) {
      console.error('[guided-tour] function target threw', error);
      return null;
    }
    return el && isTargetVisible(el) ? el : null;
  }

  if (!isTourTargetKey(target)) {
    console.error(`[guided-tour] invalid target key "${target}": must match ${TOUR_KEY_PATTERN}`);
    return null;
  }

  const visible = Array.from(root.querySelectorAll(`[${TOUR_ATTR}="${target}"]`)).filter(isTargetVisible);
  if (isDev && visible.length > 1) {
    console.warn(`[guided-tour] ${visible.length} visible elements match target "${target}"; using the first`);
  }
  return visible[0] ?? null;
}

export interface WaitForTargetOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  root?: ParentNode;
}

const WATCHED_ATTRIBUTES = ['style', 'class', 'hidden', TOUR_ATTR];

/**
 * Resolves the target as soon as it is present and visible. Watches DOM mutations (re-checked
 * on the next animation frame so a burst of mutations costs one query). Resolves null on
 * timeout or abort. Observer, timer and frame are released on every path.
 */
export function waitForTarget(
  target: TourTarget,
  { timeoutMs, signal, root = document }: WaitForTargetOptions
): Promise<Element | null> {
  if (signal?.aborted) return Promise.resolve(null);
  if (typeof target === 'string' && !isTourTargetKey(target)) {
    // Log once here instead of on every re-check.
    return Promise.resolve(resolveTarget(target, root));
  }

  const found = resolveTarget(target, root);
  if (found) return Promise.resolve(found);

  return new Promise<Element | null>((resolve) => {
    let observer: MutationObserver | null = null;
    let frameId: number | undefined;
    let settled = false;

    const settle = (value: Element | null) => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      clearTimeout(timeoutId);
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => settle(null);

    const check = () => {
      frameId = undefined;
      const el = resolveTarget(target, root);
      if (el) settle(el);
    };
    const scheduleCheck = () => {
      if (settled || frameId !== undefined) return;
      frameId = requestAnimationFrame(check);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    const timeoutId = setTimeout(() => settle(null), timeoutMs);

    // Function targets may live anywhere, so watch the whole document for them.
    const observed: Node = typeof target === 'function' ? document : (root as unknown as Node);
    observer = new MutationObserver(scheduleCheck);
    observer.observe(observed, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRIBUTES,
    });
  });
}
