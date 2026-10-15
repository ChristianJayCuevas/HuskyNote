import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import en from '../../src/locales/en.json';
import { isTourTargetKey } from '../../src/features/guided-tour/lib/resolve-target';
import { huskynoteTour } from '../../src/features/guided-tour/tours/huskynote-tour';
import { getTour, isValidTourIdentity, TOURS } from '../../src/features/guided-tour/tours/registry';
import { TOUR_TARGETS, tourTarget } from '../../src/features/guided-tour/tours/targets';
import type { ShowViewOptions, TourStepContext } from '../../src/features/guided-tour/types';

/** Every .ts/.tsx source file under src */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);

/** Runs a step's beforeEnter and returns the view it asked for */
async function viewOf(stepId: string): Promise<[string, ShowViewOptions | undefined] | null> {
  const step = huskynoteTour.steps.find((s) => s.id === stepId)!;
  const showView = vi.fn();
  const ctx: TourStepContext = { tourId: huskynoteTour.id, stepId, index: 0, signal: new AbortController().signal, showView };
  await step.beforeEnter?.(ctx);
  return showView.mock.calls[0] ? [showView.mock.calls[0][0], showView.mock.calls[0][1]] : null;
}

describe('the HuskyNote tour', () => {
  it('walks the main flow and the new features in order', () => {
    expect(huskynoteTour.steps.map((s) => s.id)).toEqual([
      'welcome',
      'navigation',
      'profiles',
      'search',
      'voice-type',
      'notes',
      'resizable-lists',
      'teams-import',
      'recording',
      'ai-workspace',
      'ai-providers',
      'transcription',
      'finish',
    ]);
  });

  it('opens a centered welcome and ends on a centered goodbye', () => {
    expect(huskynoteTour.steps[0].target).toBeUndefined();
    expect(huskynoteTour.steps.at(-1)!.target).toBeUndefined();
  });

  it('opens the view each step needs', async () => {
    expect(await viewOf('navigation')).toEqual(['dashboard', undefined]);
    expect(await viewOf('notes')).toEqual(['notes', undefined]);
    expect(await viewOf('teams-import')).toEqual(['meetings', undefined]);
    expect(await viewOf('recording')).toEqual(['meetings', { meetingSetup: true }]);
    expect(await viewOf('ai-workspace')).toEqual(['ai-workspace', undefined]);
    expect(await viewOf('ai-providers')).toEqual(['settings', { settingsTab: 'ai' }]);
    expect(await viewOf('transcription')).toEqual(['settings', { settingsTab: 'transcription' }]);
    expect(await viewOf('finish')).toEqual(['dashboard', undefined]);
  });

  it('only targets registered, valid data-tour keys', () => {
    for (const step of huskynoteTour.steps) {
      if (step.target === undefined) continue;
      expect(typeof step.target).toBe('string');
      expect(TOUR_TARGETS).toContain(step.target);
      expect(isTourTargetKey(step.target as string)).toBe(true);
    }
  });

  it('tags every registered target somewhere in the app', () => {
    const source = sourceFiles(join(__dirname, '../../src'))
      .filter((file) => !file.includes(join('features', 'guided-tour')))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    for (const key of TOUR_TARGETS) {
      const tagged = source.includes(`tourTarget('${key}')`) || source.includes(`data-tour="${key}"`);
      expect([key, tagged]).toEqual([key, true]);
    }
  });

  it('has English text for every title and body', () => {
    for (const step of huskynoteTour.steps) {
      expect([step.title, typeof lookup(step.title)]).toEqual([step.title, 'string']);
      expect([step.body, typeof lookup(step.body as string)]).toEqual([step.body, 'string']);
    }
  });

  it('skips the sidebar and list steps where phones hide them', () => {
    const wide = huskynoteTour.steps.filter((s) => s.showIf).map((s) => s.id);
    expect(wide).toEqual(['navigation', 'profiles', 'resizable-lists']);
  });

  it('is registered under its own id with a valid identity', () => {
    expect(TOURS).toHaveProperty(huskynoteTour.id, huskynoteTour);
    expect(getTour(huskynoteTour.id)).toBe(huskynoteTour);
    expect(isValidTourIdentity(huskynoteTour.id, huskynoteTour.version)).toBe(true);
  });

  it('makes target props', () => {
    expect(tourTarget('search')).toEqual({ 'data-tour': 'search' });
  });
});
