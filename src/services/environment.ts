/**
 * Environment detection for HuskyNote.
 * HuskyNote is a private, local-first workspace designed to run on the user's desktop hardware.
 */

export interface DeploymentEnvironment {
  isCloud: boolean;
  provider: 'vercel' | 'netlify' | 'cloud' | 'local';
  hostname: string;
}

export function detectEnvironment(): DeploymentEnvironment {
  if (typeof window === 'undefined') {
    return { isCloud: false, provider: 'local', hostname: 'localhost' };
  }

  const hostname = window.location.hostname || '';
  const searchParams = new URLSearchParams(window.location.search);

  // Manual override parameters for testing purposes (?env=vercel or ?env=local)
  if (searchParams.get('env') === 'vercel') {
    return { isCloud: true, provider: 'vercel', hostname };
  }
  if (searchParams.get('env') === 'local') {
    return { isCloud: false, provider: 'local', hostname };
  }

  // Known cloud providers
  if (hostname.includes('vercel.app')) {
    return { isCloud: true, provider: 'vercel', hostname };
  }
  if (hostname.includes('netlify.app')) {
    return { isCloud: true, provider: 'netlify', hostname };
  }
  if (
    hostname.includes('github.io') ||
    hostname.includes('pages.dev') ||
    hostname.includes('onrender.com') ||
    hostname.includes('railway.app')
  ) {
    return { isCloud: true, provider: 'cloud', hostname };
  }

  // Check if running on local loopback or local LAN
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local');

  if (!isLocal && hostname.length > 0) {
    return { isCloud: true, provider: 'cloud', hostname };
  }

  return { isCloud: false, provider: 'local', hostname };
}

export function isCloudDeployment(): boolean {
  return detectEnvironment().isCloud;
}
