import { describe, expect, it } from 'vitest';
import type { TourEndReason } from '../../src/features/guided-tour/types';
import {
  INITIAL_TOUR_STATE,
  outcomeForReason,
  tourReducer,
  type TourMachineAction,
  type TourMachineState,
} from '../../src/features/guided-tour/state/tour-machine';

function run(actions: TourMachineAction[], from: TourMachineState = INITIAL_TOUR_STATE): TourMachineState {
  return actions.reduce(tourReducer, from);
}

function started(stepCount = 3, startIndex?: number): TourMachineState {
  return run([{ type: 'start', tourId: 't', stepCount, startIndex }]);
}

/** Active tour showing step `index`, reached by walking forward. */
function showing(stepCount: number, index: number): TourMachineState {
  let s = started(stepCount);
  for (let i = 0; i < index; i++) {
    s = run([{ type: 'step-ready', index: i }, { type: 'next' }], s);
  }
  return run([{ type: 'step-ready', index }], s);
}

describe('start', () => {
  it('idle -> active entering, direction 1', () => {
    expect(started(3)).toEqual({
      status: 'active',
      tourId: 't',
      stepCount: 3,
      index: 0,
      direction: 1,
      phase: 'entering',
      shownCount: 0,
    });
  });

  it('honors a valid startIndex, falls back to 0 for invalid', () => {
    expect(started(3, 2)).toMatchObject({ index: 2 });
    expect(started(3, 3)).toMatchObject({ index: 0 });
    expect(started(3, -1)).toMatchObject({ index: 0 });
    expect(started(3, 1.5)).toMatchObject({ index: 0 });
  });

  it('stepCount 0 (or invalid) -> ended aborted/no-targets', () => {
    for (const stepCount of [0, -2, 1.5, Number.NaN]) {
      expect(started(stepCount)).toEqual({
        status: 'ended',
        tourId: 't',
        index: 0,
        outcome: 'aborted',
        reason: 'no-targets',
        shownCount: 0,
      });
    }
  });

  it('allowed from ended', () => {
    const ended = run([{ type: 'start', tourId: 'a', stepCount: 0 }]);
    expect(ended.status).toBe('ended');
    expect(run([{ type: 'start', tourId: 'b', stepCount: 2 }], ended)).toMatchObject({
      status: 'active',
      tourId: 'b',
      index: 0,
    });
  });

  it('ignored while active', () => {
    const s = started(3);
    expect(tourReducer(s, { type: 'start', tourId: 'x', stepCount: 5 })).toBe(s);
  });
});

describe('step-ready', () => {
  it('entering -> showing, shownCount + 1', () => {
    expect(run([{ type: 'step-ready', index: 0 }], started())).toMatchObject({
      phase: 'showing',
      shownCount: 1,
    });
  });

  it('ignores stale index', () => {
    const s = started();
    expect(tourReducer(s, { type: 'step-ready', index: 1 })).toBe(s);
  });

  it('ignores when already showing (no double count)', () => {
    const s = showing(3, 0);
    expect(tourReducer(s, { type: 'step-ready', index: 0 })).toBe(s);
  });

  it('ignored from idle', () => {
    expect(tourReducer(INITIAL_TOUR_STATE, { type: 'step-ready', index: 0 })).toBe(INITIAL_TOUR_STATE);
  });
});

describe('next / back', () => {
  it('ignored while entering', () => {
    const s = started();
    expect(tourReducer(s, { type: 'next' })).toBe(s);
    expect(tourReducer(s, { type: 'back' })).toBe(s);
  });

  it('ignored from idle/ended', () => {
    expect(tourReducer(INITIAL_TOUR_STATE, { type: 'next' })).toBe(INITIAL_TOUR_STATE);
    const ended = started(0);
    expect(tourReducer(ended, { type: 'next' })).toBe(ended);
    expect(tourReducer(ended, { type: 'back' })).toBe(ended);
  });

  it('next advances, direction 1, entering', () => {
    expect(tourReducer(showing(3, 0), { type: 'next' })).toMatchObject({
      index: 1,
      direction: 1,
      phase: 'entering',
      shownCount: 1,
    });
  });

  it('double next only advances once', () => {
    const s = run([{ type: 'next' }, { type: 'next' }], showing(3, 0));
    expect(s).toMatchObject({ index: 1, phase: 'entering' });
  });

  it('back at 0 is a no-op', () => {
    const s = showing(3, 0);
    expect(tourReducer(s, { type: 'back' })).toBe(s);
  });

  it('back goes to previous with direction -1', () => {
    expect(tourReducer(showing(3, 1), { type: 'back' })).toMatchObject({
      index: 0,
      direction: -1,
      phase: 'entering',
    });
  });

  it('next on last -> ended completed/done', () => {
    expect(tourReducer(showing(3, 2), { type: 'next' })).toEqual({
      status: 'ended',
      tourId: 't',
      index: 2,
      outcome: 'completed',
      reason: 'done',
      shownCount: 3,
    });
  });
});

describe('step-missing', () => {
  it('ignores stale index and non-entering phase', () => {
    const entering = started();
    expect(tourReducer(entering, { type: 'step-missing', index: 2, policy: 'skip' })).toBe(entering);
    const shown = showing(3, 0);
    expect(tourReducer(shown, { type: 'step-missing', index: 0, policy: 'skip' })).toBe(shown);
  });

  it('center -> showing, counts as shown', () => {
    expect(run([{ type: 'step-missing', index: 0, policy: 'center' }], started())).toMatchObject({
      phase: 'showing',
      index: 0,
      shownCount: 1,
    });
  });

  it('skip forward moves index by direction', () => {
    expect(run([{ type: 'step-missing', index: 0, policy: 'skip' }], started())).toMatchObject({
      index: 1,
      direction: 1,
      phase: 'entering',
      shownCount: 0,
    });
  });

  it('skip backward moves index by -1', () => {
    const s = run([{ type: 'back' }], showing(3, 2));
    expect(tourReducer(s, { type: 'step-missing', index: 1, policy: 'skip' })).toMatchObject({
      index: 0,
      direction: -1,
      phase: 'entering',
    });
  });

  it('skip past end with shown steps -> completed/done', () => {
    const s = run([{ type: 'next' }], showing(2, 0));
    expect(tourReducer(s, { type: 'step-missing', index: 1, policy: 'skip' })).toEqual({
      status: 'ended',
      tourId: 't',
      index: 1,
      outcome: 'completed',
      reason: 'done',
      shownCount: 1,
    });
  });

  it('skip past end with nothing shown -> aborted/no-targets', () => {
    const s = run([{ type: 'step-missing', index: 0, policy: 'skip' }], started(2));
    expect(tourReducer(s, { type: 'step-missing', index: 1, policy: 'skip' })).toEqual({
      status: 'ended',
      tourId: 't',
      index: 1,
      outcome: 'aborted',
      reason: 'no-targets',
      shownCount: 0,
    });
  });

  it('skip below 0 flips direction to 1 and lands on index 1', () => {
    const s = run([{ type: 'back' }], showing(3, 1));
    expect(s).toMatchObject({ index: 0, direction: -1 });
    expect(tourReducer(s, { type: 'step-missing', index: 0, policy: 'skip' })).toMatchObject({
      index: 1,
      direction: 1,
      phase: 'entering',
    });
  });

  it('skip below 0 with no index 1 -> treated like past end', () => {
    const s: TourMachineState = {
      status: 'active',
      tourId: 't',
      stepCount: 1,
      index: 0,
      direction: -1,
      phase: 'entering',
      shownCount: 1,
    };
    expect(tourReducer(s, { type: 'step-missing', index: 0, policy: 'skip' })).toMatchObject({
      status: 'ended',
      outcome: 'completed',
      reason: 'done',
    });
    expect(tourReducer({ ...s, shownCount: 0 }, { type: 'step-missing', index: 0, policy: 'skip' })).toMatchObject({
      status: 'ended',
      outcome: 'aborted',
      reason: 'no-targets',
    });
  });
});

describe('end / reset', () => {
  it.each(['skip-button', 'close-button', 'escape', 'backdrop'] as const)('dismiss %s -> skipped', (reason) => {
    expect(tourReducer(showing(3, 1), { type: 'end', reason })).toEqual({
      status: 'ended',
      tourId: 't',
      index: 1,
      outcome: 'skipped',
      reason,
      shownCount: 2,
    });
  });

  it('navigation/error -> aborted, also while entering', () => {
    expect(tourReducer(started(), { type: 'end', reason: 'navigation' })).toMatchObject({
      outcome: 'aborted',
      reason: 'navigation',
      index: 0,
    });
    expect(tourReducer(started(), { type: 'end', reason: 'error' })).toMatchObject({
      outcome: 'aborted',
      reason: 'error',
    });
  });

  it('end ignored from idle/ended', () => {
    expect(tourReducer(INITIAL_TOUR_STATE, { type: 'end', reason: 'escape' })).toBe(INITIAL_TOUR_STATE);
    const ended = started(0);
    expect(tourReducer(ended, { type: 'end', reason: 'escape' })).toBe(ended);
  });

  it('reset -> idle from any state', () => {
    expect(tourReducer(started(), { type: 'reset' })).toEqual({
      status: 'idle',
    });
    expect(tourReducer(started(0), { type: 'reset' })).toEqual({
      status: 'idle',
    });
  });
});

describe('outcomeForReason', () => {
  it('maps every reason', () => {
    const table: Record<TourEndReason, string> = {
      done: 'completed',
      'skip-button': 'skipped',
      'close-button': 'skipped',
      escape: 'skipped',
      backdrop: 'skipped',
      navigation: 'aborted',
      error: 'aborted',
      'no-targets': 'aborted',
    };
    for (const [reason, outcome] of Object.entries(table)) {
      expect(outcomeForReason(reason as TourEndReason)).toBe(outcome);
    }
  });
});
