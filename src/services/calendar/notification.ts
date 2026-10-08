import type { ScheduleEvent } from '../../types';

/**
 * Checks if browser notification permission is supported and granted
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Requests desktop notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.warn('[HuskyNote] Notification permission request error:', err);
    return 'denied';
  }
}

/**
 * Sends a native computer desktop notification when an event/meeting is detected
 */
export function notifyDetectedEvent(event: ScheduleEvent, onClick?: () => void): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const title = `Event detected: ${event.title}`;
    const body = `Scheduled for ${event.date} at ${event.time} (${event.durationMin}m). Click to view in HuskyNote or add to Computer Calendar.`;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: `event-${event.id}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClick) onClick();
    };

    return notification;
  } catch (err) {
    console.warn('[HuskyNote] Desktop notification failed:', err);
    return null;
  }
}
