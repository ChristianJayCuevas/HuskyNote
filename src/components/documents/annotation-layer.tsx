import React from 'react';
import type { Annotation } from '../../types';
import { X } from 'lucide-react';

interface AnnotationLayerProps {
  annotations: Annotation[];
  pageNumber: number;
  width?: number;
  height?: number;
  onRemoveAnnotation?: (id: string) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  annotations,
  pageNumber,
  width,
  height,
  onRemoveAnnotation,
}) => {
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <div
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
      style={width && height ? { width, height } : undefined}
    >
      {pageAnnotations.map((ann) => {
        const { x, y, width: w, height: h } = ann.coords;
        const left = `${x}%`;
        const top = `${y}%`;
        const itemWidth = `${w}%`;
        const itemHeight = `${h}%`;

        if (ann.type === 'highlight') {
          return (
            <div
              key={ann.id}
              // design-exception: annotation overlay colors are document content drawn on the white page
              className="group absolute cursor-pointer border-b border-yellow-500/50 bg-yellow-400/30 mix-blend-multiply pointer-events-auto"
              style={{ left, top, width: itemWidth, height: itemHeight }}
              title={ann.text || 'Highlighted section'}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              {ann.label && (
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-paper-foreground px-1 py-px text-xs text-paper opacity-0 transition-opacity duration-100 group-hover:opacity-100">
                  {ann.label}
                </span>
              )}
            </div>
          );
        }

        if (ann.type === 'rectangle') {
          // design-exception: annotation colors are stored with the annotation and drawn as document content
          const color = ann.color || '#ef4444';
          return (
            <div
              key={ann.id}
              className="group absolute cursor-pointer rounded-sm border-2 bg-transparent pointer-events-auto"
              style={{
                left,
                top,
                width: itemWidth,
                height: itemHeight,
                borderColor: color,
                boxShadow: `0 0 0 1px ${color}30`,
              }}
              title={ann.text ? `${ann.label ? ann.label + ': ' : ''}${ann.text}` : 'Annotation'}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              {ann.label && (
                <span
                  className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-semibold text-paper-foreground shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {ann.label}
                </span>
              )}
              {/* Dismiss button on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAnnotation?.(ann.id);
                }}
                className="pointer-events-auto absolute -top-6 right-0 flex size-5 items-center justify-center rounded-sm bg-paper text-paper-foreground opacity-0 shadow-sm ring-1 ring-paper-foreground/15 transition-opacity duration-100 hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 group-hover:opacity-100"
                title="Remove annotation"
                aria-label="Remove annotation"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        }

        if (ann.type === 'marker') {
          return (
            <div
              key={ann.id}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-paper-foreground text-xs font-bold text-paper shadow-lg ring-2 ring-paper pointer-events-auto"
              style={{ left, top }}
              title={ann.label || `Step ${ann.stepNumber || 1}`}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              {ann.stepNumber || 1}
            </div>
          );
        }

        if (ann.type === 'note') {
          return (
            <div
              key={ann.id}
              className="absolute max-w-xs cursor-pointer rounded-md bg-paper p-2 text-xs text-paper-foreground shadow-lg ring-1 ring-paper-foreground/15 pointer-events-auto"
              style={{ left, top }}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              <div className="mb-0.5 text-xs font-semibold">Note</div>
              <div>{ann.text}</div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
