/**
 * Exports: ToggleGroup, ToggleGroupItem
 *
 * Segmented control on Radix ToggleGroup (type "single" | "multiple"; arrow keys move focus).
 * variant: default (separate ghost items, gap-0.5) | outline (joined items with one border).
 * size: default (h-8) | sm (h-7) | lg (h-10). Items inherit variant/size from the group.
 * Single-select groups can be emptied by clicking the active item; guard with
 * onValueChange={(v) => v && setValue(v)} when a value is required.
 */
import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { toggleVariants } from './toggle';

type ToggleGroupContextValue = VariantProps<typeof toggleVariants>;
const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({ size: 'default', variant: 'default' });

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant = 'default', size = 'default', children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    data-variant={variant}
    className={cn(
      'group/toggle-group flex w-fit items-center rounded-md',
      variant === 'outline' ? 'shadow-xs' : 'gap-0.5',
      className
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = context.variant || variant;
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({ variant: resolvedVariant, size: context.size || size }),
        resolvedVariant === 'outline' &&
          'rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus-visible:z-10 [&:not(:first-child)]:border-l-0',
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
