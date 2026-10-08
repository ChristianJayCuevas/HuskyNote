// Minimal, dependency-free ICO and ICNS writers. Both containers store PNG data as-is
// (PNG-in-ICO is supported since Windows Vista; ICNS PNG entries since macOS 10.7).

export interface PngImage {
  /** Pixel size of the square PNG. */
  size: number;
  data: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function assertPng(data: Uint8Array, label: string): void {
  const ok = PNG_SIGNATURE.every((byte, i) => data[i] === byte);
  if (!ok) throw new Error(`${label}: not PNG data`);
}

/** Reads width/height from a PNG IHDR chunk. */
export function pngDimensions(data: Uint8Array): { width: number; height: number } {
  assertPng(data, 'pngDimensions');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Packs square PNGs (1-256px) into a Windows .ico file, smallest first. */
export function encodeIco(images: PngImage[]): Uint8Array {
  if (images.length === 0) throw new Error('encodeIco: no images');
  const sorted = [...images].sort((a, b) => a.size - b.size);
  const headerSize = 6 + 16 * sorted.length;
  const total = headerSize + sorted.reduce((sum, img) => sum + img.data.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, sorted.length, true);

  let offset = headerSize;
  sorted.forEach((img, i) => {
    if (img.size < 1 || img.size > 256) throw new Error(`encodeIco: unsupported size ${img.size}`);
    assertPng(img.data, `encodeIco ${img.size}px`);
    const { width, height } = pngDimensions(img.data);
    if (width !== img.size || height !== img.size) {
      throw new Error(`encodeIco: ${img.size}px entry is ${width}x${height}`);
    }
    const entry = 6 + i * 16;
    out[entry] = img.size === 256 ? 0 : img.size; // width (0 means 256)
    out[entry + 1] = img.size === 256 ? 0 : img.size; // height
    out[entry + 2] = 0; // palette colors
    out[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, img.data.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(img.data, offset);
    offset += img.data.length;
  });
  return out;
}

/** ICNS OSType for each pixel size. Retina types reuse the same pixel data as their 1x neighbours. */
export const ICNS_TYPES: ReadonlyArray<{ type: string; size: number }> = [
  { type: 'icp4', size: 16 },
  { type: 'icp5', size: 32 },
  { type: 'ic07', size: 128 },
  { type: 'ic08', size: 256 },
  { type: 'ic09', size: 512 },
  { type: 'ic10', size: 1024 }, // 512@2x
  { type: 'ic11', size: 32 }, // 16@2x
  { type: 'ic12', size: 64 }, // 32@2x
  { type: 'ic13', size: 256 }, // 128@2x
  { type: 'ic14', size: 512 }, // 256@2x
];

function writeOsType(out: Uint8Array, at: number, type: string): void {
  if (type.length !== 4) throw new Error(`bad OSType ${type}`);
  for (let i = 0; i < 4; i++) out[at + i] = type.charCodeAt(i);
}

/**
 * Packs PNGs into an Apple .icns file with a table of contents.
 * `bySize` must contain every size listed in ICNS_TYPES (16, 32, 64, 128, 256, 512, 1024).
 */
export function encodeIcns(bySize: Map<number, Uint8Array>): Uint8Array {
  const entries = ICNS_TYPES.map(({ type, size }) => {
    const data = bySize.get(size);
    if (!data) throw new Error(`encodeIcns: missing ${size}px image for ${type}`);
    assertPng(data, `encodeIcns ${type}`);
    const dims = pngDimensions(data);
    if (dims.width !== size || dims.height !== size) {
      throw new Error(`encodeIcns: ${type} expects ${size}px, got ${dims.width}x${dims.height}`);
    }
    return { type, data, length: 8 + data.length };
  });

  const tocLength = 8 + entries.length * 8;
  const total = 8 + tocLength + entries.reduce((sum, e) => sum + e.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  writeOsType(out, 0, 'icns');
  view.setUint32(4, total);

  let at = 8;
  writeOsType(out, at, 'TOC ');
  view.setUint32(at + 4, tocLength);
  entries.forEach((e, i) => {
    writeOsType(out, at + 8 + i * 8, e.type);
    view.setUint32(at + 12 + i * 8, e.length);
  });
  at += tocLength;

  for (const e of entries) {
    writeOsType(out, at, e.type);
    view.setUint32(at + 4, e.length);
    out.set(e.data, at + 8);
    at += e.length;
  }
  return out;
}

export interface IcoEntryInfo {
  size: number;
  bitCount: number;
  bytes: number;
  offset: number;
}

/** Parses an ICO directory (used by tests and as a self-check in the generator). */
export function readIcoDirectory(data: Uint8Array): IcoEntryInfo[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) throw new Error('not an ICO file');
  const count = view.getUint16(4, true);
  const entries: IcoEntryInfo[] = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    entries.push({
      size: data[at] || 256,
      bitCount: view.getUint16(at + 6, true),
      bytes: view.getUint32(at + 8, true),
      offset: view.getUint32(at + 12, true),
    });
  }
  return entries;
}

export interface IcnsEntryInfo {
  type: string;
  length: number;
  offset: number;
}

/** Parses the top-level ICNS entries (used by tests and as a self-check in the generator). */
export function readIcnsEntries(data: Uint8Array): IcnsEntryInfo[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(...data.subarray(0, 4));
  if (magic !== 'icns') throw new Error('not an ICNS file');
  if (view.getUint32(4) !== data.length) throw new Error('ICNS length mismatch');
  const entries: IcnsEntryInfo[] = [];
  let at = 8;
  while (at < data.length) {
    const type = String.fromCharCode(...data.subarray(at, at + 4));
    const length = view.getUint32(at + 4);
    if (length < 8 || at + length > data.length) throw new Error(`ICNS entry ${type} overruns the file`);
    entries.push({ type, length, offset: at });
    at += length;
  }
  return entries;
}
