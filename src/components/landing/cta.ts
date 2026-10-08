export type LandingOS = 'windows' | 'macos' | 'linux' | 'unknown';

/** Desktop OS from the user agent and platform strings. Phones and tablets are 'unknown'. */
export function detectOS(userAgent = '', platform = ''): LandingOS {
  const ua = userAgent.toLowerCase();
  const pf = platform.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(ua) || /android|iphone|ipad|ipod/.test(pf)) return 'unknown';
  if (pf.startsWith('win') || ua.includes('windows')) return 'windows';
  if (pf.startsWith('mac') || ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
  if (ua.includes('cros')) return 'unknown';
  if (pf.includes('linux') || ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'unknown';
}

export type CtaAction = 'open-app' | 'desktop-app' | 'download' | 'how-it-works';

export interface Cta {
  action: CtaAction;
  /** Set on download CTAs so the label can name the visitor's OS. */
  os?: LandingOS;
}

export interface CtaSet {
  primary: Cta;
  secondary: Cta | null;
  /** The compact call to action in the navigation bar. */
  nav: Cta;
}

/**
 * Which buttons the landing shows:
 * - desktop app: open the workspace, nothing else to install;
 * - hosted website (no local workspace): download, plus a link to how it works;
 * - local browser: open the workspace, plus the desktop app.
 */
export function getCtas({ isCloudHost, isDesktop, os }: { isCloudHost: boolean; isDesktop: boolean; os: LandingOS }): CtaSet {
  if (isDesktop) {
    return { primary: { action: 'open-app' }, secondary: null, nav: { action: 'open-app' } };
  }
  if (isCloudHost) {
    return { primary: { action: 'download', os }, secondary: { action: 'how-it-works' }, nav: { action: 'download', os: 'unknown' } };
  }
  return { primary: { action: 'open-app' }, secondary: { action: 'desktop-app' }, nav: { action: 'open-app' } };
}
