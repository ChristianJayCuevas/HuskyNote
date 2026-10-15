import { useEffect, useRef, type RefObject } from 'react';

import type { TourDismissReason } from '../types';

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** True when the key came from a text field that lives outside the tour overlay. */
function isEditableOutside(target: EventTarget | null, root: HTMLElement | null): boolean {
  if (!(target instanceof Element)) return false;
  if (root?.contains(target)) return false;
  return target.closest(EDITABLE_SELECTOR) !== null;
}

/**
 * One document keydown listener for the lifetime of the overlay: Esc dismisses,
 * ArrowRight advances, ArrowLeft goes back (omit `onBack` on the first step).
 * Keys are left alone when something already handled them (`defaultPrevented`,
 * e.g. an open menu closing on Esc), a modifier is held, an IME is composing, or
 * the key came from a text field outside the overlay. `preventDefault` only
 * runs for keys the tour actually handled.
 */
export function useTourKeyboard({
  rootRef,
  onNext,
  onBack,
  onDismiss,
}: {
  rootRef: RefObject<HTMLElement | null>;
  onNext: () => void;
  onBack?: () => void;
  onDismiss: (reason: TourDismissReason) => void;
}) {
  // Latest handlers without re-subscribing the document listener on every render.
  const handlersRef = useRef({ onNext, onBack, onDismiss });
  useEffect(() => {
    handlersRef.current = { onNext, onBack, onDismiss };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableOutside(event.target, rootRef.current)) return;

      const handlers = handlersRef.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        handlers.onDismiss('escape');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handlers.onNext();
      } else if (event.key === 'ArrowLeft' && handlers.onBack) {
        event.preventDefault();
        handlers.onBack();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rootRef]);
}
