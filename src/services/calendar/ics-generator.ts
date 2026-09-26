import type { ScheduleEvent } from '../../types';

function padZero(num: number): string {
  return String(num).padStart(2, '0');
}

/**
 * Formats a Date object into iCalendar UTC format: YYYYMMDDTHHmmssZ
 */
function formatIcsDateTimeUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = padZero(date.getUTCMonth() + 1);
  const d = padZero(date.getUTCDate());
  const h = padZero(date.getUTCHours());
  const min = padZero(date.getUTCMinutes());
  const s = padZero(date.getUTCSeconds());
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Escapes characters for iCalendar format (commas, semicolons, backslashes, newlines)
 */
function escapeIcsText(str: string): string {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Converts a ScheduleEvent into a RFC 5545 VEVENT block
 */
export function generateVEventString(event: ScheduleEvent): string {
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.time.split(':').map(Number);

  // Local start date
  const startDate = new Date(year, month - 1, day, hours, minutes, 0);
  const endDate = new Date(startDate.getTime() + (event.durationMin || 30) * 60 * 1000);
  const now = new Date();

  const uid = `${event.id}@huskynote.local`;
  const summary = escapeIcsText(event.title);
  const description = escapeIcsText(
    `${event.notes || ''}\n\nCategory: ${event.category}\nOrganized via HuskyNote Offline Intelligence`
  );

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDateTimeUtc(now)}`,
    `DTSTART:${formatIcsDateTimeUtc(startDate)}`,
    `DTEND:${formatIcsDateTimeUtc(endDate)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `STATUS:${event.completed ? 'COMPLETED' : 'CONFIRMED'}`,
    `CATEGORIES:${event.category.toUpperCase()}`,
    'END:VEVENT',
  ].join('\r\n');
}

/**
 * Generates a full .ics iCalendar file string for one or more events
 */
export function generateIcsContent(events: ScheduleEvent[]): string {
  const vEvents = events.map(generateVEventString).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HuskyNote//Local Calendar Intelligence//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vEvents,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Creates and triggers a download for an iCalendar (.ics) file.
 * Opening this downloaded file triggers the native OS calendar (Apple Calendar, Outlook, etc.)
 * to immediately prompt the user to add the event.
 */
export function downloadIcsFile(event: ScheduleEvent, customFilename?: string): void {
  const content = generateIcsContent([event]);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const safeTitle = (event.title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

  const fileName = customFilename || `huskynote-${safeTitle}-${event.date}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports multiple events into a single .ics calendar archive
 */
export function downloadMultipleEventsIcs(events: ScheduleEvent[], customFilename?: string): void {
  if (events.length === 0) return;
  const content = generateIcsContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const fileName = customFilename || `huskynote-schedule-export-${events[0].date}.ics`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
