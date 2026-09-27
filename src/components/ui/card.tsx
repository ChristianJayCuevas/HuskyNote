import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TiltCard } from './tilt-card';

export { TiltCard, type TiltCardProps } from './tilt-card';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  enableTilt?: boolean;
  maxTilt?: number;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverEffect = false,
  enableTilt = true,
  maxTilt = 5,
  children,
  ...props
}) => {
  const content = (
    <div
      className={twMerge(
        clsx(
          'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 transition-colors duration-150',
          hoverEffect && 'hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/60',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );

  if (enableTilt) {
    return <TiltCard maxTilt={maxTilt}>{content}</TiltCard>;
  }

  return content;
};
