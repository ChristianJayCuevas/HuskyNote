export interface TranscriptionMetric {
  kind: 'load' | 'inference';
  engineId: string;
  revision: string;
  device?: string;
  elapsedMs: number;
  audioSeconds?: number;
  at: number;
}

const KEY = 'huskynote_speech_diagnostics';
let samples: TranscriptionMetric[] = [];
export function diagnosticsEnabled(): boolean {
  try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
}
export function setDiagnosticsEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, String(enabled)); } catch { /* private browsing */ }
  if (!enabled) samples = [];
}
export function recordTranscriptionMetric(metric: TranscriptionMetric): void {
  if (diagnosticsEnabled()) samples = [...samples.slice(-199), metric];
}
export function getTranscriptionMetrics(): TranscriptionMetric[] { return samples.map((s) => ({ ...s })); }
