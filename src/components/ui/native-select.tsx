/**
 * Exports: NativeSelect, NativeSelectProps
 *
 * A real <select> (tests call selectOption on it) styled like Input with a ChevronDown.
 * className goes on the <select>; containerClassName sizes the wrapper (default w-full,
 * e.g. containerClassName="w-auto" or "w-56" for a settings row).
 */
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NativeSelectProps extends React.ComponentProps<'select'> {
  containerClassName?: string;
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, containerClassName, children, ...props }, ref) => (
    <div className={cn('relative flex w-full', containerClassName)}>
      <select
        ref={ref}
        className={cn(
          'h-8 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-transparent py-1 pl-2.5 pr-8 text-sm shadow-xs transition-[color,box-shadow,border-color] duration-100 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive dark:bg-input/30 coarse:min-h-10 [&>option]:bg-popover [&>option]:text-popover-foreground',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
);
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
