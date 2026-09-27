import React from 'react';
import type { Annotation } from '../../types';

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
      className="absolute inset-0 pointer-events-none overflow-hidden w-full h-full"
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
              className="absolute bg-yellow-400/30 mix-blend-multiply border-b border-yellow-500/50 pointer-events-auto cursor-pointer group"
              style={{ left, top, width: itemWidth, height: itemHeight }}
              title={ann.text || 'Highlighted section'}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              {ann.label && (
                <span className="absolute -top-4 left-0 text-[9px] bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 px-1 py-0.2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {ann.label}
                </span>
              )}
            </div>
          );
        }

        if (ann.type === 'rectangle') {
          return (
            <div
              key={ann.id}
              className="absolute border-2 rounded-sm pointer-events-auto cursor-pointer group bg-transparent transition-all"
              style={{
                left,
                top,
                width: itemWidth,
                height: itemHeight,
                borderColor: ann.color || '#ef4444',
                boxShadow: `0 0 0 1px ${ann.color || '#ef4444'}30`,
              }}
              title={ann.text ? `${ann.label ? ann.label + ': ' : ''}${ann.text}` : 'Annotation'}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              {ann.label && (
                <span
                  className="absolute -top-5 left-0 text-[10px] font-semibold text-slate-950 dark:text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none"
                  style={{ backgroundColor: ann.color || '#ef4444' }}
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
                className="absolute -top-5 right-0 text-[9px] bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-red-600 px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto"
                title="Remove annotation"
              >
                ✕
              </button>
            </div>
          );
        }

        if (ann.type === 'marker') {
          return (
            <div
              key={ann.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shadow-lg border border-black pointer-events-auto cursor-pointer"
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
              className="absolute bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-[11px] p-2 rounded shadow-xl max-w-xs pointer-events-auto cursor-pointer"
              style={{ left, top }}
              onClick={() => onRemoveAnnotation?.(ann.id)}
            >
              <div className="font-semibold text-slate-900 dark:text-zinc-100 text-[10px] mb-0.5">Note</div>
              <div>{ann.text}</div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
