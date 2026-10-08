// Small declarative validators: reject malformed nested records before IndexedDB writes.
type Check = (value: any) => boolean;
const s: Check = (v) => typeof v === 'string';
const n: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const b: Check = (v) => typeof v === 'boolean';
const optional = (check: Check): Check => (v) => v === undefined || check(v);
const array = (check: Check): Check => (v) => Array.isArray(v) && v.every(check);
const obj = (shape: Record<string, Check>): Check => (v) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.entries(shape).every(([key, check]) => check(v[key]));
const strings = array(s);
const coords = obj({ x: n, y: n, width: n, height: n });
const annotation = obj({ id: s, documentId: s, pageNumber: n, type: s, coords, color: s, createdAt: n, text: optional(s) });
const step = { id: s, stepNumber: n, screenshotBlobId: optional(s), screenshotDataUrl: optional(s) };
export const validators: Record<string, Check> = {
  notes: obj({ id: s, title: s, content: s, tags: strings, createdAt: n, updatedAt: n,
    versions: array(obj({ id: s, timestamp: n, title: s, content: s })) }),
  meetings: obj({ id: s, title: s, startTime: n, durationSeconds: n, audioBlobId: optional(s), manualNotes: s, createdAt: n,
    transcript: array(obj({ id: s, timestampSeconds: n, speaker: s, text: s })),
    timeline: array(obj({ id: s, timestampSeconds: n, timeFormatted: s, label: s, type: s })),
    screenshots: array(obj({ id: s, timestampSeconds: n, dataUrl: s })),
    summary: optional(obj({ overview: s, decisions: strings, actionItems: array(obj({ task: s, owner: optional(s) })), topics: strings, followUpTasks: strings })) }),
  documents: obj({ id: s, title: s, fileName: s, fileSize: n, pageCount: n, fileBlobId: s, createdAt: n,
    extractedPages: array(obj({ pageNumber: n, text: s })) }),
  annotations: annotation,
  operationSessions: obj({ id: s, title: s, recordedAt: n, durationSeconds: n,
    steps: array(obj({ ...step, timestamp: n, actionDescription: s, annotations: array(annotation) })) }),
  manuals: obj({ id: s, title: s, purpose: s, requirements: strings, warnings: strings, expectedResult: s,
    troubleshooting: strings, createdAt: n, updatedAt: n, version: n,
    steps: array(obj({ ...step, title: s, description: s })) }),
  templates: obj({ id: s, title: s, category: s, description: s, defaultContent: s, isBuiltin: b }),
  schedule: obj({ id: s, title: s, date: s, time: s, durationMin: n, category: s, completed: b, createdAt: n }),
  settings: obj({ id: (v) => v === 'current', theme: (v) => v === 'dark', autoSaveIntervalSeconds: (v) => n(v) && v > 0,
    speechLanguage: s, selectedModel: s }),
  blobs: obj({ id: s, mimeType: s, createdAt: n, asset: s }),
  audioChunks: obj({ id: s, recordingId: s, sequence: (v) => Number.isSafeInteger(v) && v >= 0, createdAt: n, asset: s }),
  speechJobs: obj({ id: s, meetingId: s, sequence: (v) => Number.isSafeInteger(v) && v >= 0, startSeconds: n,
    language: s, speaker: s, engineId: s, attempts: n, asset: s }),
};

export function validateRecords(tables: Record<string, any[]>): void {
  if (!tables || Object.keys(tables).some((key) => !Object.prototype.hasOwnProperty.call(validators, key))) throw new Error('Unknown archive table.');
  let count = 0;
  for (const [name, check] of Object.entries(validators)) {
    const records = tables[name];
    if (!Array.isArray(records)) throw new Error(`Missing archive table: ${name}.`);
    count += records.length;
    if (count > 100_000) throw new Error('Archive exceeds the 100,000 record limit.');
    const ids = new Set<string>();
    for (const record of records) {
      if (!check(record) || !record.id || ids.has(record.id)) throw new Error(`Invalid or duplicate record in ${name}.`);
      ids.add(record.id);
    }
  }
  if (tables.settings.length > 1) throw new Error('Duplicate settings.');
}
