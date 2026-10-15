/**
 * Exports: ResizableListPanel
 *
 * ResizableListPanel({ storageKey, label, hiddenOnMobile?, children }) wraps the ListPane of a list/detail page.
 * Desktop: drag the right edge to resize (double-click resets, arrow keys step), or collapse to a w-10 rail.
 * Phones: full-width stacked list (hidden while an item is open when hiddenOnMobile).
 */
import React, { useCallback, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

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
  /** Marks the panel (or its collapsed rail) as a guided tour target */
  'data-tour'?: string;
  children: React.ReactNode;
}

/**
 * The list column of a list-and-detail page. On desktop its right border can
 * be dragged to resize it (double-click resets), and it can be collapsed to
 * a thin rail. On phones it keeps the full-width stacked layout.
 */
export const ResizableListPanel: React.FC<ResizableListPanelProps> = ({ storageKey, label, hiddenOnMobile = false, children, 'data-tour': dataTour }) => {
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
        <div className="hidden h-full w-10 shrink-0 flex-col items-center gap-3 border-r bg-background py-2 md:flex" data-tour={dataTour}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsedAndSave(false)}
            className="text-muted-foreground"
            title={`Show ${label.toLowerCase()} list`}
            aria-label={`Show ${label.toLowerCase()} list`}
          >
            <PanelLeftOpen />
          </Button>
          <span className="select-none text-xs font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            {label}
          </span>
        </div>
      </>
    );
  }

  return (
    <div
      className={cn(mobile, 'group/panel relative h-full w-full shrink-0 md:w-[var(--list-panel-width)]', dragging && 'select-none')}
      style={{ '--list-panel-width': `${width}px` } as React.CSSProperties}
      data-tour={dataTour}
    >
      {children}

      {/* Collapse button near the top of the border, clear of where people grab it to resize */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setCollapsedAndSave(true)}
        className="pointer-events-none absolute -right-3 top-14 z-20 hidden size-6 rounded-full bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity duration-100 focus:pointer-events-auto focus:opacity-100 group-hover/panel:pointer-events-auto group-hover/panel:opacity-100 md:inline-flex dark:bg-background [&_svg]:size-3.5"
        title={`Hide ${label.toLowerCase()} list`}
        aria-label={`Hide ${label.toLowerCase()} list`}
      >
        <PanelLeftClose />
      </Button>

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
        className={cn(
          'absolute -right-1 top-0 z-10 hidden h-full w-2 cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors after:duration-100 focus:outline-none md:block',
          dragging ? 'after:bg-ring' : 'hover:after:bg-input focus-visible:after:bg-ring'
        )}
      />
    </div>
  );
};
