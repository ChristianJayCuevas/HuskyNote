/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewType } from '../../src/context/workspace-context';
import { resetActiveTourForTests, startTour, stopTour } from '../../src/features/guided-tour/state/active-tour-store';
import { readTourProgress, resetTourProgressForTests } from '../../src/features/guided-tour/state/tour-progress';
import type { ShowView, TourDefinition, TourStep } from '../../src/features/guided-tour/types';
import { useTour } from '../../src/features/guided-tour/hooks/use-tour';
import { type TourLifecycleEvent, useTourRunner } from '../../src/features/guided-tour/hooks/use-tour-runner';

beforeEach(() => {
  window.localStorage.clear();
  resetTourProgressForTests();
  resetActiveTourForTests();
  views.active = 'dashboard';
  views.show.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** jsdom has no layout: getClientRects() is always empty, so stub it to make targets visible. */
function addTarget(key: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour', key);
  el.getClientRects = () => [{}] as unknown as DOMRectList;
  act(() => {
    document.body.appendChild(el);
  });
  return el;
}

function step(id: string, extra: Partial<TourStep> = {}): TourStep {
  return { id, title: id, body: id, ...extra };
}

function makeDefinition(steps: TourStep[], extra: Partial<TourDefinition> = {}): TourDefinition {
  return { id: 'demo', version: 1, steps, ...extra };
}

/** The app's main view as the runner sees it; tests switch it and rerender. */
const views = { active: 'dashboard' as ViewType, show: vi.fn<ShowView>() };

function setup(definition: TourDefinition, wrapper?: typeof StrictMode) {
  const events: TourLifecycleEvent[] = [];
  const view = renderHook(
    () => useTourRunner({ activeView: views.active, showView: views.show, onLifecycle: (event) => events.push(event) }),
    { wrapper }
  );
  const start = (source: 'auto' | 'manual' = 'manual') => {
    let ok = false;
    act(() => {
      ok = startTour(definition, { source });
    });
    return ok;
  };
  return { ...view, events, start };
}

describe('start + show', () => {
  it('enters, resolves the target, then shows step 1', async () => {
    const one = addTarget('one');
    const { result, events, start } = setup(makeDefinition([step('a', { target: 'one' }), step('b')]));
    expect(result.current.step).toBeNull();

    expect(start('auto')).toBe(true);
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.step?.id).toBe('a');
    expect(result.current.index).toBe(0);
    expect(result.current.total).toBe(2);
    expect(result.current.target).toBe(one);
    expect(events).toEqual([{ type: 'started', tourId: 'demo', tourVersion: 1, source: 'auto' }]);
  });

  it('shows a target-less step with target null', async () => {
    const { result, start } = setup(makeDefinition([step('a')]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.target).toBeNull();
  });

  it('waits for a target that mounts later', async () => {
    const { result, start } = setup(makeDefinition([step('a', { target: 'late' })]));
    start();
    expect(result.current.phase).toBe('entering');
    const late = addTarget('late');
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.target).toBe(late);
  });
});

describe('switching views', () => {
  it('opens the view from beforeEnter, waits until it is showing, then for the target', async () => {
    addTarget('one');
    // Also on the old view (like the top bar): must not count until the new view is open
    addTarget('shared');
    const def = makeDefinition([
      step('a', { target: 'one' }),
      step('b', { target: 'shared', beforeEnter: (ctx) => ctx.showView('notes') }),
    ]);
    const { result, rerender, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(views.show).not.toHaveBeenCalled();

    act(() => result.current.next());
    expect(views.show).toHaveBeenCalledWith('notes', undefined);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(result.current.phase).toBe('entering');
    expect(result.current.target).toBeNull();

    views.active = 'notes';
    rerender();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.index).toBe(1);
  });

  it('does not switch when the view is already open', async () => {
    const { result, start } = setup(makeDefinition([step('a', { beforeEnter: (ctx) => ctx.showView('dashboard') })]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(views.show).not.toHaveBeenCalled();
  });

  it('passes options through even when the view is already open (a Settings tab)', async () => {
    views.active = 'settings';
    const def = makeDefinition([
      step('a', { beforeEnter: (ctx) => ctx.showView('settings', { settingsTab: 'transcription' }) }),
    ]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(views.show).toHaveBeenCalledWith('settings', { settingsTab: 'transcription' });
  });

  it('switches once under StrictMode effect replay', async () => {
    const def = makeDefinition([step('a', { beforeEnter: (ctx) => ctx.showView('notes') })]);
    const { result, rerender, start } = setup(def, StrictMode);
    start();
    await waitFor(() => expect(views.show).toHaveBeenCalled());
    views.active = 'notes';
    rerender();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(views.show).toHaveBeenCalledTimes(1);
  });

  it('applies the missing policy when the view never opens', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = makeDefinition([
      step('a'),
      step('b', { timeoutMs: 20, beforeEnter: (ctx) => ctx.showView('notes') }),
      step('c'),
    ]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.step?.id).toBe('c'));
  });

  it("aborts with 'navigation' when the user switches views while a step is showing", async () => {
    const { result, events, rerender, start } = setup(makeDefinition([step('a'), step('b')]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    views.active = 'meetings';
    rerender();
    await waitFor(() => expect(result.current.step).toBeNull());
    expect(events.at(-1)).toMatchObject({ type: 'aborted', reason: 'navigation' });
    expect(readTourProgress('demo', 1)).toBeNull();
  });
});

describe('missing targets', () => {
  it('skips a step whose target never appears (default policy)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = makeDefinition([step('a'), step('b', { target: 'gone', timeoutMs: 20 }), step('c')]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.step?.id).toBe('c'));
    expect(result.current.phase).toBe('showing');
  });

  it('centers a missing target with onMissing: center', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = makeDefinition([step('a', { target: 'gone', timeoutMs: 20, onMissing: 'center' })]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.step?.id).toBe('a');
    expect(result.current.target).toBeNull();
  });

  it('aborts with no-targets when every step is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = makeDefinition([step('a', { target: 'gone', timeoutMs: 10 })]);
    const { result, events, start } = setup(def);
    start();
    await waitFor(() => expect(events.at(-1)?.type).toBe('aborted'));
    expect(events.at(-1)).toMatchObject({ reason: 'no-targets', stepsShown: 0 });
    expect(result.current.step).toBeNull();
    expect(readTourProgress('demo', 1)).toBeNull();
  });

  it('treats an invalid string target key as missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = makeDefinition([step('a', { target: 'bad"key' }), step('b')]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.step?.id).toBe('b'));
  });
});

describe('showIf', () => {
  it('skips a step at once when showIf is false, without calling beforeEnter', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const beforeEnter = vi.fn();
    const def = makeDefinition([
      step('a'),
      step('b', { showIf: () => false, beforeEnter, target: 'never', timeoutMs: 5000 }),
      step('c'),
    ]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    const t0 = Date.now();
    act(() => result.current.next());
    await waitFor(() => expect(result.current.step?.id).toBe('c'));
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(beforeEnter).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows the step when showIf is true', async () => {
    const { result, start } = setup(makeDefinition([step('a', { showIf: () => true })]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.step?.id).toBe('a');
  });
});

describe('hooks', () => {
  it('awaits beforeEnter before resolving the target, and onExit fires once on leaving', async () => {
    const order: string[] = [];
    const def = makeDefinition([
      step('a', {
        target: 'one',
        beforeEnter: async () => {
          await Promise.resolve();
          order.push('beforeEnter');
          addTarget('one');
        },
        onExit: (ctx) => order.push(`onExit:${ctx.stepId}:${ctx.index}`),
      }),
      step('b'),
    ]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(order).toEqual(['beforeEnter']);
    expect(result.current.target).toHaveAttribute('data-tour', 'one');

    act(() => result.current.next());
    await waitFor(() => expect(result.current.step?.id).toBe('b'));
    expect(order).toEqual(['beforeEnter', 'onExit:a:0']);
  });

  it('logs a beforeEnter failure and applies the missing policy', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = makeDefinition([
      step('a', {
        beforeEnter: () => {
          throw new Error('boom');
        },
      }),
      step('b'),
    ]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.step?.id).toBe('b'));
    expect(error).toHaveBeenCalled();
  });

  it('fires onExit when the tour ends from a shown step', async () => {
    const onExit = vi.fn();
    const { result, start } = setup(makeDefinition([step('a', { onExit })]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.dismiss('escape'));
    await waitFor(() => expect(result.current.step).toBeNull());
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('ending', () => {
  it('Done persists completed, fires onComplete only, then allows a restart', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const def = makeDefinition([step('a'), step('b')], { onComplete, onSkip });
    const { result, events, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.index).toBe(1));
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());

    await waitFor(() => expect(result.current.step).toBeNull());
    expect(readTourProgress('demo', 1)?.status).toBe('completed');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['started', 'completed']);
    expect(events[1]).toMatchObject({ type: 'completed', stepsShown: 2 });
    expect(start()).toBe(true);
  });

  it('Skip persists skipped, fires onSkip({index, stepId, reason}) only', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const def = makeDefinition([step('a'), step('b')], { onComplete, onSkip });
    const { result, events, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.index).toBe(1));
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.dismiss('skip-button'));

    await waitFor(() => expect(result.current.step).toBeNull());
    expect(readTourProgress('demo', 1)?.status).toBe('skipped');
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledWith({ index: 1, stepId: 'b', reason: 'skip-button' });
    expect(onComplete).not.toHaveBeenCalled();
    expect(events[1]).toMatchObject({
      type: 'skipped',
      stepIndex: 1,
      stepId: 'b',
      reason: 'skip-button',
      stepsShown: 2,
    });
  });

  it('treats skip-past-end as Done (completed + onComplete)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onComplete = vi.fn();
    const def = makeDefinition([step('a'), step('b', { target: 'gone', timeoutMs: 10 })], { onComplete });
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.step).toBeNull());
    expect(readTourProgress('demo', 1)?.status).toBe('completed');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('a throwing onComplete is logged and the tour still resets', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = makeDefinition([step('a')], {
      onComplete: () => {
        throw new Error('boom');
      },
    });
    const { result, events, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.step).toBeNull());
    expect(error).toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['started', 'completed']);
    expect(readTourProgress('demo', 1)?.status).toBe('completed');
    expect(start()).toBe(true);
  });

  it('a throwing onSkip is logged, the skipped lifecycle event still fires', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = makeDefinition([step('a')], {
      onSkip: () => {
        throw new Error('boom');
      },
    });
    const { result, events, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => result.current.dismiss('escape'));
    await waitFor(() => expect(result.current.step).toBeNull());
    expect(error).toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['started', 'skipped']);
    expect(start()).toBe(true);
  });
});

describe('races', () => {
  it('rapid double-Next moves exactly one step', async () => {
    const { result, start } = setup(makeDefinition([step('a'), step('b'), step('c')]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    act(() => {
      result.current.next();
      result.current.next();
    });
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.index).toBe(1);
  });

  it("a restarted tour ignores a late result of the ended run's pass", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = makeDefinition([step('a', { target: 'late', timeoutMs: 5000 })]);
    const second = makeDefinition([step('a', { target: 'other', timeoutMs: 5000 })], { id: 'second' });
    const { result, start } = setup(first);
    start();
    expect(result.current.phase).toBe('entering');
    act(() => stopTour('escape'));
    await waitFor(() => expect(result.current.step).toBeNull());

    act(() => {
      startTour(second);
    });
    expect(result.current.step?.id).toBe('a');
    expect(result.current.phase).toBe('entering');

    // The first run's target arrives: must not satisfy the second run (same index 0).
    addTarget('late');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.phase).toBe('entering');

    const other = addTarget('other');
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    expect(result.current.target).toBe(other);
  });
});

describe('targetLost', () => {
  it('re-resolves a replaced target element', async () => {
    const original = addTarget('one');
    const { result, start } = setup(makeDefinition([step('a', { target: 'one', timeoutMs: 50 })]));
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    original.getClientRects = () => [] as unknown as DOMRectList;
    const replacement = addTarget('one');
    act(() => result.current.targetLost());
    await waitFor(() => expect(result.current.target).toBe(replacement));
  });

  it('default policy skips the step when the target stays gone', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = addTarget('one');
    const def = makeDefinition([step('a', { target: 'one', timeoutMs: 20 }), step('b')]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    original.getClientRects = () => [] as unknown as DOMRectList;
    act(() => result.current.targetLost());
    await waitFor(() => expect(result.current.step?.id).toBe('b'));
  });

  it('onMissing: center keeps the step with target null', async () => {
    const original = addTarget('one');
    const def = makeDefinition([step('a', { target: 'one', timeoutMs: 20, onMissing: 'center' }), step('b')]);
    const { result, start } = setup(def);
    start();
    await waitFor(() => expect(result.current.phase).toBe('showing'));
    original.getClientRects = () => [] as unknown as DOMRectList;
    act(() => result.current.targetLost());
    await waitFor(() => expect(result.current.target).toBeNull());
    expect(result.current.step?.id).toBe('a');
    expect(result.current.phase).toBe('showing');
  });
});

describe('startTour / stopTour / useTour', () => {
  it('returns false while active or ended, and for unknown or invalid ids', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const def = makeDefinition([step('a')]);
    expect(startTour(def)).toBe(true);
    expect(startTour(def)).toBe(false); // active

    stopTour('escape'); // -> ended (no runner mounted, so no wrap-up)
    expect(startTour(def)).toBe(false); // ended counts as busy

    resetActiveTourForTests();
    expect(startTour('nope' as never)).toBe(false);
    expect(startTour({ ...def, id: 'Bad Id' })).toBe(false);
    expect(startTour({ ...def, version: 0 })).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it('useTour reports the active tour', () => {
    const { result } = renderHook(() => useTour());
    expect(result.current).toMatchObject({ isActive: false, activeTourId: null });
    act(() => {
      result.current.start(makeDefinition([step('a')]));
    });
    expect(result.current).toMatchObject({ isActive: true, activeTourId: 'demo' });
    act(() => result.current.stop());
    expect(result.current.isActive).toBe(false);
  });
});
