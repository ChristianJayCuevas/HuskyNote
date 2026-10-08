import type { CSSProperties } from 'react';
import type { HuskyTone } from './colors';
import { a11y, cx, paint, toneClass, toneVars } from './tone';
import './brand.css';

export type HuskyMarkDetail = 'auto' | 'full' | 'simple';

export interface HuskyMarkProps {
  /** Rendered width and height. Numbers are px. Default 24. */
  size?: number | string;
  /** Color tone. `auto` follows the app theme (html.dark). Default 'auto'. */
  tone?: HuskyTone;
  /** `auto` drops brows and pupils at 20px and below. Default 'auto'. */
  detail?: HuskyMarkDetail;
  /** Accessible name. When omitted the mark is decorative (aria-hidden). */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

export const MARK_VIEWBOX = '0 0 48 48';

// Note page whose top edge grows two husky ears; bottom-right corner is cut for the dog-ear.
const PAGE =
  'M6 20.5C6 16.6 7.6 13.9 9.5 12.4L12 5C12.5 3.6 14.2 3.3 15.1 4.4L21.2 11.2H26.8L32.9 4.4C33.8 3.3 35.5 3.6 36 5L38.5 12.4C40.4 13.9 42 16.6 42 20.5V34.6L33.6 43H13.5C9.4 43 6 39.6 6 35.5Z';
// Dog-ear: the folded-over corner, sitting on top of the page.
const FOLD = 'M42 34.6H36.2C34.7 34.6 33.6 35.7 33.6 37.2V43Z';
// Writing area doubles as the husky face mask, with a widow's-peak V between the eyes.
const MASK =
  'M10 26.8C10 22 13 18.8 17 18.8C19.7 18.8 21.8 21 24 25.4C26.2 21 28.3 18.8 31 18.8C35 18.8 38 22 38 26.8V31.4C38 32.3 37.3 33 36.4 33H36.2A4.2 4.2 0 0 0 32 37.2C32 37.9 31.5 38.4 30.8 38.4H14C11.8 38.4 10 36.6 10 34.4Z';
const NOSE = 'M21.4 30.7C23 29.9 25 29.9 26.6 30.7C26.2 32.5 25.2 33.5 24 33.5C22.8 33.5 21.8 32.5 21.4 30.7Z';
// Inner ears (fold tone) give the silhouette depth at larger sizes.
const INNER_EAR_L = 'M13.6 8.6L15.6 13.2H11.9Z';
const INNER_EAR_R = 'M34.4 8.6L36.1 13.2H32.4Z';

/** Raw mark geometry (viewBox 0 0 48 48). Colors come from the --hn-* custom properties. */
export function HuskyMarkShapes({ simple = false }: { simple?: boolean }) {
  return (
    <>
      <path d={PAGE} style={{ fill: paint('fur') }} />
      {!simple && (
        <>
          <path d={INNER_EAR_L} style={{ fill: paint('fold') }} />
          <path d={INNER_EAR_R} style={{ fill: paint('fold') }} />
        </>
      )}
      <path d={MASK} style={{ fill: paint('mask') }} />
      <path d={FOLD} style={{ fill: paint('fold') }} />
      {!simple && (
        <>
          <circle cx="16.4" cy="15.8" r="1.5" style={{ fill: paint('mask') }} />
          <circle cx="31.6" cy="15.8" r="1.5" style={{ fill: paint('mask') }} />
        </>
      )}
      <g className="hn-eyes">
        <g className="hn-eye">
          <circle cx="17.6" cy="26.6" r={simple ? 2.7 : 2.4} style={{ fill: paint('eye') }} />
          {!simple && <circle cx="17.9" cy="26.9" r="1.1" style={{ fill: paint('ink') }} />}
        </g>
        <g className="hn-eye">
          <circle cx="30.4" cy="26.6" r={simple ? 2.7 : 2.4} style={{ fill: paint('eye') }} />
          {!simple && <circle cx="30.7" cy="26.9" r="1.1" style={{ fill: paint('ink') }} />}
        </g>
      </g>
      <path d={NOSE} style={{ fill: paint('ink') }} />
    </>
  );
}

function resolveSimple(size: number | string, detail: HuskyMarkDetail): boolean {
  if (detail === 'simple') return true;
  if (detail === 'full') return false;
  const px = typeof size === 'number' ? size : /^\s*\d+(\.\d+)?(px)?\s*$/.test(size) ? parseFloat(size) : NaN;
  return Number.isFinite(px) && px <= 20;
}

/** The HuskyNote mark: a note page with husky ears, a face-mask writing area and a dog-eared corner. */
export function HuskyMark({ size = 24, tone = 'auto', detail = 'auto', title, className, style }: HuskyMarkProps) {
  const simple = resolveSimple(size, detail);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      className={cx('hn-mark', toneClass(tone), className)}
      style={{ flexShrink: 0, ...toneVars(tone), ...style }}
      {...a11y(title)}
    >
      {title && <title>{title}</title>}
      <HuskyMarkShapes simple={simple} />
    </svg>
  );
}
