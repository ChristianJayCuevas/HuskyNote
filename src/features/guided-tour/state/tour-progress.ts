import { useMemo, useSyncExternalStore } from 'react';

/**
 * TOUR PROGRESS — per-device "seen" state for guided tours.
 *
 * KEY `huskynote_tour_<id>_v<version>` → JSON `{ status, at }` (per device, shared by all profiles):
 * - absent → never finished: auto-start may arm the tour;
 * - `completed` (Done) / `skipped` (Skip, x, Esc, backdrop) → seen.
 *
 * Bump a definition's `version` to re-arm it; old keys are left untouched.
 *
 * A module store (`useSyncExternalStore`) so every reader agrees and another tab's write (`storage` event) updates
 * this one. Storage can throw (private mode, quota, disabled): `memory` then
 * carries the value for the rest of this tab, so a finished tour stays finished.
 */

export type TourProgressStatus = 'completed' | 'skipped';

export type TourProgress = { status: TourProgressStatus; at: string } | null;

const KEY_PREFIX = 'huskynote_tour_';
const ID_PATTERN = /^[a-z0-9-]+$/;

/** Raw value per key once a write/reset is known; wins over storage reads. `null` = known absent. */
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** The literal storage key (unvalidated; the read/write helpers validate first). */
export function tourStorageKey(id: string, version: number): string {
  return `${KEY_PREFIX}${id}_v${version}`;
}

/** Storage key for a tour, or `null` (after a `console.error`) when `id`/`version` are invalid. */
function keyFor(id: string, version: number): string | null {
  if (!ID_PATTERN.test(id) || !Number.isInteger(version) || version < 1) {
    console.error(`[guided-tour] invalid tour id/version: ${JSON.stringify({ id, version })}`);
    return null;
  }
  return tourStorageKey(id, version);
}

function readRaw(key: string): string | null {
  const known = memory.get(key);
  if (known !== undefined) return known;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage unavailable: behave as unseen until this tab writes.
    return null;
  }
}

function writeRaw(key: string, raw: string | null) {
  memory.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch (error) {
    // `memory` keeps the value for this tab; only persistence is lost.
    console.warn('[guided-tour] could not persist tour progress', error);
  }
  emit();
}

function parseProgress(raw: string | null): TourProgress {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object') {
      const { status, at } = value as { status?: unknown; at?: unknown };
      if ((status === 'completed' || status === 'skipped') && typeof at === 'string') return { status, at };
    }
  } catch {
    // Corrupt value: read as unseen (the next write replaces it).
  }
  return null;
}

function onStorage(event: StorageEvent) {
  if (event.key === null) memory.clear();
  else if (event.key.startsWith(KEY_PREFIX)) memory.delete(event.key);
  else return;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Current progress; `null` when absent, corrupt, or the id/version is invalid. */
export function readTourProgress(id: string, version: number): TourProgress {
  const key = keyFor(id, version);
  return key ? parseProgress(readRaw(key)) : null;
}

export function markTourProgress(id: string, version: number, status: TourProgressStatus): void {
  const key = keyFor(id, version);
  if (!key) return;
  writeRaw(key, JSON.stringify({ status, at: new Date().toISOString() }));
}

/** Forget this tour's progress (re-arms it). */
export function resetTourProgress(id: string, version: number): void {
  const key = keyFor(id, version);
  if (!key) return;
  writeRaw(key, null);
}

/**
 * Reactive progress. `undefined` = server / pre-hydration (never auto-start on it);
 * `null` = unseen; otherwise the stored status.
 */
export function useTourProgress(id: string, version: number): TourProgress | undefined {
  const key = useMemo(() => keyFor(id, version), [id, version]);
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => (key ? readRaw(key) : null),
    () => undefined
  );
  return useMemo(() => (raw === undefined ? undefined : parseProgress(raw)), [raw]);
}

/** Test-only: forget module state between tests. */
export function resetTourProgressForTests(): void {
  memory.clear();
  emit();
}
