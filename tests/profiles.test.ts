import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_PROFILE_ID,
  createProfile,
  getActiveProfile,
  getActiveProfileId,
  listProfiles,
  profileDatabaseName,
  removeProfile,
  renameProfile,
  setActiveProfileId,
} from '../src/services/profiles';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('profiles', () => {
  it('starts with the default profile, which keeps the original database', () => {
    expect(listProfiles().map((p) => p.id)).toEqual([DEFAULT_PROFILE_ID]);
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
    expect(profileDatabaseName(DEFAULT_PROFILE_ID)).toBe('HuskyNoteDB');
  });

  it('gives each new profile its own database', () => {
    const work = createProfile('  Acme   Corp  ');
    expect(work.name).toBe('Acme Corp');
    expect(profileDatabaseName(work.id)).toBe(`HuskyNoteDB-${work.id}`);
    expect(profileDatabaseName(work.id)).not.toBe(profileDatabaseName(DEFAULT_PROFILE_ID));
    expect(listProfiles().map((p) => p.name)).toEqual(['Personal', 'Acme Corp']);
  });

  it('rejects empty and duplicate names, ignoring case', () => {
    createProfile('Acme');
    expect(() => createProfile('   ')).toThrow('Give the profile a name.');
    expect(() => createProfile('acme')).toThrow('already exists');
    expect(() => createProfile('personal')).toThrow('already exists');
  });

  it('switches the active profile and falls back to the default if it disappears', () => {
    const work = createProfile('Acme');
    setActiveProfileId(work.id);
    expect(getActiveProfile().name).toBe('Acme');
    store.set('huskynote_profiles', '[]');
    expect(getActiveProfileId()).toBe(DEFAULT_PROFILE_ID);
    expect(() => setActiveProfileId('missing')).toThrow('no longer exists');
  });

  it('renames profiles, including the default one', () => {
    const work = createProfile('Acme');
    renameProfile(work.id, 'Acme Inc');
    renameProfile(DEFAULT_PROFILE_ID, 'Freelance');
    expect(listProfiles().map((p) => p.name)).toEqual(['Freelance', 'Acme Inc']);
    expect(() => renameProfile(work.id, 'freelance')).toThrow('already exists');
  });

  it('never removes the default profile or the one that is open', () => {
    const work = createProfile('Acme');
    expect(() => removeProfile(DEFAULT_PROFILE_ID)).toThrow('cannot be deleted');
    setActiveProfileId(work.id);
    expect(() => removeProfile(work.id)).toThrow('Switch to another profile');
    setActiveProfileId(DEFAULT_PROFILE_ID);
    removeProfile(work.id);
    expect(listProfiles().map((p) => p.id)).toEqual([DEFAULT_PROFILE_ID]);
  });

  it('ignores a corrupted profile list', () => {
    store.set('huskynote_profiles', '{not json');
    expect(listProfiles().map((p) => p.id)).toEqual([DEFAULT_PROFILE_ID]);
  });
});
