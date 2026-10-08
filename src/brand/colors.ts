// HuskyNote brand constants. Plain values only, so they can be used from
// components, CSS-in-JS, the asset generator, and tests alike.

export type HuskyTone = 'auto' | 'ink' | 'snow' | 'neutral';

export interface HuskyPalette {
  /** Note page, ears, head fur */
  fur: string;
  /** Dog-ear fold, inner ears */
  fold: string;
  /** Husky-eye glacier blue */
  eye: string;
  /** Face mask, writing area, paws */
  mask: string;
  /** Pupils, nose, mouth */
  ink: string;
  /** Hairline around paws and the note card in the mascot poses */
  pawRim: string;
  /** Paper of the note card the mascot carries */
  paper: string;
}

const SHARED = { mask: '#FFFFFF', ink: '#141A24', paper: '#FFFFFF' } as const;

/** Concrete palettes. `auto` resolves to `ink` on light themes and `snow` under html.dark (see brand.css). */
export const HUSKY_TONES: Record<Exclude<HuskyTone, 'auto'>, HuskyPalette> = {
  // light backgrounds
  ink: { ...SHARED, fur: '#1B2433', fold: '#8794AA', eye: '#5AB0FF', pawRim: '#C9D1DE' },
  // dark backgrounds
  snow: { ...SHARED, fur: '#5B6B88', fold: '#8E9DB8', eye: '#6BB8FF', pawRim: '#8E9DB8' },
  // rasters that must sit on both light and dark backgrounds
  neutral: { ...SHARED, fur: '#4A5873', fold: '#9AA6BA', eye: '#5AB0FF', pawRim: '#B4BED0' },
};

export const BRAND = {
  name: 'HuskyNote',
  tagline: 'Sit. Stay. Take notes.',
  descriptor: 'Local-first AI secretary',
  description:
    'HuskyNote records and transcribes meetings, answers questions about your PDFs, and turns screen recordings into step-by-step guides. Local-first, no account, free for Windows, macOS, and Linux.',
  platforms: 'Windows · macOS · Linux',
  license: 'MIT',
} as const;

export const BRAND_COLORS = {
  husky: HUSKY_TONES,
  /** "Snowline" surface palette (light) */
  light: {
    bg: '#FAFAF7',
    band: '#F3F2ED',
    raised: '#FFFFFF',
    raised2: '#F6F5F1',
    ink: '#12161F',
    ink2: '#3F4654',
    ink3: '#646B79',
    rule: '#E4E2DA',
    controlBorder: '#A8A498',
    accent: '#1D5FD1',
    accentHover: '#174FB0',
    accentSoft: '#E3EDFF',
    eye: '#5AB0FF',
    amber: '#F5B83D',
    ok: '#187A50',
    rec: '#E5484D',
  },
  /** "Polar night" surface palette (dark) */
  dark: {
    bg: '#0B1220',
    band: '#0F1828',
    raised: '#131D30',
    raised2: '#18243A',
    ink: '#EDF1F7',
    ink2: '#B3BCCB',
    ink3: '#8691A5',
    rule: '#1E2A40',
    controlBorder: '#3A4A68',
    accent: '#8CC8FF',
    accentHover: '#A9D6FF',
    accentSoft: '#15233A',
    eye: '#6BB8FF',
    amber: '#F2B657',
    ok: '#4CC38A',
    rec: '#FF6369',
  },
  /** App-icon tile */
  tile: {
    top: '#DCEBFF',
    bottom: '#A9C9FF',
    drift: '#F5F9FF',
  },
} as const;
