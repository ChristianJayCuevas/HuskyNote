/** Messages exchanged between the speech engine client and its workers. */
import type { TranscriptionEngine } from './transcription-engines';

export interface TimedText {
  /** Seconds from the start of the submitted audio */
  start: number;
  text: string;
}

export type WorkerRequest =
  | { type: 'load'; engine: TranscriptionEngine }
  | { type: 'transcribe'; id: number; audio: Float32Array; language?: string };

export type WorkerResponse =
  | { type: 'progress'; file: string; loaded: number; total: number }
  /** `gpuError` explains why a GPU-capable device ended up on the CPU */
  | { type: 'ready'; engineId: string; device: 'webgpu' | 'wasm'; gpuError?: string }
  | { type: 'result'; id: number; chunks: TimedText[] }
  | { type: 'error'; id?: number; message: string };

export function postToClient(msg: WorkerResponse): void {
  (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(msg);
}

/** Whether a usable WebGPU adapter exists, optionally with fp16 shader support. */
export async function detectWebGpu(): Promise<{ available: boolean; fp16: boolean }> {
  try {
    const gpu = (self.navigator as any).gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    if (!adapter) return { available: false, fp16: false };
    return { available: true, fp16: !!adapter.features?.has?.('shader-f16') };
  } catch {
    return { available: false, fp16: false };
  }
}

/** Split timed words into sentences at end punctuation or long pauses. */
export function wordsToSentences(words: { text: string; start_time: number; end_time: number }[]): TimedText[] {
  const sentences: TimedText[] = [];
  let current: string[] = [];
  let start = 0;
  let lastEnd = 0;
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    if (current.length > 0 && w.start_time - lastEnd > 1.0) {
      sentences.push({ start, text: current.join(' ') });
      current = [];
    }
    if (current.length === 0) start = w.start_time;
    current.push(text);
    lastEnd = w.end_time;
    if (/[.?!。？！]$/.test(text)) {
      sentences.push({ start, text: current.join(' ') });
      current = [];
    }
  }
  if (current.length > 0) sentences.push({ start, text: current.join(' ') });
  return sentences;
}
