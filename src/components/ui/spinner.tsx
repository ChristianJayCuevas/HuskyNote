/**
 * Exports: Spinner
 *
 * Spinning Loader2 icon (size-4 by default, muted). role="status" with label "Loading" unless
 * you pass aria-label / aria-hidden.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Spinner };
