/**
 * Exports: HuskyMascot
 *
 * HuskyMascot({ size?: 'sm' | 'md' | 'lg' | 'hero', isWriting?, className?, enableInteraction?, ... })
 * The brand husky head (src/brand HuskyHead, animated: blinks, ears twitch on hover) with an optional
 * "taking notes..." chip for md and larger. message / showSpeechBubble / badge are accepted for
 * compatibility and ignored.
 */
import React, { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { HuskyHead } from '@/brand';
import { cn } from '@/lib/utils';

interface HuskyMascotProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  isWriting?: boolean;
  message?: string;
  className?: string;
  showSpeechBubble?: boolean;
  enableInteraction?: boolean;
  badge?: string;
}

const sizeClasses = {
  sm: 'size-16',
  md: 'size-28',
  lg: 'size-44',
  hero: 'size-60 sm:size-72',
} as const;

export const HuskyMascot: React.FC<HuskyMascotProps> = ({
  size = 'md',
  isWriting = false,
  className,
  enableInteraction = true,
}) => {
  const [scribbleActive, setScribbleActive] = useState(true);

  // Periodic writing cycle
  useEffect(() => {
    if (isWriting) {
      setScribbleActive(true);
      return;
    }
    const interval = setInterval(() => setScribbleActive((prev) => !prev), 2800);
    return () => clearInterval(interval);
  }, [isWriting]);

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <div className={cn('relative', sizeClasses[size], enableInteraction && 'cursor-default')}>
        <HuskyHead animated title="HuskyNote husky" className="size-full" />

        {size !== 'sm' && (scribbleActive || isWriting) && (
          <div className="pointer-events-none absolute bottom-2 right-0 flex items-center gap-1 rounded-full border bg-popover px-2 py-0.5 text-xs text-muted-foreground shadow-sm animate-in fade-in-0">
            <PenLine className="size-3" />
            <span className="whitespace-nowrap">taking notes...</span>
          </div>
        )}
      </div>
    </div>
  );
};
