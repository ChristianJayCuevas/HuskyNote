import { describe, it, expect } from 'vitest';
import { chunkDocumentPages, retrieveRelevantChunks, buildRAGPrompt } from '../src/services/ai/rag';
import type { ExtractedPage } from '../src/types';

describe('Document RAG Engine', () => {
  it('chunks document pages while preserving page numbers', () => {
    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: 'This is the first page introducing the HuskyNote architecture.',
      },
      {
        pageNumber: 2,
        text: 'This is the second page discussing local Ollama integration and privacy.',
      },
    ];

    const chunks = chunkDocumentPages(pages, 100, 20);
    expect(chunks.length).toBe(2);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[1].pageNumber).toBe(2);
  });

  it('retrieves relevant chunks by query terms', () => {
    const chunks = [
      {
        id: 'c-1',
        pageNumber: 1,
        text: 'We handle database migrations with Dexie IndexedDB client-side.',
        tokenCount: 8,
      },
      {
        id: 'c-2',
        pageNumber: 2,
        text: 'Audio recording uses MediaRecorder and Web Audio analyser.',
        tokenCount: 8,
      },
      {
        id: 'c-3',
        pageNumber: 3,
        text: 'Ollama models run on localhost port 11434 with streaming support.',
        tokenCount: 10,
      },
    ];

    const results = retrieveRelevantChunks('How does audio recording work?', chunks, 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pageNumber).toBe(2);
    expect(results[0].text).toContain('Audio recording');
  });

  it('builds RAG prompt citing source pages and anti-hallucination instruction', () => {
    const relevant = [
      {
        id: 'c-1',
        pageNumber: 4,
        text: 'Configuration parameters are stored in config.json.',
        tokenCount: 6,
      },
    ];

    const prompt = buildRAGPrompt('Where are configurations stored?', relevant);
    expect(prompt).toContain('Source Page: 4');
    expect(prompt).toContain('I couldn\'t find that in this document');
    expect(prompt).toContain('Where are configurations stored?');
  });
});
