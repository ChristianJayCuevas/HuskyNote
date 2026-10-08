import { useId, type CSSProperties } from 'react';
import { BRAND_COLORS } from './colors';
import { HuskyMarkShapes, MARK_VIEWBOX } from './husky-mark';
import { a11y, cx, safeId, toneVars } from './tone';

export type HuskyTileVariant = 'standard' | 'macos' | 'small' | 'bleed';

export interface HuskyTileProps {
  /**
   * standard: rounded app tile with a snow drift (favicons 48px+, Windows/Linux icons).
   * macos: inset tile with drop shadow on the macOS icon grid.
   * small: edge-to-edge tile, simplified mark, no drift (16-32px).
   * bleed: square, unrounded (iOS touch icon; the OS applies its own mask).
   */
  variant?: HuskyTileVariant;
  /** Rendered width and height (px if a number). Default 64. */
  size?: number | string;
  /** Mark detail. `auto` simplifies the mark for the small variant and at 32px and below. Default 'auto'. */
  detail?: 'auto' | 'full' | 'simple';
  title?: string;
  className?: string;
  style?: CSSProperties;
}

interface TileFrame {
  x: number;
  size: number;
  radius: number;
  drift: boolean;
  mark: number;
  simple: boolean;
  shadow: boolean;
}

const FRAMES: Record<HuskyTileVariant, TileFrame> = {
  standard: { x: 32, size: 960, radius: 216, drift: true, mark: 700, simple: false, shadow: false },
  macos: { x: 100, size: 824, radius: 185, drift: true, mark: 600, simple: false, shadow: true },
  small: { x: 0, size: 1024, radius: 200, drift: false, mark: 880, simple: true, shadow: false },
  bleed: { x: 0, size: 1024, radius: 0, drift: true, mark: 720, simple: false, shadow: false },
};

// Snow drift ridge, drawn for the standard 32..992 frame and scaled into other frames.
const DRIFT = 'M32 760L190 700L300 735L430 650L540 705L660 630L790 690L992 640V992H32Z';

/** Square app-icon artwork (viewBox 0 0 1024 1024). Used by the asset generator for favicons and app icons. */
export function HuskyTile({ variant = 'standard', size = 64, detail = 'auto', title, className, style }: HuskyTileProps) {
  const uid = safeId(useId());
  const f = FRAMES[variant];
  const simple =
    detail === 'simple' || (detail === 'auto' && (f.simple || (typeof size === 'number' && size <= 32)));
  // The variant is part of each id so that separately rendered markup (e.g. two renderToStaticMarkup
  // calls that both get the same useId) can only collide with identical geometry.
  const gradId = `hn-tile-grad-${variant}-${uid}`;
  const clipId = `hn-tile-clip-${variant}-${uid}`;
  const shadowId = `hn-tile-shadow-${variant}-${uid}`;
  const scale = f.size / 960;
  const offset = f.x - 32 * scale;
  const markX = f.x + (f.size - f.mark) / 2;
  // The mark's artwork sits slightly high in its 48px box (ears), so nudge it down a touch.
  const markY = f.x + (f.size - f.mark) / 2 + f.mark * (variant === 'small' ? 0.01 : 0.015);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={cx('hn-tile', className)}
      style={{ flexShrink: 0, ...style }}
      {...a11y(title)}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND_COLORS.tile.top} />
          <stop offset="1" stopColor={BRAND_COLORS.tile.bottom} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={f.x} y={f.x} width={f.size} height={f.size} rx={f.radius} />
        </clipPath>
        {f.shadow && (
          <filter id={shadowId} x="-10%" y="-10%" width="120%" height="125%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#0B1220" floodOpacity="0.22" />
          </filter>
        )}
      </defs>
      <rect
        x={f.x}
        y={f.x}
        width={f.size}
        height={f.size}
        rx={f.radius}
        fill={`url(#${gradId})`}
        filter={f.shadow ? `url(#${shadowId})` : undefined}
      />
      <g clipPath={`url(#${clipId})`}>
        {f.drift && (
          <path
            d={DRIFT}
            transform={`translate(${offset} ${offset}) scale(${scale})`}
            fill={BRAND_COLORS.tile.drift}
            fillOpacity="0.92"
          />
        )}
        <svg x={markX} y={markY} width={f.mark} height={f.mark} viewBox={MARK_VIEWBOX} style={toneVars('ink')}>
          <HuskyMarkShapes simple={simple} />
        </svg>
      </g>
    </svg>
  );
}
