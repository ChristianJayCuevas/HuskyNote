/**
 * Exports: Toolbar, ToolbarGroup, ToolbarSeparator
 *
 * Toolbar: detail-pane header bar, h-11 px-4 border-b flex items-center gap-1 (bg-background).
 * ToolbarGroup: flex items-center gap-1 (use ml-auto on the right-hand group).
 * ToolbarSeparator: vertical 1px line, h-5 mx-1.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Separator } from './separator';

const Toolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex h-11 shrink-0 items-center gap-1 border-b bg-background px-4', className)}
    {...props}
  />
));
Toolbar.displayName = 'Toolbar';

const ToolbarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-1', className)} {...props} />
));
ToolbarGroup.displayName = 'ToolbarGroup';

function ToolbarSeparator({ className }: { className?: string }) {
  return <Separator orientation="vertical" className={cn('mx-1 h-5 w-px', className)} />;
}

export { Toolbar, ToolbarGroup, ToolbarSeparator };
