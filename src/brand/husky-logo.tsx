import type { CSSProperties } from 'react';
import type { HuskyTone } from './colors';
import { HuskyMark } from './husky-mark';
import { cx } from './tone';

export interface HuskyWordmarkProps {
  className?: string;
  style?: CSSProperties;
}

/** Live-text wordmark: "Husky" heavier, "Note" lighter, no space. Inherits color and font-size. */
export function HuskyWordmark({ className, style }: HuskyWordmarkProps) {
  return (
    <span
      className={cx('hn-wordmark', className)}
      style={{
        fontFamily: 'var(--font-brand-sans)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: 'currentColor',
        ...style,
      }}
    >
      <span style={{ fontWeight: 640 }}>Husky</span>
      <span style={{ fontWeight: 440 }}>Note</span>
    </span>
  );
}

export type HuskyLogoSize = 'sm' | 'md' | 'lg' | 'xl';

export const HUSKY_LOGO_SIZES: Record<HuskyLogoSize, { mark: number; text: number }> = {
  sm: { mark: 20, text: 15 },
  md: { mark: 24, text: 17 },
  lg: { mark: 32, text: 22 },
  xl: { mark: 48, text: 32 },
};

export interface HuskyLogoProps {
  size?: HuskyLogoSize;
  tone?: HuskyTone;
  /** Show the "HuskyNote" text next to the mark. Default true. */
  wordmark?: boolean;
  /** Accessible name for the whole lockup. Pass '' to make it decorative. Default 'HuskyNote'. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** Mark + wordmark lockup. */
export function HuskyLogo({
  size = 'md',
  tone = 'auto',
  wordmark = true,
  title = 'HuskyNote',
  className,
  style,
}: HuskyLogoProps) {
  const dims = HUSKY_LOGO_SIZES[size];
  const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  return (
    <span
      className={cx('hn-logo', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4em',
        fontSize: dims.text,
        lineHeight: 1,
        ...style,
      }}
      {...label}
    >
      <HuskyMark size={dims.mark} tone={tone} />
      {wordmark && <HuskyWordmark />}
    </span>
  );
}
