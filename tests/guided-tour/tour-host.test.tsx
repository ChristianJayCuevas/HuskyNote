/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../src/context/language-context';
import * as publicApi from '../../src/features/guided-tour/index';
import {
  AUTO_START_GIVE_UP_MS,
  AUTO_START_RECHECK_MS,
  TourAutoStart,
  useTourAutoStart,
} from '../../src/features/guided-tour/hooks/use-tour-auto-start';
import {
  getActiveTourSnapshot,
  resetActiveTourForTests,
  startTour,
} from '../../src/features/guided-tour/state/active-tour-store';
import {
  markTourProgress,
  readTourProgress,
  resetTourProgressForTests,
} from '../../src/features/guided-tour/state/tour-progress';
import { TOURS, type TourId } from '../../src/features/guided-tour/tours/registry';
import type { TourDefinition, TourStep } from '../../src/features/guided-tour/types';
import { TourHost } from '../../src/features/guided-tour/components/tour-host';
import { TourTrigger } from '../../src/features/guided-tour/components/tour-trigger';

const DEMO = 'demo' as unknown as TourId;

function step(id: string, extra: Partial<TourStep> = {}): TourStep {
  return { id, title: `Title ${id}`, body: `Body ${id}`, ...extra };
}

const DEMO_DEFINITION: TourDefinition = { id: 'demo', version: 2, steps: [step('a'), step('b')] };

/** jsdom has no layout: getClientRects() is empty, so stub it to make an element "visible". */
function setVisible(el: Element, visible: boolean) {
  el.getClientRects = () => (visible ? [{}] : []) as unknown as DOMRectList;
}

/** Callback ref that marks the element visible (jsdom has no layout). */
const visibleRef = (el: HTMLElement | null) => {
  if (el) setVisible(el, true);
};

/** The host as App.tsx mounts it, on a view that never changes in these tests */
const Host = () => <TourHost activeView="dashboard" showView={() => {}} />;

const renderWithLanguage = (ui: ReactNode) => render(ui, { wrapper: LanguageProvider });

/** Runs started so far; each start increments it once */
const runs = () => getActiveTourSnapshot().runId;

beforeEach(() => {
  window.localStorage.clear();
  resetTourProgressForTests();
  resetActiveTourForTests();
  (TOURS as Record<string, TourDefinition>).demo = DEMO_DEFINITION;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query }),
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  delete (TOURS as Record<string, TourDefinition>).demo;
  // @ts-expect-error -- remove the jsdom gap stubs between tests
  delete Element.prototype.scrollIntoView;
  // @ts-expect-error -- remove the matchMedia stub between tests
  delete window.matchMedia;
});

function renderApp(extra?: ReactNode) {
  return renderWithLanguage(
    <>
      <main ref={visibleRef}>
        <TourTrigger tourId={DEMO} />
        {extra}
      </main>
      <Host />
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Take me for a tour' });

describe('manual trigger', () => {
  it('focuses itself, starts the tour, and returns focus to the trigger when it ends', async () => {
    renderApp();
    setVisible(trigger(), true);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Safari/Firefox on macOS do not focus a clicked button: the trigger must do it itself.
    const focusSpy = vi.spyOn(trigger(), 'focus');
    fireEvent.click(trigger());
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    const dialog = await screen.findByRole('dialog', { name: 'Title a' });
    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('dialog', { name: 'Title b' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger()).toHaveFocus();
    expect(getActiveTourSnapshot().machine.status).toBe('idle');
  });

  it('remembers a finished tour as completed', async () => {
    renderApp();
    fireEvent.click(trigger());
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Title b' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(readTourProgress('demo', 2)?.status).toBe('completed'));
  });

  it('remembers a skipped tour as skipped', async () => {
    renderApp();
    fireEvent.click(trigger());
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Title b' });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(readTourProgress('demo', 2)?.status).toBe('skipped');
  });

  it('keeps one overlay root across steps (never re-keyed)', async () => {
    renderApp();
    fireEvent.click(trigger());
    await screen.findByRole('dialog', { name: 'Title a' });
    const root = document.querySelector('[data-slot="guided-tour"]');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Title b' });
    expect(document.querySelector('[data-slot="guided-tour"]')).toBe(root);
  });

  it('starts once from a StrictMode mount', async () => {
    const before = runs();
    renderWithLanguage(
      <StrictMode>
        <main ref={visibleRef}>
          <TourTrigger tourId={DEMO} />
        </main>
        <Host />
      </StrictMode>
    );
    fireEvent.click(trigger());
    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[data-slot="guided-tour"]')).toHaveLength(1);
    expect(runs()).toBe(before + 1);
  });

  it('shows its controls in the chosen language', async () => {
    window.localStorage.setItem('huskynote_language', 'fr');
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Faire la visite guidée' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer la visite' })).toBeInTheDocument();
  });
});

describe('counting steps', () => {
  it('leaves steps this screen skips out of "Step n of m" and the dots', async () => {
    (TOURS as Record<string, TourDefinition>).demo = {
      id: 'demo',
      version: 2,
      steps: [step('a'), step('b', { showIf: () => false }), step('c', { target: 'c-target' })],
    };
    renderApp(<div data-tour="c-target" ref={visibleRef} />);
    fireEvent.click(trigger());
    await screen.findByRole('dialog', { name: 'Title a' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="guided-tour-dot"]')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Title c' });
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});

describe('focus fallback (tours that end on another view)', () => {
  it('lands on the visible <main> when the trigger is no longer visible at the end', async () => {
    renderApp();
    const button = trigger();
    setVisible(button, true);
    fireEvent.click(button);
    await screen.findByRole('dialog');

    // The trigger's view went away: hidden, and focus() silently does nothing.
    setVisible(button, false);
    button.focus = () => {};
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const main = document.querySelector('main');
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute('tabindex', '-1');

    // tabindex is temporary: gone as soon as the landmark loses focus.
    act(() => main?.blur());
    expect(main).not.toHaveAttribute('tabindex');
  });

  it('skips hidden <main> elements and keeps an existing tabindex', async () => {
    renderWithLanguage(
      <>
        <main data-testid="hidden" />
        <main data-testid="shown" tabIndex={0} ref={visibleRef}>
          <TourTrigger tourId={DEMO} />
        </main>
        <Host />
      </>
    );
    const button = trigger();
    fireEvent.click(button);
    await screen.findByRole('dialog');
    setVisible(button, false);
    button.focus = () => {};
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('shown')).toHaveFocus();
    expect(screen.getByTestId('shown')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('hidden')).not.toHaveFocus();
  });

  it('does not touch focus when the trigger is still visible', async () => {
    renderApp();
    const button = trigger();
    setVisible(button, true);
    fireEvent.click(button);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(button).toHaveFocus();
    expect(document.querySelector('main')).not.toHaveAttribute('tabindex');
  });
});

describe('single host', () => {
  it('warns about and ignores a second mounted host', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithLanguage(
      <>
        <TourTrigger tourId={DEMO} />
        <Host />
        <Host />
      </>
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('second <TourHost />'));

    fireEvent.click(trigger());
    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[data-slot="guided-tour"]')).toHaveLength(1);
  });

  it('lets a new host take over after the first unmounts', async () => {
    const first = renderWithLanguage(<Host />);
    first.unmount();
    renderWithLanguage(
      <>
        <TourTrigger tourId={DEMO} />
        <Host />
      </>
    );
    fireEvent.click(trigger());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('aborted runs', () => {
  it('are only logged while developing, and not remembered', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithLanguage(<Host />);
    const broken: TourDefinition = { id: 'broken', version: 1, steps: [step('a', { target: 'nowhere', timeoutMs: 10 })] };
    act(() => {
      startTour(broken);
    });

    await waitFor(() => expect(info).toHaveBeenCalledWith(expect.stringContaining('"broken" aborted (no-targets)')));
    expect(readTourProgress('broken', 1)).toBeNull();
    await waitFor(() => expect(getActiveTourSnapshot().machine.status).toBe('idle'));
  });
});

describe('auto-start', () => {
  it('starts an unseen tour once with source auto', async () => {
    const before = runs();
    renderWithLanguage(
      <>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </>
    );
    expect(await screen.findByRole('dialog', { name: 'Title a' })).toBeInTheDocument();
    expect(getActiveTourSnapshot().source).toBe('auto');

    // Finishing it must not re-arm the auto-start (progress is now stored).
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => {});
    expect(runs()).toBe(before + 1);
  });

  it('starts exactly once under StrictMode', async () => {
    const before = runs();
    renderWithLanguage(
      <StrictMode>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </StrictMode>
    );
    await screen.findByRole('dialog');
    await act(async () => {});
    expect(runs()).toBe(before + 1);
  });

  it('does not restart within the same mount after Esc dismisses it', async () => {
    const before = runs();
    renderWithLanguage(
      <>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </>
    );
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => {});
    expect(runs()).toBe(before + 1);
    expect(readTourProgress('demo', 2)?.status).toBe('skipped');
  });

  it.each(['completed', 'skipped'] as const)('never starts when progress is already %s', async (status) => {
    markTourProgress('demo', 2, status);
    const before = runs();
    renderWithLanguage(
      <>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </>
    );
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(runs()).toBe(before);
  });

  it('starts again after a version bump (old progress is for the old version)', async () => {
    markTourProgress('demo', 1, 'completed');
    renderWithLanguage(
      <>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </>
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('never starts while disabled, and starts once enabled', async () => {
    const view = renderWithLanguage(
      <>
        <TourAutoStart tourId={DEMO} enabled={false} />
        <Host />
      </>
    );
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();

    view.rerender(
      <>
        <TourAutoStart tourId={DEMO} enabled />
        <Host />
      </>
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  describe('blocking conditions (fake timers, hook only)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    const status = () => getActiveTourSnapshot().machine.status;

    /** An open Radix dialog, as the app's dialogs, sheets and command palette render */
    function openRadixDialog(role = 'dialog'): HTMLElement {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', role);
      dialog.setAttribute('data-state', 'open');
      document.body.appendChild(dialog);
      return dialog;
    }

    it.each(['dialog', 'alertdialog'])('waits while a %s is open, then starts on the next re-check', (role) => {
      const dialog = openRadixDialog(role);

      renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      expect(status()).toBe('idle');
      act(() => vi.advanceTimersByTime(AUTO_START_RECHECK_MS * 3));
      expect(status()).toBe('idle');

      dialog.remove();
      act(() => vi.advanceTimersByTime(AUTO_START_RECHECK_MS));
      expect(status()).toBe('active');
      expect(getActiveTourSnapshot().source).toBe('auto');
    });

    it('is not blocked by a closed Radix dialog left in the page', () => {
      const dialog = openRadixDialog();
      dialog.setAttribute('data-state', 'closed');
      renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      expect(status()).toBe('active');
    });

    it('also waits for a native dialog[open]', () => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      document.body.appendChild(dialog);
      renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      act(() => vi.advanceTimersByTime(AUTO_START_RECHECK_MS * 2));
      expect(status()).toBe('idle');
    });

    it('gives up after 10s of a stuck dialog and stays given up', () => {
      const dialog = openRadixDialog();

      renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      act(() => vi.advanceTimersByTime(AUTO_START_GIVE_UP_MS + AUTO_START_RECHECK_MS * 4));
      dialog.remove();
      act(() => vi.advanceTimersByTime(AUTO_START_GIVE_UP_MS));
      expect(status()).toBe('idle');
    });

    it('never starts over a tour that is already running', () => {
      act(() => {
        startTour({ id: 'other', version: 1, steps: [step('x')] });
      });
      renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      act(() => vi.advanceTimersByTime(AUTO_START_RECHECK_MS * 4));
      const { definition } = getActiveTourSnapshot();
      expect(definition?.id).toBe('other');
    });

    it('clears its re-check timer on unmount', () => {
      const dialog = openRadixDialog();

      const view = renderHook(() => useTourAutoStart(DEMO, { enabled: true }));
      view.unmount();
      dialog.remove();
      act(() => vi.advanceTimersByTime(AUTO_START_GIVE_UP_MS));
      expect(status()).toBe('idle');
    });
  });
});

describe('public API (index.ts)', () => {
  it('exports exactly the public values and no engine internals', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'TourAutoStart',
        'TourTrigger',
        'resetTourProgress',
        'startTour',
        'startTourAfterDialogs',
        'useTour',
        'useTourAutoStart',
      ].sort()
    );
    for (const internal of [
      'dispatchTour',
      'setShownTarget',
      'resetActiveTourForTests',
      'useTourRunner',
      'getActiveTourSnapshot',
    ]) {
      expect(publicApi).not.toHaveProperty(internal);
    }
  });
});
