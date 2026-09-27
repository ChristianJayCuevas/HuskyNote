/**
 * Inspects and removes the speech model files each engine caches in the
 * browser: parakeet.js keeps them in its own IndexedDB database, and
 * transformers.js (Whisper, Moonshine) in Cache Storage. Downloads are
 * per browser profile and per app address, so a model fetched at one
 * address is not visible from another.
 */
import type { TranscriptionEngine } from './transcription-engines';

// Storage names used by the libraries (parakeet.js hub.js, transformers.js hub.js)
const PARAKEET_DB = 'parakeet-cache-db';
const PARAKEET_STORE = 'file-store';
const TRANSFORMERS_CACHE = 'transformers-cache';

export interface CachedModelVariant {
  /** 'gpu' or 'cpu' for Parakeet, where the two versions are separate files; 'all' otherwise */
  id: 'gpu' | 'cpu' | 'all';
  bytes: number;
}

export interface CachedModelInfo {
  bytes: number;
  variants: CachedModelVariant[];
}

/**
 * Opens the parakeet.js database only if it already exists. Opening a
 * missing database would create it without its object store, and
 * parakeet.js could then never cache a download.
 */
async function openParakeetDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return null;
  const dbs = await indexedDB.databases();
  if (!dbs.some((d) => d.name === PARAKEET_DB)) return null;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(PARAKEET_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!db.objectStoreNames.contains(PARAKEET_STORE)) {
    db.close();
    return null;
  }
  return db;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** parakeet.js cache keys are `hf-${repoId}-${revision}-${subfolder}-${filename}` */
function parakeetPrefix(engine: TranscriptionEngine & { runtime: 'parakeet' }): string {
  return `hf-${engine.cacheRepo}-main--`;
}

/** Encoder and decoder files carry their quantization in the name; the vocab is shared. */
function parakeetVariant(file: string): 'gpu' | 'cpu' | null {
  if (/\.fp16\.onnx$/.test(file)) return 'gpu';
  if (/\.int8\.onnx$/.test(file)) return 'cpu';
  return null;
}

async function parakeetEntries(engine: TranscriptionEngine & { runtime: 'parakeet' }) {
  const db = await openParakeetDb();
  if (!db) return { db: null, entries: [] as { key: string; file: string; bytes: number }[] };
  const store = db.transaction(PARAKEET_STORE, 'readonly').objectStore(PARAKEET_STORE);
  const prefix = parakeetPrefix(engine);
  const keys = (await request(store.getAllKeys())).map(String).filter((k) => k.startsWith(prefix));
  const entries = await Promise.all(
    keys.map(async (key) => {
      const blob = (await request(store.get(key))) as Blob | undefined;
      return { key, file: key.slice(prefix.length), bytes: blob?.size ?? 0 };
    })
  );
  return { db, entries };
}

function transformersPrefix(engine: TranscriptionEngine & { runtime: 'transformers' }): string {
  return `https://huggingface.co/${engine.model}/resolve/`;
}

async function transformersEntries(engine: TranscriptionEngine & { runtime: 'transformers' }) {
  if (typeof caches === 'undefined' || !(await caches.has(TRANSFORMERS_CACHE))) {
    return { cache: null, entries: [] as { request: Request; bytes: number }[] };
  }
  const cache = await caches.open(TRANSFORMERS_CACHE);
  const prefix = transformersPrefix(engine);
  const requests = (await cache.keys()).filter((r) => r.url.startsWith(prefix));
  const entries = await Promise.all(
    requests.map(async (request) => {
      const res = await cache.match(request);
      const length = Number(res?.headers.get('content-length'));
      return { request, bytes: Number.isFinite(length) && length > 0 ? length : (await res?.blob())?.size ?? 0 };
    })
  );
  return { cache, entries };
}

/** What of this engine is downloaded on this device, or null if nothing. */
export async function getCachedModel(engine: TranscriptionEngine): Promise<CachedModelInfo | null> {
  try {
    if (engine.runtime === 'parakeet') {
      const { db, entries } = await parakeetEntries(engine);
      db?.close();
      const byVariant = { gpu: 0, cpu: 0 };
      let shared = 0;
      for (const e of entries) {
        const v = parakeetVariant(e.file);
        if (v) byVariant[v] += e.bytes;
        else shared += e.bytes;
      }
      const variants = (['gpu', 'cpu'] as const)
        .filter((id) => byVariant[id] > 0)
        .map((id) => ({ id, bytes: byVariant[id] }));
      if (variants.length === 0) return null;
      return { bytes: byVariant.gpu + byVariant.cpu + shared, variants };
    }
    const { entries } = await transformersEntries(engine);
    const bytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    return bytes > 0 ? { bytes, variants: [{ id: 'all', bytes }] } : null;
  } catch (err) {
    console.warn(`[HuskyNote] Could not read the ${engine.name} download:`, err);
    return null;
  }
}

/**
 * Deletes an engine's downloaded files. For Parakeet, `variant` removes only
 * the GPU or CPU version; the shared vocabulary goes once neither is left.
 */
export async function removeCachedModel(engine: TranscriptionEngine, variant: CachedModelVariant['id'] = 'all'): Promise<void> {
  if (engine.runtime === 'parakeet') {
    const { db, entries } = await parakeetEntries(engine);
    if (!db) return;
    const remaining = new Set(entries.map((e) => parakeetVariant(e.file)).filter(Boolean));
    if (variant !== 'all') remaining.delete(variant);
    else remaining.clear();
    const doomed = entries.filter((e) => {
      const v = parakeetVariant(e.file);
      return v ? variant === 'all' || v === variant : remaining.size === 0;
    });
    const tx = db.transaction(PARAKEET_STORE, 'readwrite');
    const store = tx.objectStore(PARAKEET_STORE);
    doomed.forEach((e) => store.delete(e.key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return;
  }
  const { cache, entries } = await transformersEntries(engine);
  if (!cache) return;
  await Promise.all(entries.map((e) => cache.delete(e.request)));
}

/**
 * Asks the browser not to evict downloaded models when disk space runs low.
 * Chromium grants this without a prompt for sites the user engages with.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
