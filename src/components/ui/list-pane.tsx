/**
 * Exports: ListPane, ListPaneHeader, ListPaneSearch, ListPaneBody, ListItem, ListPaneEmpty (+ Props types)
 *
 * The list column of a list/detail page (wrap it in ResizableListPanel):
 *   <ListPane>
 *     <ListPaneHeader title="Notes" count={notes.length} actions={<Button size="sm">New Note</Button>} />
 *     <ListPaneSearch placeholder="Filter notes..." value={q} onChange={...} onClear={() => setQ('')} />
 *     <ListPaneBody>{notes.map(n => <ListItem key={n.id} selected={n.id === activeId} title={n.title} meta="2h ago" onClick={...} />)}</ListPaneBody>
 *   </ListPane>
 * ListPane: flex h-full flex-col border-r bg-background.
 * ListPaneHeader({ title, count?, actions?, as? = 'h1' }): h-11 px-3, title text-sm font-semibold
 *   (it is the page heading on list/detail pages; pass as="h2" if the page has another h1).
 * ListItem: <button type="button" aria-pressed={selected}> with title (text-sm font-medium, truncated),
 *   trailing (right of the title, text-xs muted), meta (text-xs muted line), description (line-clamp-2),
 *   leading (icon/avatar). Rows are rounded-md px-2.5 py-2 hover:bg-accent, selected bg-accent; no dividers.
 *   actions: hover-revealed controls rendered beside (not inside) the button, e.g. a ghost icon-sm delete.
 * ListPaneEmpty({ icon?, title, description?, children? }) for an empty or no-match list.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { SearchInput, type SearchInputProps } from './input';

const ListPane = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex h-full w-full min-w-0 flex-col border-r bg-background', className)} {...props} />
));
ListPane.displayName = 'ListPane';

export interface ListPaneHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}

function ListPaneHeader({ title, count, actions, as: Heading = 'h1', className, children, ...props }: ListPaneHeaderProps) {
  return (
    <div className={cn('flex h-11 shrink-0 items-center gap-2 px-3', className)} {...props}>
      <Heading className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</Heading>
      {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      {children}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** Padding lives on an outer wrapper so the positioned SearchInput container (and its icon) matches the input box. */
function ListPaneSearch({ containerClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn('shrink-0 px-3 pb-2', containerClassName)}>
      <SearchInput {...props} />
    </div>
  );
}

const ListPaneBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('min-h-0 flex-1 space-y-px overflow-y-auto px-1.5 pb-3', className)} {...props} />
));
ListPaneBody.displayName = 'ListPaneBody';

export interface ListItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  selected?: boolean;
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

const ListItem = React.forwardRef<HTMLButtonElement, ListItemProps>(
  ({ selected = false, title, meta, description, trailing, leading, actions, className, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        className={cn(
          'flex w-full min-w-0 items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:bg-accent',
          actions && 'pr-10',
          className
        )}
        {...props}
      >
        {leading && <span className="mt-0.5 flex shrink-0 items-center text-muted-foreground [&_svg:not([class*='size-'])]:size-4">{leading}</span>}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</span>
            {trailing && <span className="shrink-0 text-xs text-muted-foreground">{trailing}</span>}
          </span>
          {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
          {description && <span className="line-clamp-2 text-xs text-muted-foreground">{description}</span>}
        </span>
      </button>
    );
    if (!actions) return button;
    return (
      <div className="group/list-item relative">
        {button}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover/list-item:opacity-100 coarse:opacity-100">
          {actions}
        </div>
      </div>
    );
  }
);
ListItem.displayName = 'ListItem';

export interface ListPaneEmptyProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function ListPaneEmpty({ icon, title, description, className, children }: ListPaneEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1 px-4 py-10 text-center', className)}>
      {icon && <div className="mb-2 text-muted-foreground/70 [&_svg:not([class*='size-'])]:size-6">{icon}</div>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
      {children && <div className="mt-3 flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { ListPane, ListPaneHeader, ListPaneSearch, ListPaneBody, ListItem, ListPaneEmpty };
