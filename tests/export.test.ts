import { describe, it, expect } from 'vitest';
import { exportNoteToMarkdown, exportMeetingToMarkdown, exportManualToMarkdown } from '../src/services/export/markdown';
import type { Note, Meeting, Manual } from '../src/types';

describe('Markdown Exporters', () => {
  it('exports note with frontmatter and content', () => {
    const note: Note = {
      id: 'note-1',
      title: 'Test Note Title',
      content: 'This is the note content.',
      tags: ['engineering', 'specs'],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      versions: [],
    };

    const md = exportNoteToMarkdown(note);
    expect(md).toContain('title: "Test Note Title"');
    expect(md).toContain('Tags: engineering, specs');
    expect(md).toContain('# Test Note Title');
    expect(md).toContain('This is the note content.');
  });

  it('exports meeting with transcript and executive summary', () => {
    const meeting: Meeting = {
      id: 'meet-1',
      title: 'Weekly Sync',
      startTime: 1700000000000,
      durationSeconds: 125,
      transcript: [
        {
          id: 'seg-1',
          timestampSeconds: 5,
          speaker: 'Speaker',
          text: 'We are ready to deploy.',
        },
      ],
      manualNotes: 'Remember to check environment keys.',
      timeline: [],
      summary: {
        overview: 'Sync completed smoothly.',
        decisions: ['Deployment scheduled for Friday.'],
        actionItems: [{ task: 'Prepare configs', owner: 'Arron' }],
        topics: ['Deployment', 'Architecture'],
        followUpTasks: [],
      },
      createdAt: 1700000000000,
    };

    const md = exportMeetingToMarkdown(meeting);
    expect(md).toContain('# Weekly Sync');
    expect(md).toContain('1. Deployment scheduled for Friday.');
    expect(md).toContain('- [ ] Prepare configs (owner: Arron)');
    expect(md).toContain('We are ready to deploy.');
    expect(md).toContain('Remember to check environment keys.');
  });

  it('exports meeting with screenshots and follow-up tasks', () => {
    const meeting: Meeting = {
      id: 'meet-screenshots',
      title: 'Design Review',
      startTime: 1700000000000,
      durationSeconds: 180,
      transcript: [],
      manualNotes: 'Architecture look good.',
      timeline: [],
      screenshots: [
        {
          id: 'ss-1',
          timestampSeconds: 45,
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          caption: 'Slide 3 - Architecture Diagram',
        },
      ],
      summary: {
        overview: 'Reviewed new schema and architecture.',
        decisions: ['Approved new diagram.'],
        actionItems: [],
        topics: ['Design'],
        followUpTasks: ['Send recording link to team'],
      },
      createdAt: 1700000000000,
    };

    const md = exportMeetingToMarkdown(meeting);
    expect(md).toContain('## Screenshots');
    expect(md).toContain('- [00:00:45] Slide 3 - Architecture Diagram');
    expect(md).toContain('## Follow-up tasks');
    expect(md).toContain('- [ ] Send recording link to team');
  });

  it('exports manual with steps and prerequisites', () => {
    const manual: Manual = {
      id: 'man-1',
      title: 'Server Migration SOP',
      purpose: 'Safely migrate workloads to the new cluster.',
      requirements: ['Root access', 'SSH keys configured'],
      steps: [
        {
          id: 's-1',
          stepNumber: 1,
          title: 'Drain node',
          description: 'Evacuate pods from target machine.',
        },
      ],
      warnings: ['Do not reboot during migration.'],
      expectedResult: 'All pods running on new cluster.',
      troubleshooting: ['Check networking routing table.'],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      version: 1,
    };

    const md = exportManualToMarkdown(manual);
    expect(md).toContain('# Server Migration SOP');
    expect(md).toContain('Safely migrate workloads to the new cluster.');
    expect(md).toContain('- Root access');
    expect(md).toContain('### Step 1: Drain node');
    expect(md).toContain('Do not reboot during migration.');
  });
});

describe('PDF Exporters', () => {
  it('exports meeting to PDF with cover, summary, and transcript', async () => {
    const { exportMeetingToPdf } = await import('../src/services/export/pdf');

    const meeting: Meeting = {
      id: 'meet-pdf-test',
      title: 'Board Meeting Q3',
      startTime: 1700000000000,
      durationSeconds: 300,
      transcript: [
        {
          id: 't-1',
          timestampSeconds: 10,
          speaker: 'Presenter',
          text: 'Welcome to the Q3 financial review.',
        },
      ],
      manualNotes: 'Key milestone achieved.',
      timeline: [
        {
          id: 'time-1',
          timestampSeconds: 60,
          title: 'Revenue Milestones',
          description: 'Achieved 200% growth.',
        },
      ],
      screenshots: [
        {
          id: 'ss-1',
          timestampSeconds: 30,
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          caption: 'Financial Dashboard',
        },
      ],
      summary: {
        overview: 'Strong quarter with accelerated progress.',
        decisions: ['Approve budget expansion.'],
        actionItems: [{ task: 'File quarterly compliance report', owner: 'Finance' }],
        topics: ['Revenue', 'Expansion'],
        followUpTasks: ['Distribute slide deck'],
      },
      createdAt: 1700000000000,
    };

    const doc = exportMeetingToPdf(meeting);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

describe('PDF text', () => {
  it('converts characters the built-in PDF fonts cannot draw instead of breaking the line', async () => {
    const { toPdfText } = await import('../src/services/export/pdf');
    expect(toPdfText('underwriter → manager ☐ done ✓')).toBe('underwriter -> manager done');
    expect(toPdfText('“Quotes” — dashes • bullets café')).toBe('“Quotes” — dashes • bullets café');
    expect(toPdfText('Line one \n  line two')).toBe('Line one\nline two');
  });

  it('formats fractional speech timestamps as whole seconds', async () => {
    const { formatSecondsToTime } = await import('../src/services/audio/transcriber');
    expect(formatSecondsToTime(9.642666666666667)).toBe('00:09');
    expect(formatSecondsToTime(2077.99)).toBe('34:37');
  });
});
