import React, { useState, useRef, useEffect } from 'react';
import { Crop, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { cn } from '@/lib/utils';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

interface ScreenSnipperOverlayProps {
  onCapture: (rect: CropRect) => void;
  onCancel: () => void;
}

/**
 * ScreenSnipperOverlay provides an interactive, crosshair-based screen portion
 * selection tool: a dark scrim, a popover-style instruction pill and a dashed selection box.
 *
 * Users can click and drag across the viewport to crop a designated region.
 */
export const ScreenSnipperOverlay: React.FC<ScreenSnipperOverlayProps> = ({
  onCapture,
  onCancel,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!isDragging || !startPos || !currentPos) {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    // Only capture if user dragged a meaningful region (> 20x20px)
    if (width > 20 && height > 20) {
      onCapture({
        x,
        y,
        width,
        height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    } else {
      setStartPos(null);
      setCurrentPos(null);
    }
  };

  // Calculate normalized selection coordinates
  const rect = startPos && currentPos ? {
    x: Math.min(startPos.x, currentPos.x),
    y: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  } : null;

  return (
    <div
      // design-exception: the snipping scrim dims whatever is on screen, so it stays dark in both themes
      className="fixed inset-0 z-[10000] cursor-crosshair select-none overflow-hidden bg-black/45"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top floating instruction pill */}
      <div className="pointer-events-auto absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-lg">
        <Crop className="size-4 text-muted-foreground" />
        <span className="whitespace-nowrap text-sm font-medium">Click and drag to snip a portion of the screen</span>
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground sm:inline-flex">
          <Kbd>Esc</Kbd> to cancel
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="rounded-full text-muted-foreground"
          title="Cancel Snip"
          aria-label="Cancel Snip"
        >
          <X />
        </Button>
      </div>

      {/* Selection Box when dragging */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            // design-exception: the selection is drawn over arbitrary screen content, so it uses fixed light/dark contrast
            border: '2px dashed rgba(255, 255, 255, 0.9)',
            // design-exception: see above
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            // design-exception: see above (darkens everything outside the selection)
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
          }}
        >
          {/* Corner Handles */}
          {['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-bottom-1.5 -left-1.5', '-bottom-1.5 -right-1.5'].map((corner) => (
            <div
              key={corner}
              className={cn('absolute size-3 rounded-sm border border-primary bg-primary-foreground shadow-sm', corner)}
            />
          ))}

          {/* Dimension Tag */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-0.5 font-mono text-xs tabular-nums text-popover-foreground shadow-lg">
            {Math.round(rect.width)} × {Math.round(rect.height)} px
          </div>
        </div>
      )}
    </div>
  );
};
