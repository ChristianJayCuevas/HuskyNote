import type { CSSProperties, ReactNode } from 'react';
import type { HuskyTone } from './colors';
import { a11y, cx, paint, toneClass, toneVars } from './tone';
import './brand.css';

export interface HuskyArtProps {
  tone?: HuskyTone;
  /** Blink every 6s and twitch the ears on hover (only with prefers-reduced-motion: no-preference). */
  animated?: boolean;
  /** Accessible name. When omitted the art is decorative (aria-hidden). */
  title?: string;
  /** Optional rendered width (px if a number); height follows the viewBox. Otherwise size it with CSS. */
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}

// "Cut paper" style: flat fills, no outlines. Shares its construction with the HuskyMark.
const EAR_L = 'M22 54L29.6 11.5C30.4 6.8 34.4 5.3 37.6 8.8L57 31Z';
const EAR_R = 'M98 54L90.4 11.5C89.6 6.8 85.6 5.3 82.4 8.8L63 31Z';
const INNER_L = 'M31 40L34.4 19.2L46.6 31.6Z';
const INNER_R = 'M89 40L85.6 19.2L73.4 31.6Z';
const HEAD = 'M60 22C86 22 104 40 104 66C104 92 85 112 60 112C35 112 16 92 16 66C16 40 34 22 60 22Z';
const MASK =
  'M22 72C22 58 31 49 43 49C50 49 55 55 60 66C65 55 70 49 77 49C89 49 98 58 98 72C98 94 81 110 60 110C39 110 22 94 22 72Z';
const NOSE = 'M51.5 80.2C56.6 77.4 63.4 77.4 68.5 80.2C67.4 85.8 64.4 89 60 89C55.6 89 52.6 85.8 51.5 80.2Z';
const MOUTH = 'M51 95Q55.5 99.5 60 95.4Q64.5 99.5 69 95';

function HeadShapes({ mouth = true }: { mouth?: boolean }) {
  return (
    <g className="hn-head">
      <g className="hn-ear hn-ear-l">
        <path d={EAR_L} style={{ fill: paint('fur') }} />
        <path d={INNER_L} style={{ fill: paint('fold') }} />
      </g>
      <g className="hn-ear hn-ear-r">
        <path d={EAR_R} style={{ fill: paint('fur') }} />
        <path d={INNER_R} style={{ fill: paint('fold') }} />
      </g>
      <path d={HEAD} style={{ fill: paint('fur') }} />
      <path d={MASK} style={{ fill: paint('mask') }} />
      <ellipse cx="42" cy="38.5" rx="6" ry="4" style={{ fill: paint('mask') }} />
      <ellipse cx="78" cy="38.5" rx="6" ry="4" style={{ fill: paint('mask') }} />
      <g className="hn-eye">
        <circle cx="44" cy="66" r="7" style={{ fill: paint('eye') }} />
        <circle cx="45" cy="67" r="3.4" style={{ fill: paint('ink') }} />
        <circle cx="47" cy="64" r="1.4" style={{ fill: paint('mask') }} />
      </g>
      <g className="hn-eye">
        <circle cx="76" cy="66" r="7" style={{ fill: paint('eye') }} />
        <circle cx="77" cy="67" r="3.4" style={{ fill: paint('ink') }} />
        <circle cx="79" cy="64" r="1.4" style={{ fill: paint('mask') }} />
      </g>
      <path d={NOSE} style={{ fill: paint('ink') }} />
      {mouth && (
        <path
          d={MOUTH}
          style={{ fill: 'none', stroke: paint('ink'), strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }}
        />
      )}
    </g>
  );
}

function ArtSvg({
  viewBox,
  tone = 'auto',
  animated = false,
  title,
  size,
  className,
  style,
  children,
}: HuskyArtProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      className={cx('hn-art', toneClass(tone), animated && 'hn-animated', className)}
      style={{ ...toneVars(tone), ...style }}
      {...a11y(title)}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Husky head (viewBox 0 0 120 120). Replaces the old sticker mascot. */
export function HuskyHead(props: HuskyArtProps) {
  return (
    <ArtSvg viewBox="0 0 120 120" {...props}>
      <HeadShapes />
    </ArtSvg>
  );
}

function Paw({ x }: { x: number }) {
  const rim = paint('pawRim');
  return (
    <g>
      <rect x={x} y="108" width="26" height="18" rx="9" style={{ fill: paint('mask'), stroke: rim, strokeWidth: 1.5 }} />
      <path
        d={`M${x + 9.5} 119.5V124.5M${x + 16.5} 119.5V124.5`}
        style={{ fill: 'none', stroke: rim, strokeWidth: 1.5, strokeLinecap: 'round' }}
      />
    </g>
  );
}

/** Head plus two paws gripping an edge (viewBox 0 0 120 132). Align the edge with y = 117. */
export function HuskyPeek(props: HuskyArtProps) {
  return (
    <ArtSvg viewBox="0 0 120 132" {...props}>
      <HeadShapes />
      <Paw x={26} />
      <Paw x={68} />
    </ArtSvg>
  );
}

/** Head carrying a dog-eared note card in its mouth (viewBox 0 0 120 132). */
export function HuskyFetch(props: HuskyArtProps) {
  const rim = paint('pawRim');
  return (
    <ArtSvg viewBox="0 0 120 132" {...props}>
      <HeadShapes mouth={false} />
      <g transform="rotate(-8 60 100)">
        <path
          d="M39 90H78L86 98V119C86 121.8 83.8 124 81 124H39C36.2 124 34 121.8 34 119V95C34 92.2 36.2 90 39 90Z"
          style={{ fill: paint('paper'), stroke: rim, strokeWidth: 1.5, strokeLinejoin: 'round' }}
        />
        <path d="M78 90V95C78 96.7 79.3 98 81 98H86Z" style={{ fill: paint('fold') }} />
        <path
          d="M41 104H70M41 111H79M41 118H62"
          style={{ fill: 'none', stroke: paint('fold'), strokeWidth: 2, strokeLinecap: 'round' }}
        />
        <path d="M41 97H58" style={{ fill: 'none', stroke: paint('eye'), strokeWidth: 2.4, strokeLinecap: 'round' }} />
      </g>
    </ArtSvg>
  );
}
