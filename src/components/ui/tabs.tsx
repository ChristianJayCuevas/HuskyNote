/**
 * Exports: Tabs, TabsList, TabsTrigger, TabsContent
 *
 * TabsList variant: 'pill' (default; segmented on bg-muted, active = bg-background) |
 *                   'line' (underline; active = 2px inset foreground line). Triggers follow the list's variant.
 * Radix Tabs: arrow keys move between tabs. A 'line' list scrolls sideways when it does not fit and fades
 * the clipped edge (useScrollFade), so tabs past the edge read as scrollable on phones.
 */
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { useScrollFade } from './use-scroll-fade';

type TabsVariant = 'pill' | 'line';
const TabsVariantContext = React.createContext<TabsVariant>('pill');

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = 'pill', ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => listRef.current as HTMLDivElement);
  useScrollFade(listRef, variant === 'line');
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={listRef}
        data-variant={variant}
        className={cn(
          variant === 'pill'
            ? 'inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground'
            : 'flex h-10 w-full items-stretch justify-start gap-5 overflow-x-auto border-b text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === 'pill'
          ? 'h-full rounded-md px-2.5 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:bg-accent'
          : 'relative -mb-px shrink-0 rounded-sm px-0.5 hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--foreground))]',
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
