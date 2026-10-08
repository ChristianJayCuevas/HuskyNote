import { jsPDF } from 'jspdf';
import type { Manual, Note, Meeting } from '../../types';
import { formatSecondsToTime } from '../audio/transcriber';
import { getLanguageName } from '../ai/translation';
import { groupTranscriptTurns, isAiReportMissing, meetingDurationSeconds } from '../meetings/meeting-report';

type RGB = [number, number, number];

const COLOR = {
  ink: [15, 23, 42] as RGB,
  body: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  faint: [148, 163, 184] as RGB,
  line: [226, 232, 240] as RGB,
  surface: [248, 250, 252] as RGB,
  white: [255, 255, 255] as RGB,
  emerald: [5, 150, 105] as RGB,
  blue: [37, 99, 235] as RGB,
  blueTint: [239, 246, 255] as RGB,
  violet: [124, 58, 237] as RGB,
  amber: [217, 119, 6] as RGB,
  amberTint: [255, 251, 235] as RGB,
};

const SPEAKER_COLORS: RGB[] = [COLOR.blue, COLOR.emerald, COLOR.violet, COLOR.amber, [219, 39, 119], [8, 145, 178]];

// The built-in PDF fonts only cover Windows-1252. Anything outside it (arrows,
// checkboxes, emoji) made jsPDF space the whole line out letter by letter.
const PDF_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[→⟶➔➜➝⇢]/g, '->'],
  [/[←⟵⇠]/g, '<-'],
  [/[⇒]/g, '=>'],
  [/[↔⇔]/g, '<->'],
  [/[☐☑☒✓✔✗✘]/g, ''],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/≈/g, '~'],
  [/≠/g, '!='],
  [/[‐‑‒−]/g, '-'],
  [/′/g, "'"],
  [/″/g, '"'],
  [/[   ]/g, ' '],
];
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

/** Makes text safe for the PDF's built-in fonts */
export function toPdfText(text: string): string {
  let out = (text || '').normalize('NFC');
  for (const [pattern, replacement] of PDF_REPLACEMENTS) out = out.replace(pattern, replacement);
  out = Array.from(out)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.includes(ch);
    })
    .join('');
  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};

/**
 * Export a Meeting as a designed, readable PDF report.
 *
 * Page one opens with the title, date and duration, then counts of decisions,
 * action items, topics and follow-ups. The report follows: summary, numbered
 * decisions, an action-item checklist with owners, topics, open questions,
 * notes, timeline and screenshots. The transcript closes the document as an
 * appendix, grouped into speaker turns. Every page carries a running header
 * and "Page X of Y".
 *
 * @param meeting - The Meeting entity to export.
 */
export function exportMeetingToPdf(meeting: Meeting): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const pageTop = 24;
  const pageBottom = pageHeight - 18;
  let y = 16;

  const title = toPdfText(meeting.title) || 'Untitled meeting';
  const start = new Date(meeting.startTime);
  const dateLong = start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dateShort = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const summary = meeting.summary;
  const reportMissing = isAiReportMissing(meeting);

  // ── Drawing helpers ──────────────────────────────────────────────────────
  const ptToMm = (size: number) => size * 0.3528;
  const lineHeight = (size: number, factor = 1.45) => ptToMm(size) * factor;
  const font = (size: number, style: 'normal' | 'bold' | 'italic', color: RGB) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };
  const fill = (color: RGB) => doc.setFillColor(color[0], color[1], color[2]);
  const stroke = (color: RGB, width = 0.2) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(width);
  };
  const text = (value: string, x: number, top: number, options: { align?: 'left' | 'right' | 'center' } = {}) =>
    doc.text(value, x, top, { baseline: 'top', ...options });
  /** Wrap with the current font; set the font before calling */
  const wrap = (value: string, width: number): string[] => doc.splitTextToSize(toPdfText(value), width);
  /** Shortens one line with an ellipsis so it fits the width */
  const fit = (value: string, width: number): string => {
    let out = toPdfText(value);
    if (doc.getTextWidth(out) <= width) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > width) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  };
  const newPage = () => {
    doc.addPage();
    y = pageTop;
  };
  const ensure = (height: number) => {
    if (y + height > pageBottom) newPage();
  };
  /** Writes wrapped lines from y, continuing on a new page when needed */
  const paragraph = (lines: string[], x: number, size: number, color: RGB, style: 'normal' | 'bold' | 'italic' = 'normal', factor = 1.45) => {
    const step = lineHeight(size, factor);
    for (const line of lines) {
      ensure(step);
      font(size, style, color);
      text(line, x, y);
      y += step;
    }
  };
  const smallCaps = (label: string, x: number, top: number, color: RGB) => {
    font(7.5, 'bold', color);
    doc.setCharSpace(0.5);
    text(label.toUpperCase(), x, top);
    doc.setCharSpace(0);
  };
  const section = (heading: string, accent: RGB, count?: number) => {
    ensure(22);
    y += 5;
    fill(accent);
    doc.roundedRect(margin, y + 0.3, 1.3, 4.6, 0.65, 0.65, 'F');
    font(12.5, 'bold', COLOR.ink);
    text(heading, margin + 4.5, y);
    if (count !== undefined) {
      const headingWidth = doc.getTextWidth(heading);
      font(10, 'normal', COLOR.faint);
      text(String(count), margin + 4.5 + headingWidth + 2.5, y + 0.6);
    }
    y += 9;
  };
  const tintedBox = (lines: string[], size: number, accent: RGB, background: RGB, color: RGB, style: 'normal' | 'italic' = 'normal') => {
    const step = lineHeight(size, 1.55);
    const padding = 5;
    const height = lines.length * step + padding * 2 - (step - ptToMm(size));
    if (height > pageBottom - pageTop) {
      paragraph(lines, margin, size, color, style, 1.55);
      return;
    }
    ensure(height);
    fill(background);
    doc.roundedRect(margin, y, contentWidth, height, 2, 2, 'F');
    fill(accent);
    doc.rect(margin, y, 1.2, height, 'F');
    font(size, style, color);
    lines.forEach((line, i) => text(line, margin + 6, y + padding + i * step));
    y += height;
  };

  doc.setProperties({ title, subject: 'Meeting report', creator: 'HuskyNote' });

  // ── Header ───────────────────────────────────────────────────────────────
  fill(COLOR.emerald);
  doc.rect(0, 0, pageWidth, 2.5, 'F');
  smallCaps('Meeting report', margin, y, COLOR.emerald);
  y += 6;
  font(23, 'bold', COLOR.ink);
  for (const line of wrap(title, contentWidth).slice(0, 3)) {
    text(line, margin, y);
    y += lineHeight(23, 1.18);
  }
  y += 1.5;
  font(9.5, 'normal', COLOR.muted);
  const meta = [dateLong, time, formatDuration(meetingDurationSeconds(meeting))];
  if (meeting.spokenLanguage) meta.push(getLanguageName(meeting.spokenLanguage));
  text(toPdfText(meta.join('  ·  ')), margin, y);
  y += 9;

  // ── At a glance ──────────────────────────────────────────────────────────
  if (summary && !reportMissing) {
    const stats: Array<{ label: string; value: number; color: RGB }> = [
      { label: 'Decisions', value: summary.decisions.length, color: COLOR.emerald },
      { label: 'Action items', value: summary.actionItems.length, color: COLOR.blue },
      { label: 'Topics', value: summary.topics.length, color: COLOR.violet },
      { label: 'Follow-ups', value: summary.followUpTasks.length, color: COLOR.amber },
    ];
    const gap = 4;
    const boxWidth = (contentWidth - gap * (stats.length - 1)) / stats.length;
    const boxHeight = 17;
    stats.forEach((stat, i) => {
      const x = margin + i * (boxWidth + gap);
      fill(COLOR.surface);
      stroke(COLOR.line);
      doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'FD');
      font(17, 'bold', stat.value > 0 ? stat.color : COLOR.faint);
      text(String(stat.value), x + 4.5, y + 3);
      font(8.5, 'normal', COLOR.muted);
      text(stat.label, x + 4.5, y + 11);
    });
    y += boxHeight + 2;
  }

  if (reportMissing) {
    y += 2;
    font(10, 'normal', COLOR.body);
    tintedBox(
      wrap('No AI report yet. Open this meeting in HuskyNote, choose Generate report, then export again to include the summary, decisions and action items.', contentWidth - 12),
      10,
      COLOR.amber,
      COLOR.amberTint,
      COLOR.body
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  if (summary?.overview && !reportMissing) {
    section('Summary', COLOR.emerald);
    font(10.5, 'normal', COLOR.body);
    tintedBox(wrap(summary.overview, contentWidth - 12), 10.5, COLOR.emerald, COLOR.surface, COLOR.body);
  }

  // ── Key decisions ────────────────────────────────────────────────────────
  if (summary && !reportMissing && summary.decisions.length > 0) {
    section('Key decisions', COLOR.emerald, summary.decisions.length);
    const size = 10;
    const step = lineHeight(size);
    summary.decisions.forEach((decision, i) => {
      font(size, 'normal', COLOR.body);
      const lines = wrap(decision, contentWidth - 10);
      ensure(step * Math.min(lines.length, 3));
      fill(COLOR.emerald);
      doc.circle(margin + 2.7, y + 1.9, 2.7, 'F');
      font(7.5, 'bold', COLOR.white);
      doc.text(String(i + 1), margin + 2.7, y + 1.95, { align: 'center', baseline: 'middle' });
      paragraph(lines, margin + 9, size, COLOR.body);
      y += 2.6;
    });
  }

  // ── Action items ─────────────────────────────────────────────────────────
  if (summary && !reportMissing && summary.actionItems.length > 0) {
    section('Action items', COLOR.blue, summary.actionItems.length);
    const size = 10;
    const step = lineHeight(size);
    const ownerWidth = 38;
    const taskX = margin + 8;
    const taskWidth = contentWidth - 8 - ownerWidth - 4;
    const ownerX = margin + contentWidth - ownerWidth;
    smallCaps('Task', taskX, y, COLOR.faint);
    smallCaps('Owner', ownerX, y, COLOR.faint);
    y += 5;
    stroke(COLOR.line);
    doc.line(margin, y, margin + contentWidth, y);
    summary.actionItems.forEach((item) => {
      font(size, 'normal', COLOR.body);
      const lines = wrap(item.task, taskWidth);
      ensure(step * Math.min(lines.length, 3) + 5);
      y += 2.8;
      const rowTop = y;
      stroke(COLOR.blue, 0.35);
      doc.roundedRect(margin + 1, rowTop + 0.35, 3.6, 3.6, 0.7, 0.7, 'S');
      if (item.done) {
        stroke(COLOR.blue, 0.5);
        doc.line(margin + 1.75, rowTop + 2.2, margin + 2.55, rowTop + 3.0);
        doc.line(margin + 2.55, rowTop + 3.0, margin + 3.95, rowTop + 1.2);
      }
      if (item.owner?.trim()) {
        font(8.5, 'bold', COLOR.blue);
        const owner = fit(item.owner, ownerWidth - 6);
        fill(COLOR.blueTint);
        doc.roundedRect(ownerX, rowTop - 0.5, doc.getTextWidth(owner) + 5, 5.2, 2.6, 2.6, 'F');
        text(owner, ownerX + 2.5, rowTop + 0.2);
      } else {
        font(8.5, 'italic', COLOR.faint);
        text('Unassigned', ownerX, rowTop + 0.2);
      }
      paragraph(lines, taskX, size, item.done ? COLOR.faint : COLOR.body);
      y += 1.2;
      stroke(COLOR.line);
      doc.line(margin, y, margin + contentWidth, y);
    });
    y += 1;
  }

  // ── Topics ───────────────────────────────────────────────────────────────
  if (summary && !reportMissing && summary.topics.length > 0) {
    section('Topics discussed', COLOR.violet, summary.topics.length);
    const size = 10;
    const step = lineHeight(size);
    const columnGap = 8;
    const columnWidth = (contentWidth - columnGap) / 2;
    font(size, 'normal', COLOR.body);
    const twoColumns = summary.topics.every((t) => doc.getTextWidth(toPdfText(t)) <= columnWidth - 5);
    const bullet = (x: number) => {
      fill(COLOR.violet);
      doc.circle(x + 1.1, y + 1.85, 0.95, 'F');
    };
    if (twoColumns) {
      for (let i = 0; i < summary.topics.length; i += 2) {
        ensure(step + 1.8);
        summary.topics.slice(i, i + 2).forEach((topic, column) => {
          const x = margin + column * (columnWidth + columnGap);
          bullet(x);
          font(size, 'normal', COLOR.body);
          text(toPdfText(topic), x + 4.5, y);
        });
        y += step + 1.8;
      }
    } else {
      for (const topic of summary.topics) {
        font(size, 'normal', COLOR.body);
        const lines = wrap(topic, contentWidth - 5);
        ensure(step * Math.min(lines.length, 2));
        bullet(margin);
        paragraph(lines, margin + 4.5, size, COLOR.body);
        y += 1.8;
      }
    }
  }

  // ── Open questions & follow-ups ──────────────────────────────────────────
  if (summary && !reportMissing && summary.followUpTasks.length > 0) {
    section('Open questions & follow-ups', COLOR.amber, summary.followUpTasks.length);
    const size = 10;
    const step = lineHeight(size);
    for (const task of summary.followUpTasks) {
      font(size, 'normal', COLOR.body);
      const lines = wrap(task, contentWidth - 7);
      ensure(step * Math.min(lines.length, 3));
      stroke(COLOR.amber, 0.45);
      const mid = y + 1.95;
      doc.line(margin + 0.4, mid, margin + 3.4, mid);
      doc.line(margin + 2.2, mid - 1.2, margin + 3.4, mid);
      doc.line(margin + 2.2, mid + 1.2, margin + 3.4, mid);
      paragraph(lines, margin + 7, size, COLOR.body);
      y += 2.2;
    }
  }

  // ── Notes ────────────────────────────────────────────────────────────────
  if (meeting.manualNotes.trim()) {
    section('Notes', COLOR.muted);
    font(10, 'normal', COLOR.body);
    paragraph(wrap(meeting.manualNotes, contentWidth), margin, 10, COLOR.body, 'normal', 1.5);
  }

  // ── Timeline ─────────────────────────────────────────────────────────────
  if (!reportMissing && meeting.timeline.length > 0) {
    section('Timeline', COLOR.ink, meeting.timeline.length);
    const size = 9.5;
    const step = lineHeight(size);
    const railX = margin + 15;
    const typeColor: Record<string, RGB> = { decision: COLOR.emerald, action: COLOR.blue, note: COLOR.amber, topic: COLOR.faint };
    meeting.timeline.forEach((item, i) => {
      font(size, 'normal', COLOR.body);
      const lines = wrap(item.label, contentWidth - 20);
      ensure(step * Math.min(lines.length, 2) + 2);
      const rowTop = y;
      font(8.5, 'bold', COLOR.muted);
      text(formatSecondsToTime(item.timestampSeconds), margin, rowTop + 0.3);
      paragraph(lines, railX + 4.5, size, COLOR.body);
      const rowBottom = y + 2;
      if (i < meeting.timeline.length - 1 && doc.getCurrentPageInfo().pageNumber === doc.getNumberOfPages() && rowBottom > rowTop) {
        stroke(COLOR.line, 0.3);
        doc.line(railX, rowTop + 3.2, railX, rowBottom + 0.6);
      }
      fill(typeColor[item.type] ?? COLOR.faint);
      doc.circle(railX, rowTop + 1.8, 1.15, 'F');
      y = rowBottom;
    });
  }

  // ── Screenshots ──────────────────────────────────────────────────────────
  if (meeting.screenshots && meeting.screenshots.length > 0) {
    section('Screenshots', COLOR.ink, meeting.screenshots.length);
    const gap = 6;
    const imageWidth = (contentWidth - gap) / 2;
    for (let i = 0; i < meeting.screenshots.length; i += 2) {
      const row = meeting.screenshots.slice(i, i + 2);
      const heights = row.map((shot) => {
        try {
          const props = doc.getImageProperties(shot.dataUrl);
          return Math.min(imageWidth * (props.height / props.width), 90);
        } catch {
          return imageWidth * 0.5625;
        }
      });
      const rowHeight = Math.max(...heights) + 9;
      ensure(rowHeight);
      row.forEach((shot, column) => {
        const x = margin + column * (imageWidth + gap);
        const format = /^data:image\/jpe?g/i.test(shot.dataUrl) ? 'JPEG' : /^data:image\/webp/i.test(shot.dataUrl) ? 'WEBP' : 'PNG';
        try {
          doc.addImage(shot.dataUrl, format, x, y, imageWidth, heights[column]);
          stroke(COLOR.line);
          doc.rect(x, y, imageWidth, heights[column], 'S');
        } catch {
          font(8.5, 'italic', COLOR.faint);
          text('Image could not be embedded', x, y + 2);
        }
        font(8.5, 'normal', COLOR.muted);
        const caption = `${formatSecondsToTime(shot.timestampSeconds)}${shot.caption ? `  ·  ${shot.caption}` : ''}`;
        text(fit(caption, imageWidth), x, y + heights[column] + 2);
      });
      y += rowHeight;
    }
  }

  // ── Transcript appendix ──────────────────────────────────────────────────
  const turns = groupTranscriptTurns(meeting.transcript);
  if (turns.length > 0) {
    newPage();
    smallCaps('Appendix', margin, y, COLOR.muted);
    y += 5.5;
    font(17, 'bold', COLOR.ink);
    text('Transcript', margin, y);
    y += 9;
    font(9, 'normal', COLOR.muted);
    text(`${turns.length} speaker turns  ·  ${meeting.transcript.length} phrases  ·  Speaker names are detected automatically and may be wrong`, margin, y);
    y += 9;
    const speakerColor = new Map<string, RGB>();
    const size = 9.5;
    const step = lineHeight(size);
    for (const turn of turns) {
      if (!speakerColor.has(turn.speaker)) speakerColor.set(turn.speaker, SPEAKER_COLORS[speakerColor.size % SPEAKER_COLORS.length]);
      font(size, 'normal', COLOR.body);
      const lines = wrap(turn.text, contentWidth);
      ensure(5 + step * Math.min(lines.length, 2));
      font(9, 'bold', speakerColor.get(turn.speaker)!);
      const name = fit(turn.speaker || 'Speaker', 70);
      text(name, margin, y);
      const nameWidth = doc.getTextWidth(name);
      font(8.5, 'normal', COLOR.faint);
      text(formatSecondsToTime(turn.startSeconds), margin + nameWidth + 3, y + 0.25);
      y += 4.8;
      paragraph(lines, margin, size, COLOR.body);
      y += 3;
    }
  }

  // ── Running header and footer ────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    font(8, 'normal', COLOR.faint);
    stroke(COLOR.line);
    if (page > 1) {
      text(fit(title, contentWidth - 40), margin, 11);
      text(dateShort, pageWidth - margin, 11, { align: 'right' });
      doc.line(margin, 16, pageWidth - margin, 16);
    }
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    text('HuskyNote  ·  Meeting report', margin, pageHeight - 11);
    text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 11, { align: 'right' });
  }

  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'meeting';
    doc.save(`${slug}_report.pdf`);
  } catch {
    // In headless or test environments without window/navigator, doc.save may safely fall back
  }
  return doc;
}

export function exportManualToPdf(manual: Manual): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text(manual.title || 'Standard Operating Procedure', margin, y);
  y += 10;

  // Date & Version
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date(manual.updatedAt).toLocaleDateString();
  doc.text(`Version: ${manual.version}  |  Updated: ${dateStr}  |  Generated by HuskyNote`, margin, y);
  y += 12;

  // Horizontal separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  // Purpose
  if (manual.purpose) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text('Purpose', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const purposeLines = doc.splitTextToSize(manual.purpose, contentWidth);
    doc.text(purposeLines, margin, y);
    y += purposeLines.length * 5 + 8;
  }

  // Requirements
  if (manual.requirements && manual.requirements.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text('Requirements & Prerequisites', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    manual.requirements.forEach((req) => {
      const bulletText = `• ${req}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth);
      doc.text(lines, margin + 2, y);
      y += lines.length * 5;
    });
    y += 6;
  }

  // Steps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('Operation Steps', margin, y);
  y += 8;

  manual.steps.forEach((step) => {
    // Check if new page needed
    if (y > 240) {
      doc.addPage();
      y = 25;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`Step ${step.stepNumber}: ${step.title}`, margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    const descLines = doc.splitTextToSize(step.description, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 4;

    if (step.screenshotDataUrl) {
      try {
        if (y + 50 > 260) {
          doc.addPage();
          y = 25;
        }
        doc.addImage(step.screenshotDataUrl, 'PNG', margin, y, 100, 56);
        y += 62;
      } catch {
        // skip image rendering if invalid data URL
      }
    }

    if (step.warnings) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(180, 50, 50);
      const warnLines = doc.splitTextToSize(`Warning: ${step.warnings}`, contentWidth);
      doc.text(warnLines, margin, y);
      y += warnLines.length * 5 + 2;
    }

    y += 4;
  });

  const fileName = `${(manual.title || 'manual').toLowerCase().replace(/\s+/g, '_')}_v${manual.version}.pdf`;
  doc.save(fileName);
}

export function exportNoteToPdf(note: Note): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(note.title || 'Untitled Note', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date(note.updatedAt).toLocaleDateString();
  doc.text(`Updated: ${dateStr}  |  HuskyNote`, margin, y);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const contentLines = doc.splitTextToSize(note.content, contentWidth);

  for (let i = 0; i < contentLines.length; i++) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(contentLines[i], margin, y);
    y += 5;
  }

  const fileName = `${(note.title || 'note').toLowerCase().replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
