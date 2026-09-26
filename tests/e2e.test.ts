import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATES } from '../src/db';
import { exportNoteToMarkdown, exportManualToMarkdown } from '../src/services/export/markdown';
import { chunkDocumentPages, retrieveRelevantChunks } from '../src/services/ai/rag';
import { formatSecondsToTime } from '../src/services/audio/transcriber';
import type { Note, Manual } from '../src/types';

describe('HuskyNote End-to-End Workflow Verification', () => {
  it('instantiates all built-in templates with valid markdown structures', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    BUILTIN_TEMPLATES.forEach((template) => {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.defaultContent).toContain('#');
      expect(template.category).toMatch(/meeting|operation|general/);
    });
  });

  it('verifies note creation, formatting, and markdown export', () => {
    const template = BUILTIN_TEMPLATES[0];
    const newNote: Note = {
      id: 'e2e-note-1',
      title: `${template.title} Session`,
      content: template.defaultContent,
      tags: [template.category, 'e2e-verified'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [],
    };

    const exported = exportNoteToMarkdown(newNote);
    expect(exported).toContain('title: "Standard Meeting Notes Session"');
    expect(exported).toContain('Tags: meeting, e2e-verified');
    expect(exported).toContain('## Agenda');
    expect(exported).toContain('## Decisions Made');
  });

  it('verifies full document extraction and chunk-based RAG scoring', () => {
    const mockPages = [
      {
        pageNumber: 1,
        text: 'HuskyNote provides meeting note-taking, browser capture, and local AI summarization.',
      },
      {
        pageNumber: 2,
        text: 'The operation manual generator records screen states and detects meaningful user actions.',
      },
    ];

    const chunks = chunkDocumentPages(mockPages, 200, 20);
    expect(chunks.length).toBe(2);

    const hits = retrieveRelevantChunks('operation manual screen states', chunks, 1);
    expect(hits.length).toBe(1);
    expect(hits[0].pageNumber).toBe(2);
    expect(hits[0].text).toContain('operation manual generator');
  });

  it('verifies complete manual data model and markdown generation', () => {
    const manual: Manual = {
      id: 'e2e-manual-1',
      title: 'Production Rollout Procedure',
      purpose: 'Execute canary deployment to production clusters.',
      requirements: ['Kubernetes cluster access', 'Helm 3 installed'],
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          title: 'Verify cluster health',
          description: 'Ensure all worker nodes report Ready state.',
        },
        {
          id: 'step-2',
          stepNumber: 2,
          title: 'Apply canary manifest',
          description: 'Deploy canary pods with 10% traffic weight.',
          warnings: 'Monitor error rate before promoting to 100%.',
        },
      ],
      warnings: ['Do not execute during peak billing hours.'],
      expectedResult: 'Canary verified with zero 5xx anomalies.',
      troubleshooting: ['Inspect pod logs with kubectl logs -l app=canary.'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    const exported = exportManualToMarkdown(manual);
    expect(exported).toContain('# Production Rollout Procedure');
    expect(exported).toContain('Step 1: Verify cluster health');
    expect(exported).toContain('Step 2: Apply canary manifest');
    expect(exported).toContain('Do not execute during peak billing hours.');
    expect(exported).toContain('Canary verified with zero 5xx anomalies.');
  });
});
