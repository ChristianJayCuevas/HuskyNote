import Dexie from 'dexie';
import { db } from '../db';
import { DEFAULT_PROFILE_ID, getActiveProfileId } from './profiles';

/**
 * One-time migration of data stored under the pre-rebrand DomoNote names.
 * Copies localStorage keys and the IndexedDB database into their HuskyNote
 * equivalents. The legacy data is left in place so older builds keep working.
 */

const LEGACY_DB_NAME = 'DomoNoteDB';
const LEGACY_KEY_PREFIX = 'domonote_';
const KEY_PREFIX = 'huskynote_';
const MIGRATED_FLAG = 'huskynote_legacy_migrated';

export function migrateLegacyLocalStorage(storage: Storage): number {
  const legacyKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LEGACY_KEY_PREFIX)) legacyKeys.push(key);
  }

  let copied = 0;
  for (const legacyKey of legacyKeys) {
    const newKey = KEY_PREFIX + legacyKey.slice(LEGACY_KEY_PREFIX.length);
    const value = storage.getItem(legacyKey);
    if (value !== null && storage.getItem(newKey) === null) {
      storage.setItem(newKey, value);
      copied++;
    }
  }
  return copied;
}

export async function migrateLegacyDatabase(): Promise<void> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return;

  // Opening without a version declaration reads the existing schema as-is
  const legacy = new Dexie(LEGACY_DB_NAME);
  try {
    await legacy.open();
    const tableNames = legacy.tables
      .map((t) => t.name)
      .filter((name) => db.tables.some((t) => t.name === name));
    const rows = await Promise.all(tableNames.map((name) => legacy.table(name).toArray()));

    await db.transaction('rw', db.tables, async () => {
      for (let i = 0; i < tableNames.length; i++) {
        if (rows[i].length > 0) await db.table(tableNames[i]).bulkPut(rows[i]);
      }
    });
  } finally {
    legacy.close();
  }
}

/**
 * Runs both migrations once. Must complete before the app first reads the
 * database, so it is awaited before the React tree mounts.
 */
export async function migrateLegacyData(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG) === 'true') return;
    // Old DomoNote data belongs in the original database, not in another profile
    if (getActiveProfileId() !== DEFAULT_PROFILE_ID) return;
    migrateLegacyLocalStorage(localStorage);
    await migrateLegacyDatabase();
    localStorage.setItem(MIGRATED_FLAG, 'true');
  } catch (err) {
    console.warn('[HuskyNote] Legacy DomoNote data migration failed:', err);
  }
}
