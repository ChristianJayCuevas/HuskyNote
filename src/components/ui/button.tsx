import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md whitespace-nowrap shrink-0 transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed select-none';

    const variants = {
      primary:
        'bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 active:scale-[0.98] shadow-sm',
      secondary:
        'bg-white text-slate-950 border border-slate-300 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 active:bg-slate-200 dark:active:bg-zinc-850',
      outline:
        'bg-white text-slate-950 border border-slate-300 hover:bg-slate-100 hover:text-black dark:bg-transparent dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-850 dark:hover:text-white',
      ghost:
        'bg-transparent text-slate-900 hover:text-black hover:bg-slate-100 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900',
      danger:
        'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-zinc-900 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:border-red-800',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-3.5 py-2 gap-2',
      lg: 'text-base px-4 py-2.5 gap-2.5',
      icon: 'p-2 text-sm',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
