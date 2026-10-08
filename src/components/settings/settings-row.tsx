/**
 * Exports: SettingsRow, SettingsStatus, SettingsStep
 *
 * Local building blocks for the Settings page (not shared ui primitives).
 * SettingsRow({ label, description?, htmlFor?, stacked?, className, children }):
 *   Notion-style settings row (py-4, divider below except on the last row). Label text-sm font-medium,
 *   description text-xs muted, control on the right from sm up (stacked = control below the text).
 *   Wrap a group of rows in a plain <div> so the first/last rows drop their outer padding and divider.
 * SettingsStatus({ tone, children }): StatusDot + short muted status text for section headers.
 * SettingsStep({ step, title, caption?, children }): numbered step row for setup guides (use inside <ol>).
 * optionCardClass: selectable option card (provider, engine, model); chosen = aria-checked / aria-pressed.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';
import { StatusDot, type StatusDotProps } from '../ui/status-dot';

/** Selectable option card (provider, engine, model): border + soft fill when chosen. */
export const optionCardClass =
  'flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors duration-100 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-primary/60 aria-checked:bg-accent/40 aria-pressed:border-primary/60 aria-pressed:bg-accent/40';

export interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  stacked?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function SettingsRow({ label, description, htmlFor, stacked = false, className, children }: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b py-4 first:pt-0 last:border-0 last:pb-0',
        !stacked && 'sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="leading-5">
            {label}
          </Label>
        ) : (
          <div className="text-sm font-medium leading-5 text-foreground">{label}</div>
        )}
        {description && <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {children && <div className={cn('min-w-0', !stacked && 'sm:shrink-0')}>{children}</div>}
    </div>
  );
}

export function SettingsStatus({ tone, children }: { tone: StatusDotProps['tone']; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <StatusDot tone={tone} />
      <span>{children}</span>
    </span>
  );
}

export function SettingsStep({
  step,
  title,
  caption,
  children,
}: {
  step: number;
  title: React.ReactNode;
  caption?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}
