import { describe, it, expect } from 'vitest';
import { detectOS, getCtas } from '../src/components/landing/cta';

const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ubuntuFirefox: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

describe('detectOS', () => {
  it('recognises the three desktop platforms from the user agent', () => {
    expect(detectOS(UA.windows, 'Win32')).toBe('windows');
    expect(detectOS(UA.mac, 'MacIntel')).toBe('macos');
    expect(detectOS(UA.linux, 'Linux x86_64')).toBe('linux');
    expect(detectOS(UA.ubuntuFirefox, '')).toBe('linux');
  });

  it('prefers the platform string (userAgentData) when given', () => {
    expect(detectOS('', 'Windows')).toBe('windows');
    expect(detectOS('', 'macOS')).toBe('macos');
    expect(detectOS('', 'Linux')).toBe('linux');
  });

  it('treats phones and tablets as unknown, even though their user agents mention Linux or Mac OS', () => {
    expect(detectOS(UA.android, 'Linux armv8l')).toBe('unknown');
    expect(detectOS(UA.iphone, 'iPhone')).toBe('unknown');
    expect(detectOS(UA.ipad, 'iPad')).toBe('unknown');
  });

  it('returns unknown for Chromebooks and empty input', () => {
    expect(detectOS(UA.chromebook, 'Linux x86_64')).toBe('unknown');
    expect(detectOS('', '')).toBe('unknown');
    expect(detectOS()).toBe('unknown');
  });
});

describe('getCtas', () => {
  it('local browser: open the workspace, with the desktop app as the secondary action', () => {
    const ctas = getCtas({ isCloudHost: false, isDesktop: false, os: 'windows' });
    expect(ctas.primary).toEqual({ action: 'open-app' });
    expect(ctas.secondary).toEqual({ action: 'desktop-app' });
    expect(ctas.nav).toEqual({ action: 'open-app' });
  });

  it('desktop app: only "Open HuskyNote", nothing to install', () => {
    for (const isCloudHost of [false, true]) {
      const ctas = getCtas({ isCloudHost, isDesktop: true, os: 'macos' });
      expect(ctas.primary).toEqual({ action: 'open-app' });
      expect(ctas.secondary).toBeNull();
      expect(ctas.nav.action).toBe('open-app');
    }
  });

  it('hosted website: download for the detected OS, then how it works', () => {
    for (const os of ['windows', 'macos', 'linux', 'unknown'] as const) {
      const ctas = getCtas({ isCloudHost: true, isDesktop: false, os });
      expect(ctas.primary).toEqual({ action: 'download', os });
      expect(ctas.secondary).toEqual({ action: 'how-it-works' });
      expect(ctas.nav.action).toBe('download');
    }
  });

  it('never offers to open the workspace on the hosted website', () => {
    const ctas = getCtas({ isCloudHost: true, isDesktop: false, os: 'linux' });
    expect([ctas.primary, ctas.secondary, ctas.nav].map((cta) => cta?.action)).not.toContain('open-app');
  });
});
