/**
 * Exports: useScrollFade
 *
 * useScrollFade(ref, enabled?) marks a horizontally scrolling strip (e.g. a tab strip on phones) with
 * data-scroll-fade="start" | "end" | "both" while items are clipped on that side, and removes it when
 * everything fits. src/index.css turns the attribute into an edge fade, so hidden tabs read as scrollable.
 */
import * as React from 'react';

export function useScrollFade<T extends HTMLElement>(ref: React.RefObject<T>, enabled = true) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const start = el.scrollLeft > 1;
      const end = max > 1 && el.scrollLeft < max - 1;
      const value = start && end ? 'both' : start ? 'start' : end ? 'end' : '';
      if (value) el.setAttribute('data-scroll-fade', value);
      else el.removeAttribute('data-scroll-fade');
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    const observeChildren = () => {
      if (!resize) return;
      resize.observe(el);
      for (const child of Array.from(el.children)) resize.observe(child);
    };
    observeChildren();
    // Tabs can appear later (e.g. "Screenshots (n)"), which changes the scroll width without resizing the strip
    const mutations = new MutationObserver(() => {
      observeChildren();
      update();
    });
    mutations.observe(el, { childList: true, subtree: true, characterData: true });

    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
      mutations.disconnect();
      el.removeAttribute('data-scroll-fade');
    };
  }, [ref, enabled]);
}
