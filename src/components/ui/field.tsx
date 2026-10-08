/**
 * Exports: Field, FieldProps
 *
 * Field({ label, htmlFor, description, error, className, children }): label above the control,
 * muted description or destructive error below. When htmlFor is set the helper text gets
 * id `${htmlFor}-description` / `${htmlFor}-error`, so the control can use aria-describedby.
 * Stack fields with space-y-4.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, description, error, className, children }: FieldProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {description && !error && (
        <p id={htmlFor ? `${htmlFor}-description` : undefined} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { Field };
