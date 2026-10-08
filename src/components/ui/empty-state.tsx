/**
 * Exports: EmptyState
 *
 * EmptyState({ icon: LucideIcon, title, description, actionLabel?, onAction?, secondaryActionLabel?,
 *              onSecondaryAction?, className?, children? })
 * Centered: muted icon (size-8, no box), title text-base font-medium, description text-sm muted max-w-sm,
 * primary action (default size sm) + secondary (outline size sm). children render under the actions.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  children,
}) => {
  const hasActions = (actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction);
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center', className)}>
      <Icon aria-hidden="true" className="mb-4 size-8 text-muted-foreground/70" strokeWidth={1.5} />
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {hasActions && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
