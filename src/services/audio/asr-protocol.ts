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

export interface WebGpuSupport {
  available: boolean;
  fp16: boolean;
  /** GPU vendor reported by the browser, when available */
  vendor?: string;
  /** Why the GPU cannot be used, when it cannot */
  reason?: string;
}

/** Whether a usable WebGPU adapter exists, optionally with fp16 shader support. */
export async function detectWebGpu(): Promise<WebGpuSupport> {
  try {
    const gpu = (self.navigator as any).gpu;
    if (!gpu) return { available: false, fp16: false, reason: 'This browser does not support WebGPU.' };
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      // Chromium returns no adapter when hardware acceleration is off or the GPU is blocklisted
      return {
        available: false,
        fp16: false,
        reason:
          'The browser is not giving the app access to the GPU. Turn on "Use graphics acceleration when available" in the browser settings and restart the browser.',
      };
    }
    const fp16 = !!adapter.features?.has?.('shader-f16');
    return {
      available: true,
      fp16,
      vendor: adapter.info?.vendor || undefined,
      reason: fp16 ? undefined : 'This GPU does not support fp16 shaders in the browser.',
    };
  } catch (err: any) {
    return { available: false, fp16: false, reason: err?.message || String(err) };
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
