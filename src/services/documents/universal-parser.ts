// Universal document parser for HuskyNote
// Extracts structured pages from PDF, PPT/PPTX, DOC/DOCX, TXT, and Markdown files
// 100% client-side, zero external API or cloud dependencies.

import { extractTextFromPDF } from '../pdf/extractor';
import type { ExtractedPage } from '../../types';

export type SupportedDocType = 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt' | 'txt' | 'md';

export interface UniversalParseResult {
  fileType: SupportedDocType;
  pageCount: number;
  extractedPages: ExtractedPage[];
  rawText: string;
}

// Lightweight browser-native zip entry reader for DOCX and PPTX
async function extractZipEntries(
  buffer: ArrayBuffer
): Promise<Map<string, string>> {
  const entries = new Map<string, string>();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  while (offset + 30 <= buffer.byteLength) {
    const signature = view.getUint32(offset, true);
    // Local file header signature 0x04034b50
    if (signature !== 0x04034b50) {
      break;
    }

    const compMethod = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    const fileName = new TextDecoder().decode(nameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compSize;

    if (dataEnd <= buffer.byteLength) {
      const compressedData = bytes.subarray(dataStart, dataEnd);

      try {
        let textContent = '';
        if (compMethod === 0) {
          textContent = new TextDecoder().decode(compressedData);
        } else if (compMethod === 8) {
          // Deflate decompression via standard Web Stream
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const response = new Response(ds.readable);
          textContent = await response.text();
        }

        if (textContent) {
          entries.set(fileName, textContent);
        }
      } catch (err) {
        // Continue to next entry if single file decompression fails
      }
    }

    // Jump to next file header
    offset = dataEnd;
  }

  return entries;
}

// Fallback regex text extractor for binary documents (.doc, .ppt, or corrupted archives)
function extractPrintableText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';
  // Try UTF-8 first
  try {
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const matches = raw.match(/[\x20-\x7E\t\n\r]{4,}/g);
    if (matches && matches.length > 5) {
      text = matches.join(' ');
    }
  } catch {}

  // Fallback to UTF-16LE (common in older Microsoft Office binary files)
  if (!text || text.length < 50) {
    try {
      const raw16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
      const matches16 = raw16.match(/[\x20-\x7E\t\n\r]{4,}/g);
      if (matches16 && matches16.length > 5) {
        text = matches16.join(' ');
      }
    } catch {}
  }

  return text.replace(/\s+/g, ' ').trim();
}

// Main Universal Parser Entry Point
export async function parseDocumentFile(
  file: File
): Promise<UniversalParseResult> {
  const name = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  // 1. PDF files
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const { pageCount, extractedPages } = await extractTextFromPDF(arrayBuffer);
    const rawText = extractedPages.map((p) => p.text).join('\n\n');
    return {
      fileType: 'pdf',
      pageCount,
      extractedPages,
      rawText,
    };
  }

  // 2. Plain text and Markdown (.txt, .text, .md, .markdown, .csv, .json)
  if (
    name.endsWith('.txt') ||
    name.endsWith('.text') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    file.type.startsWith('text/')
  ) {
    const rawText = await file.text();
    // Split plain text into logical pages (~40 lines or ~250 words per page)
    const lines = rawText.split('\n');
    const linesPerPage = 35;
    const extractedPages: ExtractedPage[] = [];

    for (let i = 0; i < lines.length; i += linesPerPage) {
      const pageText = lines.slice(i, i + linesPerPage).join('\n').trim();
      if (pageText) {
        extractedPages.push({
          pageNumber: extractedPages.length + 1,
          text: pageText,
        });
      }
    }

    if (extractedPages.length === 0) {
      extractedPages.push({ pageNumber: 1, text: rawText.trim() || 'Empty document' });
    }

    return {
      fileType: name.endsWith('.md') || name.endsWith('.markdown') ? 'md' : 'txt',
      pageCount: extractedPages.length,
      extractedPages,
      rawText,
    };
  }

  // 3. Word Documents (.docx)
  if (name.endsWith('.docx')) {
    try {
      const zipEntries = await extractZipEntries(arrayBuffer);
      const docXml = zipEntries.get('word/document.xml');

      if (docXml) {
        // Extract paragraph texts from <w:p>...</w:p> containing <w:t>
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXml, 'application/xml');
        const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));

        const extractedParagraphs: string[] = [];
        paragraphs.forEach((p) => {
          const tTags = Array.from(p.getElementsByTagName('w:t'));
          const pText = tTags.map((t) => t.textContent || '').join('');
          if (pText.trim()) {
            extractedParagraphs.push(pText.trim());
          }
        });

        const paragraphsPerPage = 6;
        const extractedPages: ExtractedPage[] = [];
        for (let i = 0; i < extractedParagraphs.length; i += paragraphsPerPage) {
          const pageText = extractedParagraphs.slice(i, i + paragraphsPerPage).join('\n\n');
          extractedPages.push({
            pageNumber: extractedPages.length + 1,
            text: pageText,
          });
        }

        if (extractedPages.length > 0) {
          return {
            fileType: 'docx',
            pageCount: extractedPages.length,
            extractedPages,
            rawText: extractedParagraphs.join('\n\n'),
          };
        }
      }
    } catch (err) {
      console.warn('[HuskyNote] DOCX extraction error, falling back to binary scan:', err);
    }

    // Fallback extraction
    const rawText = extractPrintableText(arrayBuffer);
    return {
      fileType: 'docx',
      pageCount: 1,
      extractedPages: [{ pageNumber: 1, text: rawText || 'Document content extracted.' }],
      rawText,
    };
  }

  // 4. PowerPoint Presentations (.pptx)
  if (name.endsWith('.pptx')) {
    try {
      const zipEntries = await extractZipEntries(arrayBuffer);
      const slideKeys = Array.from(zipEntries.keys())
        .filter((k) => k.startsWith('ppt/slides/slide') && k.endsWith('.xml'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
          const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
          return numA - numB;
        });

      if (slideKeys.length > 0) {
        const extractedPages: ExtractedPage[] = [];
        slideKeys.forEach((key, idx) => {
          const slideXml = zipEntries.get(key) || '';
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(slideXml, 'application/xml');
          const textTags = Array.from(xmlDoc.getElementsByTagName('a:t'));
          const slideText = textTags.map((t) => t.textContent || '').join(' ').trim();

          extractedPages.push({
            pageNumber: idx + 1,
            text: slideText || `Slide ${idx + 1}`,
          });
        });

        const rawText = extractedPages.map((p) => `[Slide ${p.pageNumber}]\n${p.text}`).join('\n\n');
        return {
          fileType: 'pptx',
          pageCount: extractedPages.length,
          extractedPages,
          rawText,
        };
      }
    } catch (err) {
      console.warn('[HuskyNote] PPTX extraction error, falling back to binary scan:', err);
    }

    // Fallback extraction
    const rawText = extractPrintableText(arrayBuffer);
    return {
      fileType: 'pptx',
      pageCount: 1,
      extractedPages: [{ pageNumber: 1, text: rawText || 'Presentation slides extracted.' }],
      rawText,
    };
  }

  // 5. Older Word / PowerPoint formats (.doc, .ppt) or generic documents
  const rawText = extractPrintableText(arrayBuffer);
  const detectedType: SupportedDocType = name.endsWith('.doc')
    ? 'doc'
    : name.endsWith('.ppt')
    ? 'ppt'
    : 'txt';

  const chunks = rawText.split('\n\n').filter(Boolean);
  const extractedPages: ExtractedPage[] = [];
  const chunkSize = 5;

  for (let i = 0; i < chunks.length; i += chunkSize) {
    extractedPages.push({
      pageNumber: extractedPages.length + 1,
      text: chunks.slice(i, i + chunkSize).join('\n\n'),
    });
  }

  if (extractedPages.length === 0) {
    extractedPages.push({ pageNumber: 1, text: rawText || 'Extracted document content' });
  }

  return {
    fileType: detectedType,
    pageCount: extractedPages.length,
    extractedPages,
    rawText,
  };
}
