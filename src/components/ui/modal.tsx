import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = 'lg',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={twMerge(
          clsx(
            'relative w-full bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]',
            maxWidths[maxWidth]
          )
        )}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="px-6 py-4 border-b dark:border-zinc-850 flex items-center justify-between">
            <div>
              {title && <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>}
              {description && <p className="text-xs text-zinc-400 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-white dark:hover:bg-zinc-850 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};
