import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'connected' | 'recording' | 'warning';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800',
    outline: 'bg-transparent text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800',
    connected: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40',
    recording: 'bg-red-950/40 text-red-300 border-red-800/40',
    warning: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
  };

  const dotColors = {
    default: 'bg-slate-500 dark:bg-zinc-400',
    outline: 'bg-slate-400 dark:bg-zinc-500',
    connected: 'bg-emerald-400',
    recording: 'bg-red-500 animate-pulse',
    warning: 'bg-amber-400',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border select-none',
          variants[variant],
          className
        )
      )}
      {...props}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
