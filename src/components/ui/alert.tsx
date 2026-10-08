/**
 * Exports: Alert, AlertTitle, AlertDescription, alertVariants
 *
 * Notion-style callout: rounded-lg px-4 py-3 text-sm on a soft fill, optional leading icon (first child svg).
 * variant: default (bg-muted) | info | success | warning | destructive (bg-x/10, icon in the status color).
 * No live-region role by default: pass role="alert" for errors that appear after an action,
 * or role="status" for polite updates.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg px-4 py-3 text-sm text-foreground has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default: 'bg-muted [&>svg]:text-muted-foreground',
        info: 'bg-info/10 [&>svg]:text-info',
        success: 'bg-success/10 [&>svg]:text-success',
        warning: 'bg-warning/10 [&>svg]:text-warning',
        destructive: 'bg-destructive/10 [&>svg]:text-destructive [&_[data-slot=alert-title]]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="alert-title" className={cn('col-start-2 font-medium leading-5', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="alert-description"
      className={cn('col-start-2 text-sm leading-relaxed text-muted-foreground [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
