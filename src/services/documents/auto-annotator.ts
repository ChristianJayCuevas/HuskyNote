import { jsPDF } from 'jspdf';
import type { Annotation, DocumentEntity } from '../../types';

export interface DocumentEvidenceNote {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  query: string;
  aiSummary: string;
  excerpt: string;
  screenshotDataUrl: string;
  timestamp: number;
  stepIndex?: number;
  totalSteps?: number;
}

export interface AnnotationCoordResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: 'exact' | 'partial' | 'fallback';
  matchedText: string;
}

// Layout constants matching the actual text document viewer CSS:
// Container: p-10 (40px), AnnotationLayer: 600x720
// Header: ~50px (font 10px + pb-3 + mb-6)
// Text: text-sm (14px), leading-relaxed (line-height 1.625 = ~22.75px)
// The annotation layer overlays the full container at 600x720.
const TEXT_DOC_LAYOUT = {
  containerW: 600,
  containerH: 720,
  paddingPx: 40,
  headerHeightPx: 50,  // header + border + margin
  fontSize: 14,
  lineHeight: 22.75,   // 14px * 1.625
  paragraphGap: 16,    // space-y-4
  charsPerLine: 72,    // approximate at 14px sans-serif in ~520px content area
};

// Step box colors: stored on the annotation and burned into the exported screenshots (canvas drawing, not UI chrome)
// design-exception: annotation overlay colors
const ANNOTATION_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

// The generated "digital paper" screenshot is a white document page in both themes (canvas drawing)
// design-exception: paper page colors for canvas-rendered screenshots
const PAPER_COLORS = { page: '#ffffff', rule: '#e4e4e7', meta: '#71717a', text: '#18181b', footer: '#a1a1aa', badgeText: '#ffffff' } as const;

export class DocumentAutoAnnotatorService {

  /**
   * Simulates CSS word-wrapping of text at a given character width.
   * Returns an array of wrapped lines.
   */
  private simulateTextWrap(text: string, charsPerLine: number): string[] {
    const paragraphs = text.split('\n');
    const wrappedLines: string[] = [];

    for (const para of paragraphs) {
      if (!para.trim()) {
        wrappedLines.push(''); // empty line for paragraph break
        continue;
      }
      const words = para.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length > charsPerLine && currentLine) {
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
    }

    return wrappedLines;
  }

  /**
   * Finds the excerpt in wrapped lines and returns start/end line indices.
   */
  private findExcerptInLines(
    wrappedLines: string[],
    excerpt: string
  ): { startLine: number; endLine: number; confidence: 'exact' | 'partial' | 'fallback'; matchedText: string } {
    const cleanExcerpt = excerpt.toLowerCase().replace(/\s+/g, ' ').trim();

    // Build a flat text from wrapped lines for searching
    const flatText = wrappedLines.map((l) => l.toLowerCase().replace(/\s+/g, ' ').trim()).join(' ');

    // Strategy 1: Exact match
    let searchStr = cleanExcerpt;
    let idx = flatText.indexOf(searchStr);
    let confidence: 'exact' | 'partial' | 'fallback' = 'exact';

    // Strategy 2: First 50 chars
    if (idx === -1 && cleanExcerpt.length > 50) {
      searchStr = cleanExcerpt.slice(0, 50);
      idx = flatText.indexOf(searchStr);
      confidence = 'partial';
    }

    // Strategy 3: Individual sentences
    if (idx === -1) {
      const sentences = cleanExcerpt
        .split(/[.!?\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12);

      for (const sent of sentences) {
        idx = flatText.indexOf(sent);
        if (idx !== -1) {
          searchStr = sent;
          confidence = 'partial';
          break;
        }
      }
    }

    // Strategy 4: Keyword sliding window
    if (idx === -1) {
      const excerptWords = cleanExcerpt.split(' ').filter((w) => w.length > 3);
      const flatWords = flatText.split(' ');
      let bestScore = 0;
      let bestIdx = 0;
      const windowSize = Math.min(excerptWords.length, 12);

      for (let i = 0; i <= flatWords.length - windowSize; i++) {
        let score = 0;
        for (let j = 0; j < windowSize; j++) {
          if (excerptWords[j] && flatWords[i + j]?.includes(excerptWords[j])) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestScore >= 3) {
        // Calculate character position of best word index
        let charPos = 0;
        for (let i = 0; i < bestIdx; i++) {
          charPos += flatWords[i].length + 1;
        }
        idx = charPos;
        searchStr = flatWords.slice(bestIdx, bestIdx + windowSize).join(' ');
        confidence = 'partial';
      }
    }

    if (idx === -1) {
      return { startLine: 0, endLine: Math.min(3, wrappedLines.length - 1), confidence: 'fallback', matchedText: '' };
    }

    // Map character position in flat text back to wrapped line numbers
    let charAccum = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < wrappedLines.length; i++) {
      const lineLen = wrappedLines[i].trim().length;
      const lineStart = charAccum;
      const lineEnd = charAccum + lineLen;

      if (idx >= lineStart && idx <= lineEnd) {
        startLine = i;
      }
      if ((idx + searchStr.length) >= lineStart && (idx + searchStr.length) <= lineEnd + 1) {
        endLine = i;
      }

      charAccum = lineEnd + 1; // +1 for the space joining lines
    }

    endLine = Math.max(endLine, startLine);

    return { startLine, endLine, confidence, matchedText: searchStr };
  }

  /**
   * Calculates dynamic coordinates for an excerpt within a text document page.
   * Uses simulated text wrapping to match the actual CSS rendering.
   * Accepts the real container dimensions from the ResizeObserver.
   */
  locateExcerptCoordinates(
    pageText: string,
    excerpt: string,
    containerWidth?: number,
    containerHeight?: number
  ): AnnotationCoordResult {
    if (!pageText || !pageText.trim()) {
      return { x: 6, y: 12, width: 88, height: 8, confidence: 'fallback', matchedText: '' };
    }

    // Use actual container dimensions if provided, otherwise fallback to defaults
    const cw = containerWidth || TEXT_DOC_LAYOUT.containerW;
    const ch = containerHeight || TEXT_DOC_LAYOUT.containerH;
    const padding = TEXT_DOC_LAYOUT.paddingPx;
    const headerH = TEXT_DOC_LAYOUT.headerHeightPx;
    const lineH = TEXT_DOC_LAYOUT.lineHeight;

    // Dynamically calculate chars-per-line based on actual content width
    // Content area = containerWidth - (2 * padding)
    // At ~7.5px per character (14px sans-serif average), calculate fitting
    const contentWidthPx = cw - 2 * padding;
    const charWidth = 7.5;
    const charsPerLine = Math.max(30, Math.floor(contentWidthPx / charWidth));

    // Simulate wrapping at the calculated character width
    const wrappedLines = this.simulateTextWrap(pageText, charsPerLine);

    // Find the excerpt in the wrapped lines
    const result = this.findExcerptInLines(wrappedLines, excerpt);

    if (result.confidence === 'fallback') {
      return { x: 6, y: 12, width: 88, height: 8, confidence: 'fallback', matchedText: '' };
    }

    // Convert line indices to pixel positions relative to the container
    // Content starts at: padding + header height
    const contentStartPx = padding + headerH;

    // Each wrapped line occupies lineHeight pixels
    const startPx = contentStartPx + result.startLine * lineH;
    const endPx = contentStartPx + (result.endLine + 1) * lineH;

    // Convert to percentages of the actual container dimensions
    const xPct = (padding / cw) * 100;
    const widthPct = (contentWidthPx / cw) * 100;

    const yPct = (startPx / ch) * 100;
    const heightPct = Math.max(
      (lineH / ch) * 100,           // minimum 1 line height
      ((endPx - startPx) / ch) * 100
    );

    return {
      x: Math.round(xPct * 10) / 10,
      y: Math.max(1, Math.round(yPct * 10) / 10),
      width: Math.round(widthPct * 10) / 10,
      height: Math.min(50, Math.round(heightPct * 10) / 10),
      confidence: result.confidence,
      matchedText: result.matchedText,
    };
  }

  /**
   * Creates a border-only rectangle annotation object.
   */
  createBoxoutAnnotation(params: {
    documentId: string;
    pageNumber: number;
    coords: { x: number; y: number; width: number; height: number };
    label?: string;
    text?: string;
    stepIndex?: number;
  }): Annotation {
    const colors = ANNOTATION_COLORS;
    const colorIdx = (params.stepIndex || 0) % colors.length;

    return {
      id: `auto-ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      documentId: params.documentId,
      pageNumber: params.pageNumber,
      type: 'rectangle',
      coords: params.coords,
      color: colors[colorIdx],
      label: params.label || 'AI Reference',
      text: params.text || '',
      createdAt: Date.now(),
    };
  }

  /**
   * Captures an annotated screenshot of a PDF canvas.
   * Border-only box, no inner fill.
   */
  capturePdfPageScreenshot(
    canvas: HTMLCanvasElement,
    boxCoords: { x: number; y: number; width: number; height: number },
    label: string = 'AI Focus',
    stepIndex?: number
  ): string {
    const width = canvas.width;
    const height = canvas.height;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const ctx = outCanvas.getContext('2d');

    if (!ctx) return canvas.toDataURL('image/png');

    // Draw PDF page
    ctx.drawImage(canvas, 0, 0, width, height);

    const colors = ANNOTATION_COLORS;
    const color = colors[(stepIndex || 0) % colors.length];

    const boxX = (boxCoords.x / 100) * width;
    const boxY = (boxCoords.y / 100) * height;
    const boxW = (boxCoords.width / 100) * width;
    const boxH = (boxCoords.height / 100) * height;

    ctx.save();

    // Border only -- no inner fill
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, Math.round(width * 0.003));
    ctx.setLineDash([]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Label badge
    const badgeText = label.toUpperCase();
    ctx.font = `bold ${Math.max(12, Math.round(width * 0.014))}px monospace, sans-serif`;
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 12;
    const badgeH = Math.max(20, Math.round(width * 0.02));

    ctx.fillStyle = color;
    ctx.fillRect(boxX, Math.max(2, boxY - badgeH), badgeW, badgeH);

    ctx.fillStyle = PAPER_COLORS.badgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, boxX + badgeW / 2, Math.max(2, boxY - badgeH) + badgeH / 2);
    ctx.restore();

    return outCanvas.toDataURL('image/png');
  }

  /**
   * Generates a digital paper screenshot for Text/Word/PPTX/MD documents.
   * Border-only annotation, accurate line-based positioning.
   */
  captureDigitalPaperScreenshot(params: {
    fileName: string;
    pageNumber: number;
    pageCount: number;
    pageText: string;
    boxCoords: { x: number; y: number; width: number; height: number };
    label?: string;
    stepIndex?: number;
  }): string {
    const width = 1000;
    const height = 1300;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // Page background
    ctx.fillStyle = PAPER_COLORS.page;
    ctx.fillRect(0, 0, width, height);

    // Subtle page border
    ctx.strokeStyle = PAPER_COLORS.rule;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // Header
    ctx.fillStyle = PAPER_COLORS.meta;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PAGE ${params.pageNumber} OF ${params.pageCount}`, 50, 60);

    ctx.textAlign = 'right';
    ctx.fillText(params.fileName, width - 50, 60);

    ctx.strokeStyle = PAPER_COLORS.rule;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(50, 75);
    ctx.lineTo(width - 50, 75);
    ctx.stroke();

    // Body text
    ctx.fillStyle = PAPER_COLORS.text;
    ctx.font = '19px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = this.wrapText(ctx, params.pageText || 'Empty page content.', width - 100);
    let lineY = 105;
    for (let i = 0; i < Math.min(lines.length, 38); i++) {
      ctx.fillText(lines[i], 50, lineY);
      lineY += 28;
    }

    // Annotation: BORDER ONLY -- no inner fill
    const colors = ANNOTATION_COLORS;
    const color = colors[(params.stepIndex || 0) % colors.length];

    const boxX = (params.boxCoords.x / 100) * width;
    const boxY = (params.boxCoords.y / 100) * height;
    const boxW = (params.boxCoords.width / 100) * width;
    const boxH = (params.boxCoords.height / 100) * height;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Badge label
    const labelText = (params.label || 'AI FOCUS').toUpperCase();
    ctx.font = 'bold 13px monospace';
    const badgeW = ctx.measureText(labelText).width + 12;
    const badgeH = 22;
    ctx.fillStyle = color;
    ctx.fillRect(boxX, Math.max(6, boxY - badgeH), badgeW, badgeH);

    ctx.fillStyle = PAPER_COLORS.badgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, boxX + badgeW / 2, Math.max(6, boxY - badgeH) + badgeH / 2);
    ctx.restore();

    // Footer
    ctx.strokeStyle = PAPER_COLORS.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, height - 55);
    ctx.lineTo(width - 50, height - 55);
    ctx.stroke();

    ctx.fillStyle = PAPER_COLORS.footer;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HUSKYNOTE DOCUMENT INTELLIGENCE', 50, height - 32);

    return canvas.toDataURL('image/png');
  }

  /**
   * Helper to wrap text into canvas lines.
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const rawParagraphs = text.split('\n');
    const result: string[] = [];

    rawParagraphs.forEach((para) => {
      if (!para.trim()) {
        result.push('');
        return;
      }
      const words = para.split(' ');
      let currentLine = '';

      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && currentLine) {
          result.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) result.push(currentLine);
    });

    return result;
  }

  /**
   * Compiles multiple evidence notes into structured Markdown.
   */
  compileNotesToMarkdown(notes: DocumentEvidenceNote[], docTitle: string): string {
    const dateStr = new Date().toISOString().split('T')[0];

    let md = `# Document Notes: ${docTitle}\n\n`;
    md += `**Document:** ${docTitle}  \n`;
    md += `**Date:** ${dateStr}  \n`;
    md += `**Notes Captured:** ${notes.length}  \n\n`;
    md += `---\n\n`;

    notes.forEach((note, idx) => {
      const num = idx + 1;
      md += `## ${num}. ${note.query}\n\n`;
      md += `- **Page:** ${note.pageNumber}  \n`;
      md += `- **Time:** ${new Date(note.timestamp).toLocaleTimeString()}  \n\n`;

      if (note.excerpt) {
        md += `> **Referenced Text:**\n`;
        md += `> "${note.excerpt}"\n\n`;
      }

      md += `### Analysis\n\n`;
      md += `${note.aiSummary}\n\n`;

      if (note.screenshotDataUrl) {
        md += `### Annotated Screenshot\n\n`;
        md += `![Page ${note.pageNumber}](${note.screenshotDataUrl})\n\n`;
      }

      md += `---\n\n`;
    });

    md += `*Generated by HuskyNote.*\n`;
    return md;
  }

  /**
   * Compiles evidence notes into a formatted PDF download.
   */
  compileNotesToPdf(notes: DocumentEvidenceNote[], docTitle: string): void {
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
    doc.text(`Document Notes: ${docTitle}`, margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`${notes.length} notes | ${dateStr} | HuskyNote`, margin, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentWidth, y);
    y += 10;

    notes.forEach((note, idx) => {
      if (y > 230) {
        doc.addPage();
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(24, 24, 27);
      doc.text(`${idx + 1}. ${note.query}`, margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(113, 113, 122);
      doc.text(`Page ${note.pageNumber} | ${new Date(note.timestamp).toLocaleTimeString()}`, margin, y);
      y += 8;

      if (note.excerpt) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const quoteLines = doc.splitTextToSize(`"${note.excerpt}"`, contentWidth - 8);
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 4, contentWidth, quoteLines.length * 4.5 + 4, 'F');
        doc.text(quoteLines, margin + 4, y);
        y += quoteLines.length * 4.5 + 8;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      const summaryLines = doc.splitTextToSize(note.aiSummary, contentWidth);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 4.8 + 10;

      if (note.screenshotDataUrl && y < 190) {
        try {
          const imgWidth = 80;
          const imgHeight = 60;
          doc.addImage(note.screenshotDataUrl, 'PNG', margin, y, imgWidth, imgHeight);
          y += imgHeight + 12;
        } catch {
          // ignore
        }
      }

      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y, margin + contentWidth, y);
      y += 10;
    });

    const safeFileName = docTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc.save(`${safeFileName}-notes.pdf`);
  }
}

export const autoAnnotator = new DocumentAutoAnnotatorService();
