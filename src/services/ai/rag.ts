import type { ExtractedPage } from '../../types';

export interface DocumentChunk {
  id: string;
  pageNumber: number;
  text: string;
  tokenCount: number;
}

export function chunkDocumentPages(
  pages: ExtractedPage[],
  maxWords: number = 250,
  overlapWords: number = 40
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIdx = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      chunks.push({
        id: `chunk-p${page.pageNumber}-${chunkIdx++}`,
        pageNumber: page.pageNumber,
        text,
        tokenCount: words.length,
      });
      continue;
    }

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxWords, words.length);
      const chunkWords = words.slice(start, end);
      chunks.push({
        id: `chunk-p${page.pageNumber}-${chunkIdx++}`,
        pageNumber: page.pageNumber,
        text: chunkWords.join(' '),
        tokenCount: chunkWords.length,
      });

      if (end >= words.length) break;
      start += maxWords - overlapWords;
    }
  }

  return chunks;
}

// Client-side BM25-style lexical relevance search
export function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 4
): DocumentChunk[] {
  if (!query.trim() || chunks.length === 0) return chunks.slice(0, topK);

  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((chunk) => {
    const chunkText = chunk.text.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      // Frequency count
      const regex = new RegExp(`\\b${term}\\b`, 'g');
      const matches = chunkText.match(regex);
      if (matches) {
        score += matches.length * 2.0;
      } else if (chunkText.includes(term)) {
        score += 0.5;
      }
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

export function buildRAGPrompt(
  question: string,
  relevantChunks: DocumentChunk[]
): string {
  if (relevantChunks.length === 0) {
    return question;
  }

  const contextSegments = relevantChunks.map(
    (c) => `--- DOCUMENT EXCERPT (Source Page: ${c.pageNumber}) ---\n${c.text}`
  );

  return `You are HuskyNote's document analysis assistant. Answer the user's question using ONLY the provided document excerpts below.
If the answer cannot be found in the excerpts, clearly state: "I couldn't find that in this document." Do not hallucinate or fabricate facts. When stating facts, cite the source page number (e.g. [Page X]).

${contextSegments.join('\n\n')}

User Question: ${question}

Answer:`;
}
