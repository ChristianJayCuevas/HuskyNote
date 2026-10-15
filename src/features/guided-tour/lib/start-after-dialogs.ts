import { startTour } from '../state/active-tour-store';
import type { TourId } from '../tours/registry';

/** Radix dialogs, sheets, the command palette and dropdown menus, open or still animating closed */
const MODAL_UI = '[role="dialog"][data-state], [role="alertdialog"][data-state], [role="menu"][data-state]';
const CHECK_EVERY_MS = 50;
const MAX_WAIT_MS = 1000;

/**
 * Starts a tour from a menu item, a command palette action or the phone sidebar sheet. Those keep
 * their focus trap until they have animated closed and then hand focus back, which would pull it
 * out of the tour card, so this waits until they are gone (a second at most).
 */
export function startTourAfterDialogs(id: TourId): void {
  let waited = 0;
  const attempt = () => {
    if (document.querySelector(MODAL_UI) && waited < MAX_WAIT_MS) {
      waited += CHECK_EVERY_MS;
      window.setTimeout(attempt, CHECK_EVERY_MS);
      return;
    }
    startTour(id, { source: 'manual' });
  };
  window.setTimeout(attempt, 0);
}
