import React, { useCallback, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;
const KEY_STEP = 16;

const clamp = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? clamp(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; the layout lasts for this page only
  }
}

interface ResizableListPanelProps {
  /** Remembers this panel's width and collapsed state, e.g. 'notes' or 'meetings' */
  storageKey: string;
  /** Shown on the collapsed rail and read by screen readers, e.g. 'Notes' */
  label: string;
  /** On phones the list takes the full width and hides while an item is open */
  hiddenOnMobile?: boolean;
  children: React.ReactNode;
}

/**
 * The list column of a list-and-detail page. On desktop its right border can
 * be dragged to resize it (double-click resets), and it can be collapsed to
 * a thin rail. On phones it keeps the full-width stacked layout.
 */
export const ResizableListPanel: React.FC<ResizableListPanelProps> = ({ storageKey, label, hiddenOnMobile = false, children }) => {
  const widthKey = `huskynote_panel_${storageKey}_width`;
  const collapsedKey = `huskynote_panel_${storageKey}_collapsed`;
  const [width, setWidth] = useState(() => readNumber(widthKey, DEFAULT_WIDTH));
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(collapsedKey) === 'true';
    } catch {
      return false;
    }
  });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const commitWidth = useCallback(
    (w: number) => {
      const next = clamp(w);
      setWidth(next);
      writeValue(widthKey, String(next));
    },
    [widthKey]
  );

  const setCollapsedAndSave = (next: boolean) => {
    setCollapsed(next);
    writeValue(collapsedKey, String(next));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(clamp(drag.current.startWidth + e.clientX - drag.current.startX));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    commitWidth(drag.current.startWidth + e.clientX - drag.current.startX);
    drag.current = null;
    setDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') commitWidth(width - KEY_STEP);
    else if (e.key === 'ArrowRight') commitWidth(width + KEY_STEP);
    else if (e.key === 'Home') commitWidth(MIN_WIDTH);
    else if (e.key === 'End') commitWidth(MAX_WIDTH);
    else return;
    e.preventDefault();
  };

  const mobile = hiddenOnMobile ? 'hidden md:flex' : 'flex';

  if (collapsed) {
    return (
      <>
        {/* Phones ignore the desktop collapse and keep the full list */}
        <div className={`${hiddenOnMobile ? 'hidden' : 'flex'} md:hidden w-full shrink-0 h-full`}>{children}</div>
        <div className="hidden md:flex w-10 shrink-0 h-full flex-col items-center gap-3 py-3 border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => setCollapsedAndSave(false)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-850 transition-colors"
            title={`Show ${label.toLowerCase()} list`}
            aria-label={`Show ${label.toLowerCase()} list`}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 select-none">
            {label}
          </span>
        </div>
      </>
    );
  }

  return (
    <div
      className={`${mobile} group/panel relative w-full md:w-[var(--list-panel-width)] shrink-0 h-full ${dragging ? 'select-none' : ''}`}
      style={{ '--list-panel-width': `${width}px` } as React.CSSProperties}
    >
      {children}

      {/* Collapse button near the top of the border, clear of where people grab it to resize */}
      <button
        type="button"
        onClick={() => setCollapsedAndSave(true)}
        className="hidden md:flex absolute top-16 -right-3 z-20 w-6 h-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm opacity-0 pointer-events-none group-hover/panel:opacity-100 group-hover/panel:pointer-events-auto focus:opacity-100 focus:pointer-events-auto hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-opacity"
        title={`Hide ${label.toLowerCase()} list`}
        aria-label={`Hide ${label.toLowerCase()} list`}
      >
        <PanelLeftClose className="w-3.5 h-3.5" />
      </button>

      {/* Drag handle over the right border */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label.toLowerCase()} list`}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => commitWidth(DEFAULT_WIDTH)}
        onKeyDown={onKeyDown}
        title="Drag to resize, double-click to reset"
        className={`hidden md:block absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize touch-none focus:outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors ${
          dragging
            ? 'after:bg-slate-400 dark:after:bg-zinc-500'
            : 'hover:after:bg-slate-300 focus-visible:after:bg-slate-400 dark:hover:after:bg-zinc-600 dark:focus-visible:after:bg-zinc-500'
        }`}
      />
    </div>
  );
};
