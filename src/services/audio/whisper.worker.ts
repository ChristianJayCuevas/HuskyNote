/// <reference lib="webworker" />
/**
 * Whisper speech-to-text worker. Runs the model off the main thread with
 * transformers.js (ONNX Runtime Web), on the GPU through WebGPU when available
 * and on the CPU through WebAssembly otherwise. Model weights download once
 * from the Hugging Face CDN and are cached by the browser; audio never leaves
 * the device.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

// Serve the ONNX runtime from the app bundle instead of a CDN
env.backends.onnx.wasm!.wasmPaths = {
  mjs: new URL('../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs', import.meta.url).href,
  wasm: new URL('../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm', import.meta.url).href,
};
env.allowLocalModels = false;

export const WHISPER_MODEL = 'Xenova/whisper-base';

export interface TimedText {
  /** Seconds from the start of the submitted audio */
  start: number;
  text: string;
}

export type WorkerRequest =
  | { type: 'load' }
  | { type: 'transcribe'; id: number; audio: Float32Array; language?: string };

export type WorkerResponse =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'result'; id: number; chunks: TimedText[] }
  | { type: 'error'; id?: number; message: string };

let asrPromise: Promise<{ asr: AutomaticSpeechRecognitionPipeline; device: 'webgpu' | 'wasm' }> | null = null;

function post(msg: WorkerResponse) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
}

const progress_callback = (p: any) => {
  if (p?.status === 'progress' && p.file) {
    post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
  }
};

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (self.navigator as any).gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function createPipeline(): Promise<{ asr: AutomaticSpeechRecognitionPipeline; device: 'webgpu' | 'wasm' }> {
  // Cast avoids transformers.js' pipeline overload union, which exceeds TypeScript's limits
  const create = pipeline as any;
  if (await hasWebGpu()) {
    try {
      const asr = await create('automatic-speech-recognition', WHISPER_MODEL, {
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        progress_callback,
      });
      // The first GPU run compiles shaders; do it now rather than on the first phrase
      await asr(new Float32Array(16000), { language: 'en' });
      return { asr, device: 'webgpu' };
    } catch (err) {
      console.warn('[HuskyNote] WebGPU speech model failed, using CPU:', err);
    }
  }
  const asr = await create('automatic-speech-recognition', WHISPER_MODEL, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback,
  });
  return { asr, device: 'wasm' };
}

function loadModel() {
  if (!asrPromise) {
    asrPromise = createPipeline();
    asrPromise.catch(() => {
      asrPromise = null; // allow a retry after a failed download
    });
  }
  return asrPromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type === 'load') {
    try {
      const { device } = await loadModel();
      post({ type: 'ready', device });
    } catch (err: any) {
      post({ type: 'error', message: err?.message || String(err) });
    }
    return;
  }

  if (req.type === 'transcribe') {
    try {
      const { asr } = await loadModel();
      const output: any = await asr(req.audio, {
        task: 'transcribe',
        language: req.language,
        chunk_length_s: 30,
        return_timestamps: true,
      });
      const results = Array.isArray(output) ? output : [output];
      const chunks: TimedText[] = [];
      for (const r of results) {
        if (Array.isArray(r?.chunks) && r.chunks.length > 0) {
          for (const c of r.chunks) {
            const text = (c.text || '').trim();
            if (text) chunks.push({ start: Array.isArray(c.timestamp) ? c.timestamp[0] ?? 0 : 0, text });
          }
        } else if (r?.text?.trim()) {
          chunks.push({ start: 0, text: r.text.trim() });
        }
      }
      post({ type: 'result', id: req.id, chunks });
    } catch (err: any) {
      post({ type: 'error', id: req.id, message: err?.message || String(err) });
    }
  }
};
