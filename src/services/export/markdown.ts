import type { Note, Meeting, Manual, TimelineItem, TranscriptSegment } from '../../types';
import { isAiReportMissing, meetingDurationSeconds } from '../meetings/meeting-report';
import { stripSpokenTimeLabel } from '../meetings/transcript-import';

export function exportNoteToMarkdown(note: Note): string {
  const dateStr = new Date(note.updatedAt).toISOString().split('T')[0];
  const tagsStr = note.tags.length > 0 ? `\nTags: ${note.tags.join(', ')}\n` : '';

  return `---
title: "${note.title.replace(/"/g, '\\"')}"
date: ${dateStr}
id: ${note.id}${tagsStr}---

# ${note.title}

${note.content}
`;
}

/** 00:12:34: the same width past the first hour, so timestamps read and sort alike */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

const pad2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');

/** Local time with its UTC offset, e.g. 2026-10-07T09:02:15+08:00 */
function isoWithOffset(ms: number): string {
  const d = new Date(ms);
  const offset = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    + `${offset >= 0 ? '+' : '-'}${pad2(offset / 60)}:${pad2(offset % 60)}`;
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function readableDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const TIMELINE_LABELS: Record<TimelineItem['type'], string> = { topic: 'Topic', decision: 'Decision', action: 'Action', note: 'Note' };

export interface MeetingMarkdownOptions {
  /** YAML front matter with the meeting's details; off for notes shown inside the app */
  frontMatter?: boolean;
}

/**
 * The whole meeting as one Markdown file another AI can work from: its
 * details, the report, the notes, and the complete transcript from start to
 * finish, one timestamped line per phrase.
 */
export function exportMeetingToMarkdown(meeting: Meeting, options: MeetingMarkdownOptions = {}): string {
  const { frontMatter = true } = options;
  const title = meeting.title?.trim() || 'Untitled meeting';
  const durationSeconds = meetingDurationSeconds(meeting);
  // Through the last line: a Teams transcript can run on after HuskyNote stopped recording
  const endTime = meeting.startTime + durationSeconds * 1000;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const speakerName = (s: TranscriptSegment) => s.speaker?.trim() || 'Unknown speaker';
  const words = (s: TranscriptSegment) => stripSpokenTimeLabel((s.text ?? '').trim().replace(/\s+/g, ' '), speakerName(s));
  const lines = [...meeting.transcript]
    .filter((s) => words(s))
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const lineCounts = new Map<string, number>();
  for (const s of lines) lineCounts.set(speakerName(s), (lineCounts.get(speakerName(s)) ?? 0) + 1);
  const speakers = [...lineCounts.entries()].sort((a, b) => b[1] - a[1]);
  const parts = meeting.parts && meeting.parts.length > 1 ? [...meeting.parts].sort((a, b) => a.offsetSeconds - b.offsetSeconds) : [];
  const supplement = meeting.transcriptSupplement;
  const supplementSource = supplement
    ? `Microsoft Teams transcript (${/pasted/i.test(supplement.fileName) ? 'copied from Teams' : supplement.fileName})`
    : '';
  const language = meeting.spokenLanguage && meeting.spokenLanguage !== 'auto' ? meeting.spokenLanguage : '';
  // Where HuskyNote's own recording ended; with a supplement, later lines are Teams only
  const recordedUntil = parts.length
    ? parts[parts.length - 1].offsetSeconds + parts[parts.length - 1].durationSeconds
    : meeting.endTime && meeting.endTime > meeting.startTime ? (meeting.endTime - meeting.startTime) / 1000 : 0;
  const summary = meeting.summary;
  const reportMissing = isAiReportMissing(meeting);
  const reportStatus = !summary ? 'not generated' : reportMissing ? 'not generated (placeholder only)' : 'generated';

  const out: string[] = [];
  const section = (heading: string, body: string[]) => {
    if (body.length) out.push(`## ${heading}`, '', ...body, '');
  };

  if (frontMatter) {
    out.push('---', 'type: meeting', `title: ${JSON.stringify(title)}`, `meeting_id: ${JSON.stringify(meeting.id)}`,
      `date: ${isoWithOffset(meeting.startTime).slice(0, 10)}`, `start: ${isoWithOffset(meeting.startTime)}`, `end: ${isoWithOffset(endTime)}`);
    if (timeZone) out.push(`timezone: ${timeZone}`);
    out.push(`duration: ${JSON.stringify(formatElapsed(durationSeconds))}`, `duration_seconds: ${durationSeconds}`);
    if (language) out.push(`spoken_language: ${JSON.stringify(language)}`);
    if (meeting.translationLanguage) out.push(`translation_language: ${JSON.stringify(meeting.translationLanguage)}`);
    out.push(`speakers: [${speakers.map(([name]) => JSON.stringify(name)).join(', ')}]`, `transcript_lines: ${lines.length}`);
    if (parts.length) out.push(`recording_parts: ${parts.length}`);
    if (supplement) out.push(`transcript_supplemented_with: ${JSON.stringify(supplementSource)}`);
    out.push(`ai_report: ${JSON.stringify(reportStatus)}`, `exported_at: ${isoWithOffset(Date.now())}`, 'exported_by: HuskyNote', '---', '');
  }

  out.push(`# ${title}`, '');
  out.push(
    `> This file is a complete record of one meeting: its details, the meeting report, notes taken during it, and the full transcript from start to finish. `
    + `Transcript timestamps like [00:12:34] are the time elapsed since the meeting started at ${clockTime(meeting.startTime)}${timeZone ? ` (${timeZone})` : ''}. `
    + 'The transcript was produced by speech recognition, so some words or speaker names may be wrong; where the report and the transcript disagree, the transcript is the source.',
    '',
  );

  // ── Details ────────────────────────────────────────────────────────────────
  const details = [
    `- **Title:** ${title}`,
    `- **Date:** ${new Date(meeting.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    `- **Time:** ${clockTime(meeting.startTime)} – ${clockTime(endTime)}${timeZone ? ` (${timeZone})` : ''}`,
    `- **Duration:** ${readableDuration(durationSeconds)} (${formatElapsed(durationSeconds)})`,
  ];
  if (language) details.push(`- **Spoken language:** ${language}`);
  if (meeting.translationLanguage) details.push(`- **Translated to:** ${meeting.translationLanguage}`);
  details.push(speakers.length
    ? `- **Speakers (lines in the transcript):** ${speakers.map(([name, count]) => `${name} (${count})`).join(', ')}`
    : '- **Speakers:** none recorded');
  if (parts.length) {
    details.push(`- **Recording:** joined from ${parts.length} recordings; the gaps between them were not recorded`);
    parts.forEach((part, i) => {
      details.push(`  ${i + 1}. ${formatElapsed(part.offsetSeconds)} – ${formatElapsed(part.offsetSeconds + part.durationSeconds)} (${clockTime(part.startTime)} – ${clockTime(part.endTime)})`);
    });
  }
  if (supplement) {
    details.push(`- **Transcript source:** HuskyNote's recording, supplemented on ${new Date(supplement.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} `
      + `with the ${supplementSource}: speaker names come from Teams${supplement.addedFromTeams ? `, and ${supplement.addedFromTeams} lines HuskyNote missed were added from it` : ''}. `
      + 'Lines while HuskyNote was not recording come from Teams only');
  }
  details.push(`- **Meeting report:** ${!summary
    ? 'not generated yet; work from the transcript'
    : reportMissing
      ? `not generated${summary.aiError ? ` (${summary.aiError})` : ''}; work from the transcript`
      : 'written by AI from the transcript and notes'}`);
  section('Meeting details', details);

  // ── Report ─────────────────────────────────────────────────────────────────
  if (summary) {
    if (!reportMissing && summary.overview?.trim()) section('Summary', [summary.overview.trim()]);
    section('Key decisions', summary.decisions.filter((d) => d.trim()).map((d, i) => `${i + 1}. ${d.trim()}`));
    section('Action items', summary.actionItems.filter((a) => a.task.trim()).map((a) =>
      `- [${a.done ? 'x' : ' '}] ${a.task.trim()}${a.owner?.trim() ? ` (owner: ${a.owner.trim()})` : ''}${a.done ? ' (done)' : ''}`));
    section('Follow-up tasks', summary.followUpTasks.filter((t) => t.trim()).map((t) => `- [ ] ${t.trim()}`));
    section('Topics discussed', summary.topics.filter((t) => t.trim()).map((t) => `- ${t.trim()}`));
  }
  section('Timeline', [...(meeting.timeline ?? [])]
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((item) => `- [${formatElapsed(item.timestampSeconds)}] ${TIMELINE_LABELS[item.type] ?? 'Note'}: ${item.label}`));
  if (meeting.manualNotes?.trim()) section('Notes taken during the meeting', [meeting.manualNotes.trim()]);
  const screenshots = [...(meeting.screenshots ?? [])].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  section('Screenshots', screenshots.length
    ? [...screenshots.map((ss, i) => `- [${formatElapsed(ss.timestampSeconds)}] ${ss.caption?.trim() || `Screenshot ${i + 1}`}`), '', '_The images are not included in this file._']
    : []);

  // ── Transcript ─────────────────────────────────────────────────────────────
  out.push('## Full transcript', '');
  if (!lines.length) {
    out.push('_No transcript was recorded for this meeting._', '');
    return out.join('\n');
  }
  out.push(`_${lines.length} lines from ${formatElapsed(lines[0].timestampSeconds)} to ${formatElapsed(lines[lines.length - 1].timestampSeconds)}, in order. Format: [elapsed time] Speaker: words._`, '');

  // Pauses between joined recordings and screenshots, placed where they happened
  const events: { at: number; text: string }[] = [];
  for (let i = 1; i < parts.length; i++) {
    const pausedAt = parts[i - 1].offsetSeconds + parts[i - 1].durationSeconds;
    const minutes = Math.max(1, Math.round((parts[i].startTime - parts[i - 1].endTime) / 60000));
    events.push({
      at: pausedAt,
      text: supplement
        ? `(HuskyNote's recording paused for about ${minutes} min, until ${formatElapsed(parts[i].offsetSeconds)}. Lines until then come from the Teams transcript only.)`
        : `(Recording paused for about ${minutes} min, until ${formatElapsed(parts[i].offsetSeconds)}. Nothing said during the pause was recorded.)`,
    });
    events.push({ at: parts[i].offsetSeconds, text: '(Recording resumed.)' });
  }
  if (supplement && recordedUntil && lines[lines.length - 1].timestampSeconds > recordedUntil + 5) {
    events.push({ at: recordedUntil, text: "(HuskyNote's recording ended here. The remaining lines come from the Teams transcript only.)" });
  }
  screenshots.forEach((ss, i) => events.push({ at: ss.timestampSeconds, text: `(Screenshot taken: ${ss.caption?.trim() || `Screenshot ${i + 1}`})` }));
  events.sort((a, b) => a.at - b.at);

  let next = 0;
  for (const s of lines) {
    while (next < events.length && events[next].at <= s.timestampSeconds) {
      out.push(`[${formatElapsed(events[next].at)}] ${events[next].text}`, '');
      next++;
    }
    const translation = s.translation?.trim() && s.translation.trim() !== s.text.trim()
      ? `\n(Translation${s.targetLanguage ? ` to ${s.targetLanguage}` : ''}: ${s.translation.trim()})`
      : '';
    out.push(`[${formatElapsed(s.timestampSeconds)}] ${speakerName(s)}: ${words(s)}${translation}`, '');
  }
  for (; next < events.length; next++) out.push(`[${formatElapsed(events[next].at)}] ${events[next].text}`, '');
  out.push('_End of transcript._', '');
  return out.join('\n');
}

export function exportManualToMarkdown(manual: Manual): string {
  let md = `# ${manual.title}\n\n`;
  md += `**Purpose:** ${manual.purpose}\n\n`;

  if (manual.requirements.length > 0) {
    md += `## Requirements & Prerequisites\n\n`;
    manual.requirements.forEach((req) => {
      md += `- ${req}\n`;
    });
    md += `\n`;
  }

  if (manual.warnings.length > 0) {
    md += `## Warnings\n\n`;
    manual.warnings.forEach((w) => {
      md += `> [!WARNING]\n> ${w}\n\n`;
    });
  }

  md += `## Steps\n\n`;
  manual.steps.forEach((step) => {
    md += `### Step ${step.stepNumber}: ${step.title}\n\n`;
    md += `${step.description}\n\n`;
    if (step.warnings) {
      md += `*Warning:* ${step.warnings}\n\n`;
    }
    if (step.notes) {
      md += `*Note:* ${step.notes}\n\n`;
    }
  });

  if (manual.expectedResult) {
    md += `## Expected Result\n\n${manual.expectedResult}\n\n`;
  }

  if (manual.troubleshooting.length > 0) {
    md += `## Troubleshooting\n\n`;
    manual.troubleshooting.forEach((t) => {
      md += `- ${t}\n`;
    });
    md += `\n`;
  }

  return md;
}
