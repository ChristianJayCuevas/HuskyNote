/**
 * Optional check for a newer HuskyNote release on GitHub. It is off by
 * default because it is the app's only request to an outside server; when
 * turned on it asks GitHub at most once a day for the latest release. No
 * workspace data or personal information is sent.
 */

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

const REPO = 'ChristianJayCuevas/HuskyNote';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
export const RELEASES_PAGE_URL = `https://github.com/${REPO}/releases`;

const ENABLED_KEY = 'huskynote_update_checks';
const LAST_CHECK_KEY = 'huskynote_update_last_check';
const LAST_RESULT_KEY = 'huskynote_update_last_result';
const DISMISSED_KEY = 'huskynote_update_dismissed';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type UpdateCheckResult =
  | { status: 'update'; version: string; url: string; checkedAt: number }
  | { status: 'current'; version: string; checkedAt: number }
  | { status: 'unavailable'; reason: string; checkedAt: number };

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
    // storage unavailable
  }
}

/** Compares dotted versions such as "0.5.0" and "v0.10.1". Negative if a < b. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isUpdateCheckEnabled(): boolean {
  return read(ENABLED_KEY) === 'on';
}

export function setUpdateCheckEnabled(enabled: boolean): void {
  write(ENABLED_KEY, enabled ? 'on' : 'off');
}

export function getLastUpdateResult(): UpdateCheckResult | null {
  try {
    const parsed = JSON.parse(read(LAST_RESULT_KEY) || 'null');
    return parsed && typeof parsed.status === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function dismissUpdate(version: string): void {
  write(DISMISSED_KEY, version);
}

export function isUpdateDismissed(version: string): boolean {
  return read(DISMISSED_KEY) === version;
}

/**
 * Asks GitHub for the latest release. Without `force`, does nothing unless
 * checks are turned on and a day has passed since the last check.
 */
export async function checkForUpdate({ force = false } = {}): Promise<UpdateCheckResult | null> {
  if (!force) {
    if (!isUpdateCheckEnabled()) return null;
    const last = Number(read(LAST_CHECK_KEY)) || 0;
    if (Date.now() - last < CHECK_INTERVAL_MS) return getLastUpdateResult();
  }

  const checkedAt = Date.now();
  let result: UpdateCheckResult;
  try {
    const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) {
      result = { status: 'unavailable', reason: 'No HuskyNote release has been published on GitHub yet.', checkedAt };
    } else if (res.status === 403 || res.status === 429) {
      result = {
        status: 'unavailable',
        reason: 'GitHub did not answer. The repository may be private, or the hourly request limit was reached.',
        checkedAt,
      };
    } else if (!res.ok) {
      result = { status: 'unavailable', reason: `GitHub returned an error (${res.status}).`, checkedAt };
    } else {
      const release = await res.json();
      const version = String(release.tag_name || '').replace(/^v/i, '');
      if (!version) {
        result = { status: 'unavailable', reason: 'The latest release has no version tag.', checkedAt };
      } else if (compareVersions(version, APP_VERSION) > 0) {
        result = { status: 'update', version, url: String(release.html_url || RELEASES_PAGE_URL), checkedAt };
      } else {
        result = { status: 'current', version: APP_VERSION, checkedAt };
      }
    }
  } catch {
    result = { status: 'unavailable', reason: 'Could not reach GitHub. Check your internet connection.', checkedAt };
  }

  write(LAST_CHECK_KEY, String(checkedAt));
  write(LAST_RESULT_KEY, JSON.stringify(result));
  return result;
}
