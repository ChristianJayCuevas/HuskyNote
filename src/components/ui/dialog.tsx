/**
 * Exports: Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogClose, DialogContent,
 *          DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription, useDialogReturnFocus
 *
 * DialogContent props (besides Radix's):
 *   size:      'sm' | 'md' | 'lg' (default) | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'  (max-w-*)
 *   position:  'center' (default) | 'top' (15% from the top, e.g. command palette)
 *   hideClose: hide the top-right ghost X (aria-label "Close")
 * Content is rounded-xl border bg-background p-6 shadow-xl, max-h-[85vh], flex column with gap-4.
 * Put long content in <DialogBody> (min-h-0 flex-1 overflow-y-auto) so header and footer stay put.
 *
 * Behavior shared by every dialog built here:
 *   - A controlled <Dialog open> returns focus on close to whatever was focused when it opened
 *     (Radix only does this for a DialogTrigger). Open dialogs from a menu item with
 *     onSelect={() => setTimeout(() => setOpen(true), 0)} so focus returns to the menu trigger.
 *   - An element marked [data-dialog-autofocus] receives initial focus.
 *   - Escape closes the dialog and does not reach page-level Escape handlers.
 *   - Dialogs animate in and close instantly (focus is back on the trigger right after Escape).
 *   - Everything outside the dialog (#root) gets aria-hidden="true" while it is open.
 */
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

interface ReturnFocusState {
  /** Element to focus when the dialog closes */
  target: React.MutableRefObject<HTMLElement | null>;
  /** Controlled open state (undefined for uncontrolled dialogs, where Radix refocuses the trigger) */
  open: React.MutableRefObject<boolean | undefined>;
}
const ReturnFocusContext = React.createContext<ReturnFocusState | null>(null);

// A dialog opened from a menu item or a popover should hand focus back to that menu's or popover's
// trigger when it closes, but Radix triggers do not take focus on pointer open and the menu is
// closing while the dialog opens. So we track the last focused element outside menus/popovers,
// treating focus inside one as focus on its trigger (menus: aria-labelledby; popovers: aria-controls).
const TRANSIENT_LAYER = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

function triggerOf(element: Element, depth = 0): HTMLElement | null {
  const content = element.closest<HTMLElement>('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper] > *');
  if (!content || depth > 4) return null;
  const labelledBy = content.getAttribute('aria-labelledby');
  let trigger: HTMLElement | null = labelledBy ? document.getElementById(labelledBy) : null;
  if (!trigger && content.id) trigger = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(content.id)}"]`);
  if (trigger?.closest(TRANSIENT_LAYER)) return triggerOf(trigger, depth + 1);
  return trigger;
}

// Shared through window so the listener installed once keeps working across hot reloads
type FocusState = { last: HTMLElement | null; installed: boolean };
const focusState: FocusState =
  typeof window === 'undefined'
    ? { last: null, installed: true }
    : ((window as unknown as { __hnDialogFocus?: FocusState }).__hnDialogFocus ??= { last: null, installed: false });
if (!focusState.installed) {
  focusState.installed = true;
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      focusState.last = target.closest(TRANSIENT_LAYER) ? triggerOf(target) ?? focusState.last : target;
    },
    true
  );
}

/** Remembers the element to refocus when `open` turns true (render phase, before Radix moves focus). */
function useCaptureReturnFocus(open: boolean | undefined): ReturnFocusState {
  const target = React.useRef<HTMLElement | null>(null);
  const openRef = React.useRef<boolean | undefined>(open);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    let next = document.activeElement as HTMLElement | null;
    if (next && next.isConnected && next.closest(TRANSIENT_LAYER)) next = triggerOf(next) ?? focusState.last;
    else if (!next || next === document.body || !next.isConnected) next = focusState.last;
    target.current = next;
  }
  wasOpen.current = !!open;
  openRef.current = open;
  return React.useMemo(() => ({ target, open: openRef }), []);
}

function focusReturnTarget(state: ReturnFocusState | null): boolean {
  const target = state?.target.current;
  if (!target || !target.isConnected || target === document.body) return false;
  target.focus({ preventScroll: true });
  return true;
}

/**
 * Rendered inside dialog content: when the content unmounts after a real close, focus goes back
 * synchronously (Radix only refocuses in a later task). Skips StrictMode's simulated unmount,
 * where the dialog is still open.
 */
function ReturnFocusOnUnmount() {
  const state = React.useContext(ReturnFocusContext);
  React.useLayoutEffect(
    () => () => {
      if (state && state.open.current === false) focusReturnTarget(state);
    },
    [state]
  );
  return null;
}

/**
 * Focus helpers shared by Dialog, AlertDialog and Sheet content: initial focus on
 * [data-dialog-autofocus], focus return to the remembered element, Escape kept inside.
 */
function useDialogReturnFocus(handlers: {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}) {
  const returnFocus = React.useContext(ReturnFocusContext);
  const { onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown } = handlers;
  return {
    onOpenAutoFocus: (event: Event) => {
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const target = (event.target as HTMLElement | null)?.querySelector<HTMLElement>('[data-dialog-autofocus]');
      if (target) {
        event.preventDefault();
        target.focus();
      }
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      if (focusReturnTarget(returnFocus)) event.preventDefault();
    },
    onEscapeKeyDown: (event: KeyboardEvent) => {
      onEscapeKeyDown?.(event);
      if (!event.defaultPrevented) event.stopPropagation();
    },
  };
}

function Dialog({ open, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const returnFocus = useCaptureReturnFocus(open);
  return (
    <ReturnFocusContext.Provider value={returnFocus}>
      <DialogPrimitive.Root open={open} {...props} />
    </ReturnFocusContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // design-exception: the modal scrim is translucent black in both themes
      'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-black/60',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
} as const;

const dialogPositions = {
  center: 'top-1/2 -translate-y-1/2 data-[state=open]:slide-in-from-top-[48%]',
  top: 'top-[15%] translate-y-0 data-[state=open]:slide-in-from-top-2',
} as const;

export type DialogSize = keyof typeof dialogSizes;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: DialogSize;
  position?: keyof typeof dialogPositions;
  hideClose?: boolean;
  overlayClassName?: string;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    {
      className,
      children,
      size = 'lg',
      position = 'center',
      hideClose = false,
      overlayClassName,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onEscapeKeyDown,
      ...props
    },
    ref
  ) => {
    const focus = useDialogReturnFocus({ onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown });
    return (
      <DialogPortal>
        <DialogOverlay className={overlayClassName} />
        <DialogPrimitive.Content
          ref={ref}
          {...focus}
          className={cn(
            'fixed left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-4 overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-xl outline-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2',
            dialogPositions[position],
            dialogSizes[size],
            className
          )}
          {...props}
        >
          <ReturnFocusOnUnmount />
          {children}
          {!hideClose && (
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'absolute right-3 top-3 text-muted-foreground')}
            >
              <X />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  }
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 pr-8 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('-mx-6 min-h-0 flex-1 overflow-y-auto px-6 py-0.5', className)} {...props} />
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold leading-snug', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  ReturnFocusContext,
  ReturnFocusOnUnmount,
  useCaptureReturnFocus,
  useDialogReturnFocus,
  TRANSIENT_LAYER,
};
