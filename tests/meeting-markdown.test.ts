import { describe, it, expect } from 'vitest';
import { exportMeetingToMarkdown, formatElapsed } from '../src/services/export/markdown';
import type { Meeting } from '../src/types';

const start = new Date(2026, 9, 7, 9, 0, 0).getTime();

const baseMeeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'meet-ai',
  title: 'Planning "Q4" sync',
  startTime: start,
  endTime: start + 5400 * 1000,
  durationSeconds: 5400,
  transcript: [
    { id: 's3', timestampSeconds: 3725.4, speaker: 'Sam Patel', text: 'Last line after the first hour.' },
    { id: 's1', timestampSeconds: 4, speaker: 'Marco Reyes', text: 'Welcome,   everyone.' },
    { id: 's2', timestampSeconds: 61, speaker: 'Lena Ortiz', text: 'Thanks Jack.' },
    { id: 's-empty', timestampSeconds: 70, speaker: 'Marco Reyes', text: '   ' },
  ],
  manualNotes: 'Ask about the queue.',
  timeline: [{ id: 't1', timestampSeconds: 61, timeFormatted: '01:01', label: 'Escalation rules', type: 'topic' }],
  screenshots: [],
  summary: {
    overview: 'The team agreed on escalation rules.',
    decisions: ['Escalate after 24 hours.'],
    actionItems: [
      { task: 'Draft the rules', owner: 'Sam Patel' },
      { task: 'Book the follow-up', done: true },
    ],
    topics: ['Escalations'],
    followUpTasks: [],
    aiGenerated: true,
  },
  createdAt: start,
  ...overrides,
});

describe('exportMeetingToMarkdown (AI-friendly export)', () => {
  it('formats elapsed time as hh:mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(61.9)).toBe('00:01:01');
    expect(formatElapsed(3725.4)).toBe('01:02:05');
  });

  it('starts with front matter an AI can parse', () => {
    const md = exportMeetingToMarkdown(baseMeeting());
    const front = md.split('\n---\n')[0];
    expect(md.startsWith('---\ntype: meeting\n')).toBe(true);
    expect(front).toContain('title: "Planning \\"Q4\\" sync"');
    expect(front).toContain('meeting_id: "meet-ai"');
    expect(front).toMatch(/start: 2026-10-07T09:00:00[+-]\d{2}:\d{2}/);
    expect(front).toMatch(/end: 2026-10-07T10:30:00[+-]\d{2}:\d{2}/);
    expect(front).toContain('duration: "01:30:00"');
    expect(front).toContain('duration_seconds: 5400');
    expect(front).toContain('speakers: ["Marco Reyes", "Lena Ortiz", "Sam Patel"]');
    expect(front).toContain('transcript_lines: 3');
    expect(front).toContain('ai_report: "generated"');
  });

  it('includes the report, notes and every transcript line in time order', () => {
    const md = exportMeetingToMarkdown(baseMeeting());
    expect(md).toContain('## Summary\n\nThe team agreed on escalation rules.');
    expect(md).toContain('1. Escalate after 24 hours.');
    expect(md).toContain('- [ ] Draft the rules (owner: Sam Patel)');
    expect(md).toContain('- [x] Book the follow-up (done)');
    expect(md).toContain('- [00:01:01] Topic: Escalation rules');
    expect(md).toContain('## Notes taken during the meeting\n\nAsk about the queue.');
    const first = md.indexOf('[00:00:04] Marco Reyes: Welcome, everyone.');
    const second = md.indexOf('[00:01:01] Lena Ortiz: Thanks Jack.');
    const last = md.indexOf('[01:02:05] Sam Patel: Last line after the first hour.');
    expect(first).toBeGreaterThan(md.indexOf('## Full transcript'));
    expect(second).toBeGreaterThan(first);
    expect(last).toBeGreaterThan(second);
    expect(md).toContain('_3 lines from 00:00:04 to 01:02:05');
    expect(md.trimEnd().endsWith('_End of transcript._')).toBe(true);
  });

  it('marks pauses between joined recordings and the Teams supplement', () => {
    const md = exportMeetingToMarkdown(baseMeeting({
      parts: [
        { meetingId: 'a', startTime: start, endTime: start + 1800_000, offsetSeconds: 0, durationSeconds: 1800 },
        { meetingId: 'b', startTime: start + 2400_000, endTime: start + 5400_000, offsetSeconds: 2400, durationSeconds: 3000 },
      ],
      transcriptSupplement: { at: start + 86400_000, fileName: 'teams.vtt', offsetSeconds: 2, windows: 30, aiWindows: 30, addedFromTeams: 12 },
    }));
    expect(md).toContain('recording_parts: 2');
    expect(md).toContain('transcript_supplemented_with: "Microsoft Teams transcript (teams.vtt)"');
    expect(md).toContain('joined from 2 recordings');
    expect(md).toContain('  2. 00:40:00 – 01:30:00');
    expect(md).toContain('12 lines HuskyNote missed were added from it');
    const pause = md.indexOf("[00:30:00] (HuskyNote's recording paused for about 10 min, until 00:40:00. Lines until then come from the Teams transcript only.)");
    expect(pause).toBeGreaterThan(md.indexOf('[00:01:01] Lena Ortiz'));
    expect(md.indexOf('[00:40:00] (Recording resumed.)')).toBeGreaterThan(pause);
    expect(md.indexOf('[00:40:00] (Recording resumed.)')).toBeLessThan(md.indexOf('[01:02:05] Sam Patel'));
    expect(md).not.toContain('recording ended here');
  });

  it('says nothing was recorded during a pause without a supplement', () => {
    const md = exportMeetingToMarkdown(baseMeeting({
      parts: [
        { meetingId: 'a', startTime: start, endTime: start + 1800_000, offsetSeconds: 0, durationSeconds: 1800 },
        { meetingId: 'b', startTime: start + 2400_000, endTime: start + 5400_000, offsetSeconds: 2400, durationSeconds: 3000 },
      ],
    }));
    expect(md).toContain('[00:30:00] (Recording paused for about 10 min, until 00:40:00. Nothing said during the pause was recorded.)');
  });

  it('marks Teams-only lines after the recording ended and removes Teams time labels', () => {
    const md = exportMeetingToMarkdown(baseMeeting({
      endTime: start + 3600_000,
      durationSeconds: 3600,
      transcriptSupplement: { at: start, fileName: 'the Teams transcript (pasted)', offsetSeconds: 0, windows: 20, aiWindows: 0, addedFromTeams: 1 },
      transcript: [
        { id: 'a', timestampSeconds: 10, speaker: 'Marco Reyes', text: 'Marco Reyes 5 minutes 36 seconds Mhm.' },
        { id: 'b', timestampSeconds: 20, speaker: 'Sam Patel', text: '5 minutes later we came back.' },
        { id: 'c', timestampSeconds: 3700, speaker: 'Sam Patel', text: 'Sam Patel 1 hour 1 minute 40 seconds Thanks.' },
      ],
    }));
    expect(md).toContain('[00:00:10] Marco Reyes: Mhm.');
    expect(md).toContain('[00:00:20] Sam Patel: 5 minutes later we came back.');
    expect(md).toContain('[01:01:40] Sam Patel: Thanks.');
    expect(md).toContain('Microsoft Teams transcript (copied from Teams)');
    expect(md).toMatch(/end: 2026-10-07T10:01:40/);
    const ended = md.indexOf("[01:00:00] (HuskyNote's recording ended here. The remaining lines come from the Teams transcript only.)");
    expect(ended).toBeGreaterThan(md.indexOf('[00:00:20] Sam Patel'));
    expect(ended).toBeLessThan(md.indexOf('[01:01:40] Sam Patel'));
  });

  it('says when there is no AI report instead of exporting the placeholder', () => {
    const md = exportMeetingToMarkdown(baseMeeting({
      summary: { overview: 'Local AI not connected.', decisions: [], actionItems: [], topics: [], followUpTasks: [], aiGenerated: false, aiError: 'No API key' },
    }));
    expect(md).toContain('ai_report: "not generated (placeholder only)"');
    expect(md).toContain('- **Meeting report:** not generated (No API key); work from the transcript');
    expect(md).not.toContain('Local AI not connected');
    expect(md).not.toContain('## Summary');
  });

  it('places screenshots in the transcript and leaves out front matter for notes', () => {
    const md = exportMeetingToMarkdown(baseMeeting({
      screenshots: [{ id: 'ss', timestampSeconds: 30, dataUrl: 'data:image/png;base64,AAAA', caption: 'Queue dashboard' }],
    }), { frontMatter: false });
    expect(md.startsWith('# Planning "Q4" sync')).toBe(true);
    expect(md).toContain('- [00:00:30] Queue dashboard');
    expect(md).toContain('[00:00:30] (Screenshot taken: Queue dashboard)');
    expect(md).not.toContain('data:image');
  });

  it('notes an empty transcript', () => {
    const md = exportMeetingToMarkdown(baseMeeting({ transcript: [], summary: undefined }));
    expect(md).toContain('_No transcript was recorded for this meeting._');
    expect(md).toContain('ai_report: "not generated"');
  });
});
