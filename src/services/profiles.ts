/**
 * Profiles keep separate workspaces (for example one per job or project) on
 * the same device. Each profile has its own database, so notes, meetings,
 * documents, manuals, schedule, and settings never mix. Device preferences
 * such as theme, language, and microphone are shared by all profiles.
 *
 * The profile list lives in localStorage; switching stores the new choice
 * and reloads the app so every screen opens the other profile's database.
 */

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

const PROFILES_KEY = 'huskynote_profiles';
const ACTIVE_KEY = 'huskynote_active_profile';

/** The profile that owns the original database, so existing data needs no migration */
export const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE: Profile = { id: DEFAULT_PROFILE_ID, name: 'Personal', createdAt: 0 };

export const MAX_PROFILE_NAME_LENGTH = 40;

export function profileDatabaseName(profileId: string): string {
  return profileId === DEFAULT_PROFILE_ID ? 'HuskyNoteDB' : `HuskyNoteDB-${profileId}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable; the change lasts for this page only
  }
}

/** All profiles, the default one first. */
export function listProfiles(): Profile[] {
  let stored: Profile[] = [];
  try {
    const parsed = JSON.parse(read(PROFILES_KEY) || '[]');
    if (Array.isArray(parsed)) {
      stored = parsed.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string');
    }
  } catch {
    stored = [];
  }
  const custom = stored.find((p) => p.id === DEFAULT_PROFILE_ID);
  return [{ ...DEFAULT_PROFILE, ...custom }, ...stored.filter((p) => p.id !== DEFAULT_PROFILE_ID)];
}

function save(profiles: Profile[]): void {
  write(PROFILES_KEY, JSON.stringify(profiles));
}

export function getActiveProfileId(): string {
  const id = read(ACTIVE_KEY);
  return id && listProfiles().some((p) => p.id === id) ? id : DEFAULT_PROFILE_ID;
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  return listProfiles().find((p) => p.id === id) ?? DEFAULT_PROFILE;
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_PROFILE_NAME_LENGTH);
  if (!trimmed) throw new Error('Give the profile a name.');
  return trimmed;
}

function assertUnique(name: string, exceptId?: string): void {
  const taken = listProfiles().some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
  if (taken) throw new Error(`A profile named "${name}" already exists.`);
}

export function createProfile(name: string): Profile {
  const clean = cleanName(name);
  assertUnique(clean);
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'profile';
  const profile: Profile = { id: `${slug}-${Date.now().toString(36)}`, name: clean, createdAt: Date.now() };
  save([...listProfiles(), profile]);
  return profile;
}

/** Publish a fully restored database only after its transaction commits. Fail loudly on quota errors. */
export function registerRestoredProfile(profile: Profile): void {
  const name = cleanName(profile.name);
  assertUnique(name);
  if (!/^restore-[a-f0-9-]+$/.test(profile.id) || listProfiles().some((p) => p.id === profile.id)) {
    throw new Error('Invalid restored profile identifier.');
  }
  localStorage.setItem(PROFILES_KEY, JSON.stringify([...listProfiles(), { ...profile, name }]));
}

export function renameProfile(id: string, name: string): void {
  const clean = cleanName(name);
  assertUnique(clean, id);
  save(listProfiles().map((p) => (p.id === id ? { ...p, name: clean } : p)));
}

/**
 * Removes a profile from the list. The caller deletes its database. The
 * default profile and the profile currently open cannot be removed.
 */
export function removeProfile(id: string): void {
  if (id === DEFAULT_PROFILE_ID) throw new Error('The default profile cannot be deleted.');
  if (id === getActiveProfileId()) throw new Error('Switch to another profile before deleting this one.');
  save(listProfiles().filter((p) => p.id !== id));
}

/** Makes `id` the profile the app opens. The caller reloads the app. */
export function setActiveProfileId(id: string): void {
  if (!listProfiles().some((p) => p.id === id)) throw new Error('That profile no longer exists.');
  write(ACTIVE_KEY, id);
}
