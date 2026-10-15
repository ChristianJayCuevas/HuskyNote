import type { TourDefinition } from '../types';
import { huskynoteTour } from './huskynote-tour';

const TOUR_ID_PATTERN = /^[a-z0-9-]+$/;

/**
 * Typed registry of shipped tours. Key MUST equal the definition's `id`
 * (checked at runtime in dev by `getTour`). Add a tour here, then
 * `startTour("<id>")` type-checks against `TourId`.
 */
export const TOURS = {
  huskynote: huskynoteTour,
} satisfies Record<string, TourDefinition>;

export type TourId = keyof typeof TOURS;

/**
 * Boundary check for ids that reach storage keys: lowercase kebab id and a
 * positive-integer version. Logs `console.error` and returns false otherwise.
 */
export function isValidTourIdentity(id: unknown, version: unknown): boolean {
  const valid =
    typeof id === 'string' &&
    TOUR_ID_PATTERN.test(id) &&
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version >= 1;
  if (!valid) {
    console.error(
      `[guided-tour] invalid tour id/version: ${JSON.stringify({ id, version })} (id must match ${TOUR_ID_PATTERN}, version a positive integer)`
    );
  }
  return valid;
}

/** Registered definition for `id`, or `undefined` when unknown. */
export function getTour(id: string): TourDefinition | undefined {
  const registry: Record<string, TourDefinition> = TOURS;
  if (!Object.prototype.hasOwnProperty.call(registry, id)) return undefined;
  const definition = registry[id];
  if (import.meta.env.DEV && definition.id !== id) {
    console.error(`[guided-tour] registry key "${id}" does not match its definition id "${definition.id}"`);
  }
  return definition;
}
