/**
 * Exports: Disclosure, DisclosureProps
 *
 * Notion-style toggle on a native <details>: Disclosure({ summary, defaultOpen?, className, children }).
 * The ChevronRight rotates when open; content is indented under the summary.
 */
import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DisclosureProps {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

function Disclosure({ summary, defaultOpen = false, className, contentClassName, children }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn('group/disclosure', className)}>
      <summary className="-mx-1.5 flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/disclosure:rotate-90" />
        {summary}
      </summary>
      <div className={cn('pl-6 pt-2 text-sm', contentClassName)}>{children}</div>
    </details>
  );
}

export { Disclosure };
