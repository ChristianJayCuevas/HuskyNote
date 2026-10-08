/**
 * Exports: Badge, badgeVariants, BadgeProps
 *
 * variant: default | secondary | outline | destructive | success | warning | info
 *          (status variants are soft: bg-x/10 text-x)
 *          (deprecated aliases kept: connected -> success, recording -> destructive)
 * dot:     leading status dot in the badge color; it pulses only for destructive/recording.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const success = 'bg-success/10 text-success';
const destructive = 'bg-destructive/10 text-destructive';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
        destructive,
        success,
        warning: 'bg-warning/10 text-warning',
        info: 'bg-info/10 text-info',
        /** @deprecated use "success" */
        connected: success,
        /** @deprecated use "destructive" */
        recording: destructive,
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, dot = false, children, ...props }, ref) => {
  const pulses = variant === 'destructive' || variant === 'recording';
  return (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full bg-current', pulses && 'animate-pulse motion-reduce:animate-none')}
        />
      )}
      {children}
    </span>
  );
});
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
