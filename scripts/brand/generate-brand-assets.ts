// Generates every HuskyNote favicon, app icon and social image from the React brand components.
//
//   npx vite-node scripts/brand/generate-brand-assets.ts [--preview <dir>]
//
// Rasterizes with Playwright using the system Edge (or Chrome); set BROWSER_CHANNEL to override.
// Output is deterministic: running it twice produces identical files.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Browser, type Page } from 'playwright';
import { HUSKY_TONES, type HuskyPalette } from '../../src/brand/colors';
import { HuskyMark } from '../../src/brand/husky-mark';
import { HuskyLogo } from '../../src/brand/husky-logo';
import { HuskyFetch, HuskyHead, HuskyPeek } from '../../src/brand/husky-art';
import { HuskyTile, type HuskyTileVariant } from '../../src/brand/husky-tile';
import { OG_HEIGHT, OG_WIDTH, OgCard } from '../../src/brand/og-card';
import { encodeIcns, encodeIco, readIcnsEntries, readIcoDirectory, type PngImage } from './icon-encoders';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BRAND_DIR = path.join(ROOT, 'src/brand');

const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');
const out = (p: string) => path.join(ROOT, p);
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex').slice(0, 12);

// ---------------------------------------------------------------------------
// markup helpers

const markup = (el: ReactElement) => renderToStaticMarkup(el);

/** Replaces var(--hn-*, fallback) with literal colors and drops --hn-* declarations, for standalone SVG files. */
function flattenVars(svg: string, palette: HuskyPalette): string {
  const values: Record<string, string> = {
    '--hn-fur': palette.fur,
    '--hn-fold': palette.fold,
    '--hn-eye': palette.eye,
    '--hn-mask': palette.mask,
    '--hn-ink': palette.ink,
    '--hn-paw-rim': palette.pawRim,
    '--hn-paper': palette.paper,
  };
  return svg
    .replace(/var\((--hn-[a-z-]+),\s*[^)]+\)/g, (_m, name: string) => values[name] ?? _m)
    .replace(/--hn-[a-z-]+:[^;"]+;?/g, '')
    .replace(/\sstyle="fill:(#[0-9A-Fa-f]{3,8})"/g, ' fill="$1"')
    .replace(/\sstyle="\s*"/g, '');
}

/** Adds the XML prolog-free niceties a standalone .svg wants. */
function standaloneSvg(svg: string): string {
  return svg
    .replace(/\s(class|aria-hidden|focusable)="[^"]*"/g, '')
    .replace(/flex-shrink:0;?/g, '')
    .replace(/\sstyle="\s*"/g, '')
    .replace(/\stransform="translate\(0 0\) scale\(1\)"/g, '')
    .replace(/\swidth="[^"]*"\sheight="[^"]*"/, '') + '\n';
}

function fontFace(family: string, file: string): string {
  const data = fs.readFileSync(path.join(ROOT, 'node_modules', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
}

const FONT_CSS = [
  fontFace('Geist Variable', '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'),
  fontFace('Geist Mono Variable', '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'),
  fs.readFileSync(path.join(BRAND_DIR, 'fonts.css'), 'utf8'),
].join('\n');

const BRAND_CSS = fs.readFileSync(path.join(BRAND_DIR, 'brand.css'), 'utf8');

function htmlDoc(body: string, { dark = false, bg = 'transparent', fonts = false } = {}): string {
  return `<!doctype html><html class="${dark ? 'dark' : 'light'}"><head><meta charset="utf-8"><style>
${fonts ? FONT_CSS : ''}
${BRAND_CSS}
html,body{margin:0;padding:0;background:${bg};}
body{-webkit-font-smoothing:antialiased;}
svg{display:block;}
</style></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// browser

async function launch(): Promise<Browser> {
  const preferred = process.env.BROWSER_CHANNEL || 'msedge';
  const attempts = [preferred, 'chrome', 'msedge', undefined].filter((c, i, a) => a.indexOf(c) === i);
  let lastError: unknown;
  for (const channel of attempts) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function screenshot(page: Page, html: string, width: number, height: number, transparent = true): Promise<Buffer> {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
}

async function rasterTile(page: Page, variant: HuskyTileVariant, size: number): Promise<Buffer> {
  return screenshot(page, htmlDoc(markup(createElement(HuskyTile, { variant, size }))), size, size);
}

// ---------------------------------------------------------------------------
// outputs

const written: Array<{ file: string; bytes: number; hash: string }> = [];

function write(file: string, data: Uint8Array | string): void {
  const abs = out(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  const bytes = typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength;
  written.push({ file, bytes, hash: sha(data) });
}

function faviconSvg(): string {
  const ink = HUSKY_TONES.ink;
  const snow = HUSKY_TONES.snow;
  const svg = markup(createElement(HuskyMark, { size: 48, tone: 'ink', detail: 'simple', title: 'HuskyNote' }))
    // tone vars move into the embedded stylesheet so the icon can follow the browser theme
    .replace(/--hn-[a-z-]+:[^;"]+;?/g, '');
  const style =
    `<style>svg{--hn-fur:${ink.fur};--hn-fold:${ink.fold};--hn-eye:${ink.eye};--hn-mask:${ink.mask};--hn-ink:${ink.ink}}` +
    `@media (prefers-color-scheme:dark){svg{--hn-fur:${snow.fur};--hn-fold:${snow.fold};--hn-eye:${snow.eye}}}</style>`;
  return standaloneSvg(svg.replace(/(<svg[^>]*>)/, `$1${style}`));
}

async function generate(page: Page): Promise<void> {
  // Vector files
  write('public/favicon.svg', faviconSvg());
  write(
    'public/brand/huskynote-mark.svg',
    standaloneSvg(flattenVars(markup(createElement(HuskyMark, { size: 48, tone: 'ink', detail: 'full', title: 'HuskyNote' })), HUSKY_TONES.ink)),
  );
  write(
    'public/brand/huskynote-tile.svg',
    standaloneSvg(
      flattenVars(markup(createElement(HuskyTile, { variant: 'standard', size: 1024, title: 'HuskyNote' })), HUSKY_TONES.ink),
    ),
  );

  // Windows / browser ICO: crisp small tile for 16-32, standard tile above
  const icoImages: PngImage[] = [];
  for (const size of [16, 24, 32]) icoImages.push({ size, data: await rasterTile(page, 'small', size) });
  for (const size of [48, 64, 128, 256]) icoImages.push({ size, data: await rasterTile(page, 'standard', size) });
  const ico = encodeIco(icoImages);
  const icoDir = readIcoDirectory(ico);
  if (icoDir.length !== 7 || icoDir.at(-1)?.size !== 256) throw new Error('ICO self-check failed');
  write('public/favicon.ico', ico);
  write('desktop/windows/favicon.ico', ico);
  write('desktop/installer/favicon.ico', ico);

  // PNG icons
  const tile1024 = await rasterTile(page, 'standard', 1024);
  write('public/official_huskynote.png', tile1024);
  write('src/assets/official_huskynote.png', tile1024);
  write('public/favicon.png', await rasterTile(page, 'standard', 512));
  write('public/apple-touch-icon.png', await rasterTile(page, 'bleed', 180));
  write('desktop/linux/huskynote.png', await rasterTile(page, 'standard', 256));
  write('browser-extension/icon.png', await rasterTile(page, 'standard', 128));

  // Mascot raster for the legacy <img> mascot (transparent, works on light and dark)
  write(
    'src/assets/husky-mascot.png',
    await screenshot(page, htmlDoc(markup(createElement(HuskyHead, { tone: 'neutral', size: 1024 }))), 1024, 1024),
  );

  // macOS icon
  const icnsSizes = new Map<number, Uint8Array>();
  for (const size of [16, 32, 64, 128, 256, 512, 1024]) icnsSizes.set(size, await rasterTile(page, 'macos', size));
  const icns = encodeIcns(icnsSizes);
  if (readIcnsEntries(icns)[0]?.type !== 'TOC ') throw new Error('ICNS self-check failed');
  write('AppIcon.icns', icns);

  // Social card
  const og = await screenshot(page, htmlDoc(markup(createElement(OgCard)), { fonts: true, bg: '#FAFAF7' }), OG_WIDTH, OG_HEIGHT, false);
  write('public/brand/og-image.png', og);
}

// ---------------------------------------------------------------------------
// contact sheet

function cell(label: string, content: string): string {
  return `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:8px">${content}<figcaption style="font:11px var(--font-brand-mono);opacity:.65">${label}</figcaption></figure>`;
}

function row(title: string, cells: string[]): string {
  return `<section style="margin:0 0 28px"><h2 style="font:600 13px var(--font-brand-sans);margin:0 0 12px;opacity:.8">${title}</h2><div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px">${cells.join('')}</div></section>`;
}

function sheetBody(dark: boolean): string {
  const fg = dark ? '#EDF1F7' : '#12161F';
  const sizes = [16, 20, 24, 32, 48, 64, 128, 256];
  const marks = sizes.map((s) => cell(`${s}`, markup(createElement(HuskyMark, { size: s }))));
  const logos = (['sm', 'md', 'lg', 'xl'] as const).map((s) => cell(s, markup(createElement(HuskyLogo, { size: s }))));
  const art = [
    cell('HuskyHead', markup(createElement(HuskyHead, { size: 240 }))),
    cell('HuskyPeek', markup(createElement(HuskyPeek, { size: 240 }))),
    cell('HuskyFetch', markup(createElement(HuskyFetch, { size: 240 }))),
    cell('HuskyHead neutral', markup(createElement(HuskyHead, { size: 240, tone: 'neutral' }))),
  ];
  const tiles = (['small', 'standard', 'macos', 'bleed'] as const).flatMap((variant) =>
    [16, 32, 64, 128].map((s) => cell(`${variant} ${s}`, markup(createElement(HuskyTile, { variant, size: s })))),
  );
  const zoom = [16, 24, 32].map((s) =>
    cell(
      `mark ${s} x6`,
      `<div style="width:${s}px;height:${s}px;transform:scale(6);transform-origin:top left;margin:0 ${s * 5}px ${s * 5}px 0">${markup(createElement(HuskyMark, { size: s }))}</div>`,
    ),
  );
  const rasters = [
    ['favicon.ico entries', 'public/favicon.ico'],
    ['apple-touch-icon', 'public/apple-touch-icon.png'],
    ['linux 256', 'desktop/linux/huskynote.png'],
    ['extension 128', 'browser-extension/icon.png'],
    ['husky-mascot', 'src/assets/husky-mascot.png'],
  ].map(([label, file]) => {
    const data = fs.readFileSync(out(file));
    if (file.endsWith('.ico')) {
      const entries = readIcoDirectory(data);
      return cell(
        label,
        `<div style="display:flex;gap:10px;align-items:flex-end">${entries
          .map((e) => {
            const b64 = Buffer.from(data.subarray(e.offset, e.offset + e.bytes)).toString('base64');
            const shown = e.size <= 32 ? e.size * 4 : Math.min(e.size, 128);
            return `<img width="${shown}" height="${shown}" style="image-rendering:pixelated" src="data:image/png;base64,${b64}">`;
          })
          .join('')}</div>`,
      );
    }
    return cell(label, `<img width="128" height="128" src="data:image/png;base64,${data.toString('base64')}">`);
  });
  const favicon = cell('favicon.svg', `<img width="64" height="64" src="data:image/svg+xml;base64,${fs.readFileSync(out('public/favicon.svg')).toString('base64')}">`);
  const large = [
    cell('mark 320', markup(createElement(HuskyMark, { size: 320 }))),
    cell('tile standard 320', markup(createElement(HuskyTile, { size: 320 }))),
    cell('tile macos 320', markup(createElement(HuskyTile, { size: 320, variant: 'macos' }))),
  ];
  return `<div style="padding:32px;color:${fg};font-family:var(--font-brand-sans)">
${row('Large', large)}
${row('HuskyMark (tone auto)', marks)}
${row('Small sizes zoomed 6x', zoom)}
${row('HuskyLogo', logos)}
${row('Mascot', art)}
${row('HuskyTile', tiles)}
${row('Generated rasters', [...rasters, favicon])}
</div>`;
}

async function preview(page: Page, dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  for (const dark of [false, true]) {
    const bg = dark ? '#0B1220' : '#FAFAF7';
    const html = htmlDoc(sheetBody(dark), { dark, bg, fonts: true });
    const name = dark ? 'contact-dark' : 'contact-light';
    fs.writeFileSync(path.join(dir, `${name}.html`), html);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: 'light' });
  fs.copyFileSync(out('public/brand/og-image.png'), path.join(dir, 'og-image.png'));
  console.log(`contact sheets written to ${dir}`);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const previewIndex = args.indexOf('--preview');
  const previewDir = previewIndex >= 0 ? path.resolve(args[previewIndex + 1] ?? 'brand-preview') : null;

  const browser = await launch();
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await generate(page);
    if (previewDir) await preview(page, previewDir);
  } finally {
    await browser.close();
  }

  for (const w of written) console.log(`${w.hash}  ${String(w.bytes).padStart(8)}  ${rel(out(w.file))}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
