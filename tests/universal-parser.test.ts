import { describe, it, expect } from 'vitest';
import { parseDocumentFile } from '../src/services/documents/universal-parser';

describe('Universal Document Parser', () => {
  it('parses plain text and markdown documents correctly into pages', async () => {
    const textContent = '# Software Architecture Specification\n\nHuskyNote operates 100% locally.\n\nAll notes and documents are stored in client-side IndexedDB.';
    const file = new File([textContent], 'architecture.txt', { type: 'text/plain' });

    const result = await parseDocumentFile(file);
    expect(result.fileType).toBe('txt');
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.extractedPages[0].text).toContain('Software Architecture Specification');
    expect(result.rawText).toContain('IndexedDB');
  });

  it('handles markdown files with .md extension', async () => {
    const mdContent = '## Sprint Deliverables\n- Implement universal document parser\n- Verify local AI RAG';
    const file = new File([mdContent], 'sprint.md', { type: 'text/markdown' });

    const result = await parseDocumentFile(file);
    expect(result.fileType).toBe('md');
    expect(result.extractedPages[0].text).toContain('Sprint Deliverables');
  });

  it('resiliently extracts text from binary document fallbacks', async () => {
    const binaryData = new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x20,
      0x53, 0x70, 0x65, 0x63, 0x69, 0x66, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6f, 0x6e
    ]);
    const file = new File([binaryData], 'legacy_doc.doc', { type: 'application/msword' });

    const result = await parseDocumentFile(file);
    expect(result.fileType).toBe('doc');
    expect(result.extractedPages.length).toBeGreaterThan(0);
  });
});
