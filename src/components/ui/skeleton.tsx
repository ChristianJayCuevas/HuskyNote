/**
 * Exports: Skeleton
 *
 * Loading placeholder: animate-pulse rounded-md bg-accent. Size it with className.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-accent', className)} {...props} />;
}

export { Skeleton };
