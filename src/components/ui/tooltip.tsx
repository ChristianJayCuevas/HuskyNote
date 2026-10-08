/**
 * Exports: TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, SimpleTooltip, SimpleTooltipProps
 *
 * AppLayout renders the single <TooltipProvider delayDuration={400}>; tooltips need it as an ancestor.
 * TooltipContent: rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground, portaled (never clipped).
 * SimpleTooltip({ content, side?, align?, children }): wraps one focusable child (asChild trigger).
 * Do not put tooltips on every list row, and never inside the Picture-in-Picture HUD (portals target
 * the main document).
 */
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, collisionPadding = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'z-50 max-w-xs origin-[--radix-tooltip-content-transform-origin] overflow-hidden rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface SimpleTooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** One element that can hold a ref and receive focus (e.g. a Button) */
  children: React.ReactElement;
}

function SimpleTooltip({ content, side = 'top', align = 'center', children }: SimpleTooltipProps) {
  if (content === null || content === undefined || content === false || content === '') return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, SimpleTooltip };
