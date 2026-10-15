/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markTourProgress,
  readTourProgress,
  resetTourProgress,
  resetTourProgressForTests,
  tourStorageKey,
  useTourProgress,
} from '../../src/features/guided-tour/state/tour-progress';

const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (realStorage) Object.defineProperty(window, 'localStorage', realStorage);
});

beforeEach(() => {
  window.localStorage.clear();
  resetTourProgressForTests();
});

function breakStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('denied', 'SecurityError');
    },
  });
}

describe('key + validation', () => {
  it('builds huskynote_tour_<id>_v<version>', () => {
    expect(tourStorageKey('workspace', 2)).toBe('huskynote_tour_workspace_v2');
  });

  it.each([
    ['Bad Id', 1],
    ['', 1],
    ['a_b', 1],
    ['ok', 0],
    ['ok', -1],
    ['ok', 1.5],
    ['ok', Number.NaN],
  ])('rejects id=%j version=%j with console.error and no-op', (id, version) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    markTourProgress(id, version, 'completed');
    resetTourProgress(id, version);
    expect(readTourProgress(id, version)).toBeNull();
    expect(error).toHaveBeenCalledTimes(3);
    expect(window.localStorage.length).toBe(0);
  });
});

describe('read / mark / reset', () => {
  it('reads null when absent', () => {
    expect(readTourProgress('workspace', 1)).toBeNull();
  });

  it('writes JSON { status, at } and reads it back', () => {
    markTourProgress('workspace', 1, 'completed');
    const raw = window.localStorage.getItem('huskynote_tour_workspace_v1');
    expect(JSON.parse(raw ?? 'null')).toEqual({ status: 'completed', at: expect.any(String) });
    const progress = readTourProgress('workspace', 1);
    expect(progress?.status).toBe('completed');
    expect(Number.isNaN(Date.parse(progress?.at ?? ''))).toBe(false);
  });

  it('stores skipped distinctly', () => {
    markTourProgress('workspace', 1, 'skipped');
    expect(readTourProgress('workspace', 1)?.status).toBe('skipped');
  });

  it.each(['not json', 'null', '"completed"', '{"status":"nope","at":"x"}', '{"status":"completed"}'])(
    'reads null for corrupt value %s',
    (raw) => {
      window.localStorage.setItem('huskynote_tour_workspace_v1', raw);
      expect(readTourProgress('workspace', 1)).toBeNull();
    }
  );

  it('resetTourProgress removes the key', () => {
    markTourProgress('workspace', 1, 'completed');
    resetTourProgress('workspace', 1);
    expect(window.localStorage.getItem('huskynote_tour_workspace_v1')).toBeNull();
    expect(readTourProgress('workspace', 1)).toBeNull();
  });

  it('bumping the version reads null and leaves the old key untouched', () => {
    markTourProgress('workspace', 1, 'completed');
    expect(readTourProgress('workspace', 2)).toBeNull();
    expect(readTourProgress('workspace', 1)?.status).toBe('completed');
    expect(window.localStorage.getItem('huskynote_tour_workspace_v1')).not.toBeNull();
  });
});

describe('throwing storage', () => {
  it('keeps the value in memory and warns on write', () => {
    breakStorage();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    markTourProgress('workspace', 1, 'skipped');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(readTourProgress('workspace', 1)?.status).toBe('skipped');
    resetTourProgress('workspace', 1);
    expect(readTourProgress('workspace', 1)).toBeNull();
  });

  it('reads null when storage throws and nothing was written', () => {
    breakStorage();
    expect(readTourProgress('workspace', 1)).toBeNull();
  });
});

describe('useTourProgress', () => {
  it('returns undefined for the server snapshot', () => {
    let seen: unknown = 'unset';
    function Probe() {
      seen = useTourProgress('workspace', 1);
      return null;
    }
    renderToString(createElement(Probe));
    expect(seen).toBeUndefined();
  });

  it('returns null when unseen after hydration', () => {
    const { result } = renderHook(() => useTourProgress('workspace', 1));
    expect(result.current).toBeNull();
  });

  it('returns existing progress on mount', () => {
    markTourProgress('workspace', 1, 'completed');
    const { result } = renderHook(() => useTourProgress('workspace', 1));
    expect(result.current?.status).toBe('completed');
  });

  it('updates on a same-tab write and reset, and keeps a stable snapshot', () => {
    const { result, rerender } = renderHook(() => useTourProgress('workspace', 1));
    expect(result.current).toBeNull();
    act(() => markTourProgress('workspace', 1, 'skipped'));
    expect(result.current?.status).toBe('skipped');
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => resetTourProgress('workspace', 1));
    expect(result.current).toBeNull();
  });

  it('re-reads when the version prop changes', () => {
    markTourProgress('workspace', 1, 'completed');
    const { result, rerender } = renderHook(({ version }) => useTourProgress('workspace', version), {
      initialProps: { version: 1 },
    });
    expect(result.current?.status).toBe('completed');
    rerender({ version: 2 });
    expect(result.current).toBeNull();
  });

  it('updates on a cross-tab storage event', () => {
    const { result } = renderHook(() => useTourProgress('workspace', 1));
    expect(result.current).toBeNull();
    markTourProgress('workspace', 1, 'skipped');
    // Another tab wrote `completed`; jsdom doesn't fire storage events for same-window writes.
    window.localStorage.setItem(
      'huskynote_tour_workspace_v1',
      JSON.stringify({ status: 'completed', at: '2026-01-01T00:00:00.000Z' })
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'huskynote_tour_workspace_v1' }));
    });
    expect(result.current).toEqual({ status: 'completed', at: '2026-01-01T00:00:00.000Z' });
  });

  it('ignores storage events for unrelated keys and clears memory on key=null', () => {
    markTourProgress('workspace', 1, 'completed');
    const { result } = renderHook(() => useTourProgress('workspace', 1));
    window.localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    });
    expect(result.current?.status).toBe('completed');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current).toBeNull();
  });

  it('removes its storage listener after the last unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useTourProgress('workspace', 1));
    expect(add.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
    unmount();
    expect(remove.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
  });

  it('works with throwing storage via memory', () => {
    breakStorage();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTourProgress('workspace', 1));
    expect(result.current).toBeNull();
    act(() => markTourProgress('workspace', 1, 'completed'));
    expect(result.current?.status).toBe('completed');
  });

  it('returns null for an invalid id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useTourProgress('Bad Id', 1));
    expect(result.current).toBeNull();
  });
});
