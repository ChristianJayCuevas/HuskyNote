import { describe, it, expect } from 'vitest';
import {
  detectEventFromSentence,
  detectAllEventsInText,
  parseDateExpression,
  parseTimeExpression,
  extractEventTitle,
} from '../src/services/calendar/event-detector';
import { generateIcsContent, generateVEventString } from '../src/services/calendar/ics-generator';
import { getGoogleCalendarWebTemplateUrl } from '../src/services/calendar/google-calendar';
import type { ScheduleEvent } from '../src/types';

describe('Calendar Event & Date Detection', () => {
  const fixedBaseDate = new Date(2026, 8, 16, 10, 0, 0); // 2026-09-16 (Wednesday)

  it('correctly parses relative date expressions', () => {
    expect(parseDateExpression('tomorrow at 3pm', fixedBaseDate)).toBe('2026-09-17');
    expect(parseDateExpression('today at 10am', fixedBaseDate)).toBe('2026-09-16');
    expect(parseDateExpression('day after tomorrow', fixedBaseDate)).toBe('2026-09-18');
    expect(parseDateExpression('on Friday at 2pm', fixedBaseDate)).toBe('2026-09-18');
  });

  it('correctly parses explicit calendar dates', () => {
    expect(parseDateExpression('September 25th at 3pm', fixedBaseDate)).toBe('2026-09-25');
    expect(parseDateExpression('on October 12, 2026', fixedBaseDate)).toBe('2026-10-12');
    expect(parseDateExpression('2026-11-05 at 14:00', fixedBaseDate)).toBe('2026-11-05');
  });

  it('correctly parses 12-hour and 24-hour time expressions', () => {
    expect(parseTimeExpression('at 3pm')).toBe('15:00');
    expect(parseTimeExpression('at 3:30 pm')).toBe('15:30');
    expect(parseTimeExpression('10:00 am')).toBe('10:00');
    expect(parseTimeExpression('at noon')).toBe('12:00');
    expect(parseTimeExpression('at 14:45')).toBe('14:45');
  });

  it('detects a scheduled event from a spoken meeting sentence', () => {
    const sentence = "Let's schedule a sprint demo tomorrow at 3pm for the engineering team.";
    const result = detectEventFromSentence(sentence, fixedBaseDate);

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-09-17');
    expect(result?.time).toBe('15:00');
    expect(result?.title.toLowerCase()).toContain('sprint demo');
    expect(result?.category).toBe('meeting');
  });

  it('detects a deadline event with duration and category', () => {
    const sentence = "The project proposal deadline is due on September 25 at 5:00 PM.";
    const result = detectEventFromSentence(sentence, fixedBaseDate);

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-09-25');
    expect(result?.time).toBe('17:00');
    expect(result?.category).toBe('deadline');
  });

  it('extracts multiple events from full meeting transcript text', () => {
    const transcript = `
      Good morning everyone. First, we have a client review meeting tomorrow at 2pm.
      We went over the architecture diagrams.
      Don't forget the design workshop on Friday at 10:00 AM for 1 hour.
      Everything else looks solid.
    `;

    const events = detectAllEventsInText(transcript, fixedBaseDate);
    expect(events.length).toBeGreaterThanOrEqual(2);

    const dates = events.map((e) => e.date);
    expect(dates).toContain('2026-09-17');
    expect(dates).toContain('2026-09-18');
  });

  it('correctly parses relative days expressions (e.g. in 2 days, next week)', () => {
    expect(parseDateExpression('in 2 days', fixedBaseDate)).toBe('2026-09-18');
    expect(parseDateExpression('in 3 days', fixedBaseDate)).toBe('2026-09-19');
    expect(parseDateExpression('next week', fixedBaseDate)).toBe('2026-09-23');
    expect(parseDateExpression('25th of September', fixedBaseDate)).toBe('2026-09-25');
  });

  it('correctly parses Filipino date and time expressions', () => {
    expect(parseDateExpression('bukas ng hapon', fixedBaseDate)).toBe('2026-09-17');
    expect(parseDateExpression('sa susunod na linggo', fixedBaseDate)).toBe('2026-09-23');
    expect(parseTimeExpression('alas tres ng hapon')).toBe('15:00');
    expect(parseTimeExpression('alas diyes ng umaga')).toBe('10:00');
    expect(parseTimeExpression('alas dose ng tanghali')).toBe('12:00');
  });

  it('returns null for sentences without future scheduling intent or dates', () => {
    expect(detectEventFromSentence('Thank you everyone for joining today’s meeting.', fixedBaseDate)).toBeNull();
    expect(detectEventFromSentence('In our last meeting yesterday we decided on Postgres.', fixedBaseDate)).toBeNull();
    expect(detectEventFromSentence('I think this feature is very cool.', fixedBaseDate)).toBeNull();
  });
});

describe('iCalendar (.ics) Generator', () => {
  const sampleEvent: ScheduleEvent = {
    id: 'ev-test-1',
    title: 'Executive Architecture Review',
    date: '2026-09-22',
    time: '14:30',
    durationMin: 45,
    category: 'meeting',
    completed: false,
    notes: 'Review Dexie indexing & Ollama models',
    createdAt: Date.now(),
  };

  it('generates standard RFC 5545 VEVENT string', () => {
    const vevent = generateVEventString(sampleEvent);
    expect(vevent).toContain('BEGIN:VEVENT');
    expect(vevent).toContain('UID:ev-test-1@huskynote.local');
    expect(vevent).toContain('SUMMARY:Executive Architecture Review');
    expect(vevent).toContain('CATEGORIES:MEETING');
    expect(vevent).toContain('END:VEVENT');
  });

  it('generates valid VCALENDAR container', () => {
    const ics = generateIcsContent([sampleEvent]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//HuskyNote//Local Calendar Intelligence//EN');
    expect(ics).toContain('END:VCALENDAR');
  });
});

describe('Google Calendar Web Template URL', () => {
  const sampleEvent: ScheduleEvent = {
    id: 'ev-test-2',
    title: 'Product Sync',
    date: '2026-09-20',
    time: '11:00',
    durationMin: 30,
    category: 'meeting',
    completed: false,
    notes: 'Discuss Q4 roadmap',
    createdAt: Date.now(),
  };

  it('generates valid Google Calendar web template link without requiring API keys', () => {
    const url = getGoogleCalendarWebTemplateUrl(sampleEvent);
    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(url).toContain('Product%20Sync');
    expect(url).toContain('Discuss%20Q4%20roadmap');
  });
});
