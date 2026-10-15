import type { ReactNode } from 'react';
import type { ViewType } from '@/context/workspace-context';
import type { SettingsTab } from '@/views/settings-tabs';

export type TourTarget = string | (() => Element | null);

export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

/** Where a step wants the app to be before its target is looked up. */
export interface ShowViewOptions {
  /** Open this Settings tab (with `view: 'settings'`). */
  settingsTab?: SettingsTab;
  /** Open the meeting setup screen (with `view: 'meetings'`), where the recording controls live. */
  meetingSetup?: boolean;
}

/** Switches the app's main view (HuskyNote has no router). */
export type ShowView = (view: ViewType, options?: ShowViewOptions) => void;

export interface TourStepContext {
  tourId: string;
  stepId: string;
  index: number;
  signal: AbortSignal;
  /** Switch views from `beforeEnter`; the runner then waits for the view before finding the target. */
  showView: ShowView;
}

export interface TourStep {
  id: string;
  target?: TourTarget;
  /** Translation key (or literal text) for the small line above the title. */
  eyebrow?: string;
  /** Translation key (or literal text). */
  title: string;
  /** Translation key (or literal text) when a string; other nodes render as given. */
  body: ReactNode;
  placement?: TourPlacement;
  interactive?: boolean;
  onMissing?: 'skip' | 'center';
  timeoutMs?: number;
  /** Show the step only when this returns true (say, a sidebar that phones hide); otherwise skip it at once. */
  showIf?: () => boolean;
  /** Prepare the step, usually `ctx.showView(...)` to open the view its target lives in. */
  beforeEnter?: (ctx: TourStepContext) => void | Promise<void>;
  onExit?: (ctx: TourStepContext) => void;
}

export type TourDismissReason = 'skip-button' | 'close-button' | 'escape' | 'backdrop';

export type TourEndReason = 'done' | TourDismissReason | 'navigation' | 'no-targets' | 'error';

export type TourOutcome = 'completed' | 'skipped' | 'aborted';

export type TourStartSource = 'auto' | 'manual';

export interface TourDefinition {
  id: string;
  version: number;
  steps: readonly TourStep[];
  onComplete?: () => void;
  onSkip?: (info: { index: number; stepId: string; reason: TourEndReason }) => void;
}
