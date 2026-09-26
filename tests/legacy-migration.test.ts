import { describe, it, expect } from 'vitest';
import { migrateLegacyLocalStorage } from '../src/services/legacy-migration';

function createStorage(initial: Record<string, string>): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe('Legacy DomoNote Storage Migration', () => {
  it('copies domonote_ keys to huskynote_ keys and keeps the originals', () => {
    const storage = createStorage({
      domonote_theme: 'light',
      domonote_language: 'ja',
      unrelated_key: 'x',
    });

    expect(migrateLegacyLocalStorage(storage)).toBe(2);
    expect(storage.getItem('huskynote_theme')).toBe('light');
    expect(storage.getItem('huskynote_language')).toBe('ja');
    expect(storage.getItem('domonote_theme')).toBe('light');
    expect(storage.getItem('huskyunrelated_key')).toBeNull();
  });

  it('does not overwrite values already saved under the new keys', () => {
    const storage = createStorage({
      domonote_theme: 'light',
      huskynote_theme: 'dark',
    });

    expect(migrateLegacyLocalStorage(storage)).toBe(0);
    expect(storage.getItem('huskynote_theme')).toBe('dark');
  });
});
