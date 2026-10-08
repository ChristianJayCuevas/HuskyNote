/**
 * Exports: Kbd
 *
 * Keyboard hint chip: h-5 rounded-sm bg-muted px-1 text-xs font-medium text-muted-foreground.
 * Use for shortcut hints, e.g. <Kbd>Ctrl K</Kbd>.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground',
      className
    )}
    {...props}
  />
));
Kbd.displayName = 'Kbd';

export { Kbd };
