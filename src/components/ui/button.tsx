/**
 * Exports: Button, buttonVariants, ButtonProps
 *
 * variant: default | secondary | outline | ghost | destructive | link
 *          (deprecated aliases kept permanently: primary -> default, danger -> destructive)
 * size:    default (h-8) | xs (h-6) | sm (h-7) | lg (h-10) | icon (size-8) | icon-sm (size-7) | icon-lg (size-10)
 *          (deprecated alias: md -> default)
 * asChild: render the single child (e.g. <a>) with button styles via Radix Slot.
 * Icons without a size-* class are sized automatically (size-4; 3.5 for xs/sm/icon-sm).
 * Use size-* (not w-/h-) on icons inside buttons when you need another size.
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const defaultVariant = 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90';
const destructiveVariant =
  'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 dark:bg-destructive/70 dark:hover:bg-destructive/60';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 coarse:min-h-10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: defaultVariant,
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline:
          'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: destructiveVariant,
        link: 'text-foreground underline-offset-4 hover:underline',
        /** @deprecated use "default" */
        primary: defaultVariant,
        /** @deprecated use "destructive" */
        danger: destructiveVariant,
      },
      size: {
        default: 'h-8 px-3',
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 gap-1 px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 px-4',
        icon: 'size-8',
        'icon-sm': "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-lg': 'size-10',
        /** @deprecated use "default" */
        md: 'h-8 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
