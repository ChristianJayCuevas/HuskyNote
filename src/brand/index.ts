// HuskyNote brand system. Import from '@/brand' (or a relative path to src/brand).
// Fonts are loaded once from src/main.tsx via './brand/fonts'; do not import them again.
import './brand.css';

export { BRAND, BRAND_COLORS, HUSKY_TONES } from './colors';
export type { HuskyTone, HuskyPalette } from './colors';
export { HuskyMark, HuskyMarkShapes, MARK_VIEWBOX } from './husky-mark';
export type { HuskyMarkProps, HuskyMarkDetail } from './husky-mark';
export { HuskyLogo, HuskyWordmark, HUSKY_LOGO_SIZES } from './husky-logo';
export type { HuskyLogoProps, HuskyLogoSize, HuskyWordmarkProps } from './husky-logo';
export { HuskyHead, HuskyPeek, HuskyFetch } from './husky-art';
export type { HuskyArtProps } from './husky-art';
export { HuskyTile } from './husky-tile';
export type { HuskyTileProps, HuskyTileVariant } from './husky-tile';
