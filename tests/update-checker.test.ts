import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  APP_VERSION,
  checkForUpdate,
  compareVersions,
  dismissUpdate,
  isUpdateCheckEnabled,
  isUpdateDismissed,
  setUpdateCheckEnabled,
} from '../src/services/updates/update-checker';

const store = new Map<string, string>();
const fetchMock = vi.fn();

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('fetch', fetchMock);
});

const release = (tag: string) => ({ ok: true, status: 200, json: async () => ({ tag_name: tag, html_url: `https://github.com/x/releases/tag/${tag}` }) });

describe('compareVersions', () => {
  it('orders dotted versions numerically and ignores a leading v', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.2')).toBe(0);
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0);
    expect(compareVersions('0.5.0', '0.5.1')).toBeLessThan(0);
  });
});

describe('checkForUpdate', () => {
  it('is off by default and makes no request unless forced', async () => {
    expect(isUpdateCheckEnabled()).toBe(false);
    expect(await checkForUpdate()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a newer release and checks at most once a day', async () => {
    setUpdateCheckEnabled(true);
    fetchMock.mockResolvedValue(release('v999.0.0'));
    const first = await checkForUpdate();
    expect(first).toMatchObject({ status: 'update', version: '999.0.0' });
    await checkForUpdate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says the app is current when the latest release is not newer', async () => {
    fetchMock.mockResolvedValue(release(`v${APP_VERSION}`));
    expect(await checkForUpdate({ force: true })).toMatchObject({ status: 'current' });
  });

  it('explains a private repository or missing release instead of failing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    expect(await checkForUpdate({ force: true })).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('private') });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await checkForUpdate({ force: true })).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('No HuskyNote release') });
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await checkForUpdate({ force: true })).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('internet') });
  });

  it('remembers a dismissed version', () => {
    dismissUpdate('1.0.0');
    expect(isUpdateDismissed('1.0.0')).toBe(true);
    expect(isUpdateDismissed('1.1.0')).toBe(false);
  });
});
