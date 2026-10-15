/**
 * `data-tour` keys for the shipped tours. Every key must match `/^[a-z0-9-]+$/` and be tagged
 * somewhere in the app (both checked in `tests/guided-tour/huskynote-tour.test.ts`).
 *
 * Usage: `<button {...tourTarget('search')}>`.
 */
export const TOUR_TARGETS = [
  'sidebar-nav',
  'profile-switcher',
  'search',
  'voice-type',
  'new-note',
  'notes-list',
  'meetings-import',
  'meeting-record',
  'ai-workspace-composer',
  'ai-providers',
  'transcription-setup',
] as const;

export type TourTargetKey = (typeof TOUR_TARGETS)[number];

/** Props that mark an element as a tour target. */
export function tourTarget(key: TourTargetKey): { 'data-tour': TourTargetKey } {
  return { 'data-tour': key };
}
