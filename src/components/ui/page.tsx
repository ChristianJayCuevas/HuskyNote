/**
 * Exports: PageContainer, PageHeader, PageSection (+ their Props types)
 *
 * PageContainer({ width: 'narrow' | 'default' | 'wide' | 'full', className, children })
 *   mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-16; narrow max-w-3xl (documents, AI chat, About,
 *   Changelog, Privacy), default max-w-5xl (Settings), wide max-w-6xl (Home, Templates, Schedule, Studio),
 *   full = no max width. Pages scroll inside <main>; do not add another h-full overflow-y-auto root.
 * PageHeader({ title, description?, icon?, actions?, titleClassName?, className, children? })
 *   h1 text-2xl font-semibold; optional muted icon tile (size-10 rounded-lg bg-muted; pass an element
 *   like <Settings />); description text-sm muted; actions right-aligned (flex gap-2); children render
 *   below the title row (e.g. tabs).
 * PageSection({ title?, description?, actions?, className, children })
 *   <section> with an h2 text-base font-semibold header row and space-y-4 content.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

const widths = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
} as const;

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: keyof typeof widths;
}

const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ width = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10', widths[width], className)}
      {...props}
    />
  )
);
PageContainer.displayName = 'PageContainer';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

function PageHeader({ title, description, icon, actions, titleClassName, className, children }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-5">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h1 className={cn('text-2xl font-semibold tracking-tight text-foreground', titleClassName)}>{title}</h1>
            {description && <div className="text-sm text-muted-foreground">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export interface PageSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

const PageSection = React.forwardRef<HTMLElement, PageSectionProps>(
  ({ title, description, actions, className, children, ...props }, ref) => (
    <section ref={ref} className={cn('space-y-4', className)} {...props}>
      {(title || description || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
            {description && <div className="text-sm text-muted-foreground">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
);
PageSection.displayName = 'PageSection';

export { PageContainer, PageHeader, PageSection };
