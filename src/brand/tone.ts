import type { CSSProperties } from 'react';
import { HUSKY_TONES, type HuskyPalette, type HuskyTone } from './colors';

type PaletteKey = keyof HuskyPalette;

const VAR_NAMES: Record<PaletteKey, string> = {
  fur: '--hn-fur',
  fold: '--hn-fold',
  eye: '--hn-eye',
  mask: '--hn-mask',
  ink: '--hn-ink',
  pawRim: '--hn-paw-rim',
  paper: '--hn-paper',
};

/** `var(--hn-fur, #1B2433)` etc. The fallback is the ink tone so markup renders without brand.css. */
export function paint(key: PaletteKey): string {
  return `var(${VAR_NAMES[key]}, ${HUSKY_TONES.ink[key]})`;
}

/** Inline custom properties for a fixed tone; `auto` relies on the .hn-tone-auto class instead. */
export function toneVars(tone: HuskyTone): CSSProperties | undefined {
  if (tone === 'auto') return undefined;
  const palette = HUSKY_TONES[tone];
  const vars: Record<string, string> = {};
  (Object.keys(VAR_NAMES) as PaletteKey[]).forEach((key) => {
    vars[VAR_NAMES[key]] = palette[key];
  });
  return vars as CSSProperties;
}

export function toneClass(tone: HuskyTone): string | undefined {
  return tone === 'auto' ? 'hn-tone-auto' : undefined;
}

export function cx(...parts: Array<string | false | null | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

/** SVG-safe id from React's useId() (which contains colons). */
export function safeId(id: string): string {
  return id.replace(/:/g, '');
}

/** Accessibility attributes shared by all brand SVGs. */
export function a11y(title: string | undefined): Record<string, string | boolean> {
  return title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: 'false' };
}
