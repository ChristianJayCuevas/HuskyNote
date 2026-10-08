/**
 * Exports: StatusDot, StatusDotProps
 *
 * StatusDot({ tone: 'success' | 'muted' | 'warning' | 'destructive', pulse?, label?, className })
 * A size-2 round dot. Decorative unless `label` is given (then it is read as that text).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatusDotProps {
  tone?: 'success' | 'muted' | 'warning' | 'destructive';
  pulse?: boolean;
  label?: string;
  className?: string;
}

const tones = {
  success: 'bg-success',
  muted: 'bg-muted-foreground/50',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
} as const;

function StatusDot({ tone = 'muted', pulse = false, label, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        tones[tone],
        pulse && 'animate-pulse motion-reduce:animate-none',
        className
      )}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}

export { StatusDot };
