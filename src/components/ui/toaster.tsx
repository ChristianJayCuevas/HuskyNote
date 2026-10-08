/**
 * Exports: Toaster
 *
 * Renders the workspace toasts (useWorkspace().toasts, added with addToast(message, type?, action?)).
 * Bottom-center stack, z-[60], aria-live="polite". Each toast: rounded-lg border bg-popover shadow-lg,
 * status icon (success / error / warning / info), optional action button (ghost xs; disabled while its
 * async run() is pending, toast removed when it resolves) and a dismiss button ("Dismiss toast").
 * Rendered once by AppLayout; pages just call addToast. While the floating meeting controls sit near the
 * bottom edge they set --meeting-controls-offset on <html> and the stack moves up above them.
 * Portaled to <body>: the aria-hidden helper Radix dialogs use keeps every [aria-live] region and its
 * ancestors exposed, so a live region inside #root would stop #root from being hidden behind a dialog.
 * (Page-level aria-live regions have the same effect while they are mounted.)
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from './button';

const icons = {
  success: <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />,
  error: <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />,
  warning: <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-warning" />,
  info: <Info aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />,
} as const;

function Toaster() {
  const { toasts, removeToast } = useWorkspace();
  const [pendingActions, setPendingActions] = React.useState<Set<string>>(() => new Set());

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,var(--meeting-controls-offset,0px))] z-[60] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
        >
          {icons[toast.type]}
          <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
          {toast.action && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={pendingActions.has(toast.id)}
              className="shrink-0 font-semibold"
              onClick={() => {
                setPendingActions((previous) => new Set(previous).add(toast.id));
                void toast
                  .action!.run()
                  .then(() => removeToast(toast.id))
                  .catch(() => {})
                  .finally(() =>
                    setPendingActions((previous) => {
                      const next = new Set(previous);
                      next.delete(toast.id);
                      return next;
                    })
                  );
              }}
            >
              {toast.action.label}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeToast(toast.id)}
            className="-mr-1 shrink-0 text-muted-foreground"
            aria-label="Dismiss toast"
          >
            <X />
          </Button>
        </div>
      ))}
    </div>,
    document.body
  );
}

export { Toaster };
