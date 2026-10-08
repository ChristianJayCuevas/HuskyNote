import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HuskyFetch, HuskyHead, HuskyLogo, HuskyMark, HuskyPeek, HuskyTile, HuskyWordmark } from '../src/brand';

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));

// Must match the keywords detectAppFromTab() in src/services/audio/visual-participant-scanner.ts sniffs
const SCANNER_KEYWORDS = ['meet', 'google', 'teams', 'microsoft', 'zoom', 'webex', 'cisco', 'slack', 'discord', 'jitsi', '8x8'];

describe('index.html head', () => {
  it('has a HuskyNote title without meeting-app keywords', () => {
    const title = /<title>([^<]*)<\/title>/.exec(head)?.[1] ?? '';
    expect(title).toContain('HuskyNote');
    for (const keyword of SCANNER_KEYWORDS) expect(title.toLowerCase()).not.toContain(keyword);
  });

  it('loads no third-party fonts', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it('points every icon link at a file in public/', () => {
    const links = [...head.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon|shortcut icon)"[^>]*>/g)];
    const hrefs = links.map((m) => /href="([^"]+)"/.exec(m[0])?.[1] ?? '');
    expect(hrefs).toEqual(expect.arrayContaining(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']));
    for (const href of hrefs) {
      expect(href.startsWith('/')).toBe(true);
      expect(fs.existsSync(path.join(ROOT, 'public', href))).toBe(true);
    }
  });

  it('has a description and an Open Graph image that exists', () => {
    expect(head).toMatch(/<meta name="description" content="[^"]{40,}"/);
    const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(head)?.[1] ?? '';
    expect(ogImage).toBe('/brand/og-image.png');
    expect(fs.existsSync(path.join(ROOT, 'public', ogImage))).toBe(true);
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
  });
});

describe('brand components', () => {
  type Titled = ComponentType<{ title?: string }>;
  const components: Array<[string, Titled]> = [
    ['HuskyMark', HuskyMark],
    ['HuskyHead', HuskyHead],
    ['HuskyPeek', HuskyPeek],
    ['HuskyFetch', HuskyFetch],
    ['HuskyTile', HuskyTile],
  ];

  it.each(components)('%s renders on the server and is decorative unless titled', (_name, Component) => {
    expect(renderToStaticMarkup(createElement(Component))).toContain('aria-hidden="true"');
    const titled = renderToStaticMarkup(createElement(Component, { title: 'HuskyNote' }));
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>HuskyNote</title>');
  });

  it('simplifies the mark at 20px and below when detail is auto', () => {
    const circles = (markup: string) => (markup.match(/<circle/g) ?? []).length;
    const small = renderToStaticMarkup(createElement(HuskyMark, { size: 16 }));
    const large = renderToStaticMarkup(createElement(HuskyMark, { size: 64 }));
    expect(circles(small)).toBeLessThan(circles(large));
    expect(circles(renderToStaticMarkup(createElement(HuskyMark, { size: 16, detail: 'full' })))).toBe(circles(large));
  });

  it('applies fixed tones as custom properties and auto via the theme class', () => {
    expect(renderToStaticMarkup(createElement(HuskyMark, { tone: 'auto' }))).toContain('hn-tone-auto');
    expect(renderToStaticMarkup(createElement(HuskyMark, { tone: 'snow' }))).toContain('--hn-fur:#5B6B88');
  });

  it('logo exposes one accessible name and a live-text wordmark', () => {
    const logo = renderToStaticMarkup(createElement(HuskyLogo, { size: 'lg' }));
    expect(logo).toContain('aria-label="HuskyNote"');
    expect(logo).toContain('>Husky<');
    expect(logo).toContain('>Note<');
    expect(renderToStaticMarkup(createElement(HuskyWordmark))).toContain('var(--font-brand-sans)');
    expect(renderToStaticMarkup(createElement(HuskyLogo, { wordmark: false }))).not.toContain('>Husky<');
  });

  it('gives each tile unique, colon-free SVG ids', () => {
    const markup = renderToStaticMarkup(createElement('div', null, createElement(HuskyTile), createElement(HuskyTile)));
    const ids = [...markup.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).not.toContain(':');
  });
});
