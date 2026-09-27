import React, { useState, useRef, useEffect } from 'react';
import { Crop, X, Check } from 'lucide-react';

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
 * selection tool with a pure monochrome white/gray glassmorphic design.
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
      className="fixed inset-0 z-[10000] select-none cursor-crosshair overflow-hidden"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Floating Instruction Pill in Monochrome Glassmorphism */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full bg-zinc-950/80 dark:bg-canvas-inset/85 backdrop-blur-2xl border border-white/25 shadow-2xl text-white pointer-events-auto">
        <Crop className="w-4 h-4 text-zinc-300 animate-pulse" />
        <span className="text-xs font-semibold tracking-wide text-zinc-100">
          Click and drag to snip a portion of the screen
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 border border-white/15">
          ESC to cancel
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="p-1 rounded-full hover:bg-white/15 text-zinc-400 hover:text-white transition-colors"
          title="Cancel Snip"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selection Box when dragging */}
      {rect && rect.width > 0 && rect.height > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            border: '2px dashed rgba(255, 255, 255, 0.9)',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
          }}
        >
          {/* Corner Handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-zinc-900 rounded-sm shadow-sm" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-zinc-900 rounded-sm shadow-sm" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-zinc-900 rounded-sm shadow-sm" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-zinc-900 rounded-sm shadow-sm" />

          {/* Dimension Tag */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-zinc-950/90 border border-white/20 text-[10px] font-mono text-white whitespace-nowrap shadow-lg">
            {Math.round(rect.width)} × {Math.round(rect.height)} px
          </div>
        </div>
      )}
    </div>
  );
};
