// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTourAfterDialogs } from '../../src/features/guided-tour/lib/start-after-dialogs';
import { getActiveTourSnapshot, resetActiveTourForTests } from '../../src/features/guided-tour/state/active-tour-store';
import { TOURS, type TourId } from '../../src/features/guided-tour/tours/registry';
import type { TourDefinition } from '../../src/features/guided-tour/types';

const DEMO = 'demo' as unknown as TourId;
const status = () => getActiveTourSnapshot().machine.status;

/** A Radix dialog or menu as the palette, sheets and dropdowns render it (open or closing) */
function radix(role: string, state: 'open' | 'closed'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', role);
  el.setAttribute('data-state', state);
  document.body.appendChild(el);
  return el;
}

describe('startTourAfterDialogs: starting from a menu, the palette or a sheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetActiveTourForTests();
    (TOURS as Record<string, TourDefinition>).demo = { id: 'demo', version: 1, steps: [{ id: 'a', title: 'A', body: 'B' }] };
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete (TOURS as Record<string, TourDefinition>).demo;
  });

  it('starts right away when nothing is open', () => {
    startTourAfterDialogs(DEMO);
    vi.advanceTimersByTime(0);
    expect(status()).toBe('active');
    expect(getActiveTourSnapshot().source).toBe('manual');
  });

  it.each(['dialog', 'menu', 'alertdialog'])('waits for a closing %s to leave the page', (role) => {
    const closing = radix(role, 'closed');
    startTourAfterDialogs(DEMO);
    vi.advanceTimersByTime(200);
    expect(status()).toBe('idle');
    closing.remove();
    vi.advanceTimersByTime(100);
    expect(status()).toBe('active');
  });

  it('starts anyway after a second, so a stuck dialog never swallows the click', () => {
    radix('dialog', 'open');
    startTourAfterDialogs(DEMO);
    vi.advanceTimersByTime(900);
    expect(status()).toBe('idle');
    vi.advanceTimersByTime(200);
    expect(status()).toBe('active');
  });
});
