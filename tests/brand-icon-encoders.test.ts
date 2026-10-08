import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ICNS_TYPES,
  encodeIcns,
  encodeIco,
  pngDimensions,
  readIcnsEntries,
  readIcoDirectory,
} from '../scripts/brand/icon-encoders';

const ROOT = path.resolve(__dirname, '..');

/** Smallest byte sequence the encoders accept: PNG signature + IHDR with the given size + filler. */
function fakePng(size: number, filler = 16): Uint8Array {
  const data = new Uint8Array(8 + 8 + 13 + filler);
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(data.buffer);
  view.setUint32(8, 13);
  data.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, size);
  view.setUint32(20, size);
  data.fill(size & 0xff, 29);
  return data;
}

const readBytes = (file: string) => new Uint8Array(fs.readFileSync(path.join(ROOT, file)));

describe('encodeIco', () => {
  it('writes the header, directory and PNG payloads with correct offsets', () => {
    const sizes = [256, 16, 32, 48];
    const ico = encodeIco(sizes.map((size) => ({ size, data: fakePng(size, size) })));
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(4);

    const entries = readIcoDirectory(ico);
    expect(entries.map((e) => e.size)).toEqual([16, 32, 48, 256]); // sorted; a 0 byte decodes as 256
    expect(ico[6 + 3 * 16]).toBe(0); // 256px is stored as 0

    let expectedOffset = 6 + 16 * entries.length;
    for (const entry of entries) {
      expect(entry.bitCount).toBe(32);
      expect(entry.offset).toBe(expectedOffset);
      expect(entry.bytes).toBe(fakePng(entry.size, entry.size).length);
      expect(pngDimensions(ico.subarray(entry.offset, entry.offset + entry.bytes)).width).toBe(entry.size);
      expectedOffset += entry.bytes;
    }
    expect(expectedOffset).toBe(ico.length);
  });

  it('rejects non-PNG data, mismatched sizes, sizes above 256 and empty input', () => {
    expect(() => encodeIco([{ size: 16, data: new Uint8Array(40) }])).toThrow();
    expect(() => encodeIco([{ size: 16, data: fakePng(32) }])).toThrow();
    expect(() => encodeIco([{ size: 512, data: fakePng(512) }])).toThrow();
    expect(() => encodeIco([])).toThrow();
  });
});

describe('encodeIcns', () => {
  const allSizes = () => new Map([16, 32, 64, 128, 256, 512, 1024].map((s) => [s, fakePng(s)]));

  it('writes magic, total length, a TOC and every PNG entry type', () => {
    const icns = encodeIcns(allSizes());
    const view = new DataView(icns.buffer);
    expect(String.fromCharCode(...icns.subarray(0, 4))).toBe('icns');
    expect(view.getUint32(4)).toBe(icns.length);

    const entries = readIcnsEntries(icns);
    expect(entries[0].type).toBe('TOC ');
    expect(entries.slice(1).map((e) => e.type)).toEqual([
      'icp4',
      'icp5',
      'ic07',
      'ic08',
      'ic09',
      'ic10',
      'ic11',
      'ic12',
      'ic13',
      'ic14',
    ]);

    // The TOC lists the same types and lengths as the entries that follow it
    const toc = entries[0];
    expect(toc.length).toBe(8 + 8 * ICNS_TYPES.length);
    entries.slice(1).forEach((entry, i) => {
      const at = toc.offset + 8 + i * 8;
      expect(String.fromCharCode(...icns.subarray(at, at + 4))).toBe(entry.type);
      expect(view.getUint32(at + 4)).toBe(entry.length);
      const png = icns.subarray(entry.offset + 8, entry.offset + entry.length);
      expect(pngDimensions(png).width).toBe(ICNS_TYPES[i].size);
    });
  });

  it('requires every size', () => {
    const sizes = allSizes();
    sizes.delete(64);
    expect(() => encodeIcns(sizes)).toThrow(/64px/);
  });
});

describe('generated icon files', () => {
  it.each(['public/favicon.ico', 'desktop/windows/favicon.ico', 'desktop/installer/favicon.ico'])(
    '%s holds PNG entries from 16 to 256px',
    (file) => {
      const data = readBytes(file);
      const entries = readIcoDirectory(data);
      expect(entries.map((e) => e.size)).toEqual([16, 24, 32, 48, 64, 128, 256]);
      for (const entry of entries) {
        expect(pngDimensions(data.subarray(entry.offset, entry.offset + entry.bytes)).width).toBe(entry.size);
      }
    },
  );

  it('AppIcon.icns (copied by build-macos.yml) is a valid ICNS with every size', () => {
    const types = readIcnsEntries(readBytes('AppIcon.icns')).map((e) => e.type);
    for (const { type } of ICNS_TYPES) expect(types).toContain(type);
  });

  it.each([
    ['public/favicon.png', 512],
    ['public/apple-touch-icon.png', 180],
    ['public/official_huskynote.png', 1024],
    ['src/assets/official_huskynote.png', 1024],
    ['src/assets/husky-mascot.png', 1024],
    ['desktop/linux/huskynote.png', 256],
    ['browser-extension/icon.png', 128],
  ] as const)('%s is %ipx square', (file, size) => {
    expect(pngDimensions(readBytes(file))).toEqual({ width: size, height: size });
  });

  it('og-image is 1200x630', () => {
    expect(pngDimensions(readBytes('public/brand/og-image.png'))).toEqual({ width: 1200, height: 630 });
  });
});
