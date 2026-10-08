/**
 * Sizes a textarea to its content so the surrounding page (not the textarea) scrolls.
 * The nearest scrolling ancestor keeps its scroll position while the height is re-measured,
 * so typing near the bottom of a long note doesn't make the page jump.
 * A CSS max-height (with overflow-y-auto) caps the growth, e.g. for a chat composer.
 */
export function autoGrowTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  let scroller: HTMLElement | null = el.parentElement;
  while (scroller && !/(auto|scroll)/.test(window.getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  const scrollTop = scroller?.scrollTop ?? 0;
  const style = window.getComputedStyle(el);
  const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + borders}px`;
  if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
}
