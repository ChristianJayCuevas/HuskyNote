import type { ScheduleEvent, GoogleCalendarConfig } from '../../types';

const STORAGE_KEY = 'huskynote_google_calendar_config';

/**
 * Retrieves the stored Google Calendar configuration from localStorage,
 * with fallback to dynamic environment variables (VITE_GOOGLE_CLIENT_ID).
 */
export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const envClientId = (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID || undefined;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: GoogleCalendarConfig = JSON.parse(raw);
      // Check if token has expired
      if (parsed.tokenExpiry && parsed.tokenExpiry < Date.now()) {
        parsed.isConnected = false;
        parsed.accessToken = undefined;
      }
      if (!parsed.clientId && envClientId) {
        parsed.clientId = envClientId;
      }
      return parsed;
    }
  } catch (err) {
    console.warn('[HuskyNote] Failed to read Google Calendar config:', err);
  }

  return {
    isConnected: false,
    clientId: envClientId,
  };
}

/**
 * Persists Google Calendar configuration
 */
export function saveGoogleCalendarConfig(updates: Partial<GoogleCalendarConfig>): GoogleCalendarConfig {
  const current = getGoogleCalendarConfig();
  const next: GoogleCalendarConfig = {
    ...current,
    ...updates,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[HuskyNote] Failed to save Google Calendar config:', err);
  }
  return next;
}

/**
 * Disconnects and purges Google Calendar tokens
 */
export function disconnectGoogleCalendar(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Formats a Date into compact format YYYYMMDDTHHmmss for Google Calendar web templates
 */
function formatGoogleDateTimeCompact(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

/**
 * Generates an instant, zero-config 1-click Google Calendar web template URL.
 * Works without requiring any Google Client ID or API keys!
 */
export function getGoogleCalendarWebTemplateUrl(event: ScheduleEvent): string {
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.time.split(':').map(Number);

  const start = new Date(year, month - 1, day, hours, minutes);
  const end = new Date(start.getTime() + (event.durationMin || 30) * 60 * 1000);

  const startStr = formatGoogleDateTimeCompact(start);
  const endStr = formatGoogleDateTimeCompact(end);

  const text = encodeURIComponent(event.title || 'Event');
  const details = encodeURIComponent(
    `${event.notes || ''}\n\nCategory: ${event.category}\nScheduled via HuskyNote Offline Intelligence`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&details=${details}`;
}

/**
 * Handles OAuth callback if the page was opened in a popup with a token hash.
 * Returns true if handled (meaning this window was an OAuth popup and can now be closed).
 */
export function handleGoogleAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    if (window.opener) {
      try {
        window.opener.postMessage(
          {
            type: 'GOOGLE_AUTH_CALLBACK',
            hash,
          },
          window.location.origin
        );
        window.close();
        return true;
      } catch {
        // Continue fallback
      }
    }
  }
  return false;
}

/**
 * Authenticates with Google via OAuth 2.0 Implicit Grant / Token popup.
 * If a clientId is provided, initiates real OAuth flow; otherwise allows saving demo or custom credentials.
 */
export async function authenticateGoogleCalendar(customClientId?: string): Promise<{
  success: boolean;
  userEmail?: string;
  error?: string;
}> {
  const clientId = customClientId || getGoogleCalendarConfig().clientId;

  if (!clientId) {
    return {
      success: false,
      error: 'Google OAuth Client ID is required. Please provide your Client ID in Settings.',
    };
  }

  const redirectUri = window.location.origin;
  const scope = encodeURIComponent(
    'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
  );
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=consent`;

  return new Promise((resolve) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup) {
      resolve({
        success: false,
        error: 'Popup was blocked by browser. Please allow popups for HuskyNote.',
      });
      return;
    }

    let resolved = false;

    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener('message', handleMessage);
    };

    const processHashToken = async (hashString: string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        // ignore
      }

      const params = new URLSearchParams(hashString.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

      if (accessToken) {
        const tokenExpiry = Date.now() + expiresIn * 1000;

        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const userInfo = await res.json();
          const userEmail = userInfo.email || 'Google Account';
          saveGoogleCalendarConfig({
            clientId,
            accessToken,
            tokenExpiry,
            userEmail,
            isConnected: true,
            lastSyncedAt: Date.now(),
          });
          resolve({ success: true, userEmail });
        } catch {
          saveGoogleCalendarConfig({
            clientId,
            accessToken,
            tokenExpiry,
            userEmail: 'Connected User',
            isConnected: true,
            lastSyncedAt: Date.now(),
          });
          resolve({ success: true, userEmail: 'Connected User' });
        }
      } else {
        resolve({
          success: false,
          error: params.get('error_description') || 'Token was not returned by Google.',
        });
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_CALLBACK' && event.data?.hash) {
        processHashToken(event.data.hash);
      }
    };

    window.addEventListener('message', handleMessage);

    // Poll popup URL for hash token fallback
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          if (!resolved) {
            cleanup();
            resolve({ success: false, error: 'Authentication window was closed.' });
          }
          return;
        }

        if (popup.location.href.includes(redirectUri)) {
          const hash = popup.location.hash;
          if (hash && hash.includes('access_token')) {
            processHashToken(hash);
          }
        }
      } catch {
        // Cross-origin security before redirect is normal, ignore until redirect arrives
      }
    }, 500);
  });
}

/**
 * Creates an event directly in the user's Google Calendar via REST API.
 */
export async function createGoogleCalendarEvent(event: ScheduleEvent): Promise<{
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}> {
  const config = getGoogleCalendarConfig();

  if (!config.isConnected || !config.accessToken) {
    // If not connected via OAuth, use fallback web template
    window.open(getGoogleCalendarWebTemplateUrl(event), '_blank', 'noopener,noreferrer');
    return {
      success: true,
      htmlLink: getGoogleCalendarWebTemplateUrl(event),
    };
  }

  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.time.split(':').map(Number);

  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + (event.durationMin || 30) * 60 * 1000);

  const payload = {
    summary: event.title,
    description: `${event.notes || ''}\n\nCategory: ${event.category}\nAdded via HuskyNote`,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        saveGoogleCalendarConfig({ isConnected: false });
        throw new Error('Google Calendar token expired. Please reconnect your account.');
      }
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err: any) {
    console.warn('[HuskyNote] Google Calendar API error:', err);
    return {
      success: false,
      error: err.message || 'Failed to sync to Google Calendar.',
    };
  }
}

/**
 * Fetches upcoming events from the user's primary Google Calendar.
 */
export async function fetchUpcomingGoogleCalendarEvents(): Promise<{
  success: boolean;
  events?: ScheduleEvent[];
  error?: string;
}> {
  const config = getGoogleCalendarConfig();
  if (!config.isConnected || !config.accessToken) {
    return { success: false, error: 'Google Calendar is not connected.' };
  }

  const now = new Date().toISOString();
  const maxTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      now
    )}&timeMax=${encodeURIComponent(maxTime)}&singleEvents=true&orderBy=startTime&maxResults=25`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        saveGoogleCalendarConfig({ isConnected: false });
      }
      throw new Error(`Failed to fetch events (${res.status})`);
    }

    const data = await res.json();
    const items = data.items || [];

    const mapped: ScheduleEvent[] = items.map((item: any) => {
      const startDateTime = item.start?.dateTime || item.start?.date || '';
      const endDateTime = item.end?.dateTime || item.end?.date || '';

      const startDate = startDateTime ? new Date(startDateTime) : new Date();
      const endDate = endDateTime ? new Date(endDateTime) : new Date(startDate.getTime() + 30 * 60000);

      const durationMin = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

      const isoDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(
        startDate.getDate()
      ).padStart(2, '0')}`;
      const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(
        2,
        '0'
      )}`;

      return {
        id: `gcal-${item.id}`,
        title: item.summary || 'Google Calendar Event',
        date: isoDate,
        time: timeStr,
        durationMin,
        category: 'meeting' as const,
        completed: false,
        notes: item.description || '',
        googleCalendarEventId: item.id,
        syncedToGoogle: true,
        createdAt: Date.now(),
      };
    });

    saveGoogleCalendarConfig({ lastSyncedAt: Date.now() });

    return {
      success: true,
      events: mapped,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Could not fetch Google Calendar events.',
    };
  }
}
