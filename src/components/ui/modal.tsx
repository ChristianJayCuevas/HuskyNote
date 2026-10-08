/**
 * Exports: Modal, ModalProps
 *
 * Convenience wrapper over Dialog with the legacy API:
 *   Modal({ isOpen, onClose, title?, description?, maxWidth?, children })
 * maxWidth: 'sm' | 'md' | 'lg' (default) | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'.
 * The body scrolls; without a title the dialog is named "Dialog" for screen readers.
 * Mark the element that should get initial focus with data-dialog-autofocus.
 * Focus returns to the element that was focused when it opened.
 */
import * as React from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from './dialog';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  maxWidth?: DialogSize;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, description, maxWidth = 'lg', children }) => {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) closeRef.current();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent size={maxWidth} className="gap-0 p-0" {...(description ? {} : { 'aria-describedby': undefined })}>
        {title ? (
          <DialogHeader className="px-6 pb-4 pt-5">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        ) : (
          <>
            <DialogTitle className="sr-only">Dialog</DialogTitle>
            {description && (
              <DialogHeader className="px-6 pb-4 pt-5">
                <DialogDescription>{description}</DialogDescription>
              </DialogHeader>
            )}
          </>
        )}
        <DialogBody className={title || description ? 'mx-0 px-6 pb-6' : 'mx-0 px-6 py-6'}>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
};
