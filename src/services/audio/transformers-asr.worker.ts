/// <reference lib="webworker" />
/**
 * Speech-to-text worker for transformers.js engines (Whisper, Moonshine).
 * Runs on the GPU through WebGPU when available and on the CPU through
 * WebAssembly otherwise. Model weights download once from the Hugging Face
 * CDN and are cached by the browser; audio never leaves the device.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { TransformersEngine } from './transcription-engines';
import { postToClient as post, detectWebGpu, type TimedText, type WorkerRequest } from './asr-protocol';

// Serve the ONNX runtime from the app bundle instead of a CDN
env.backends.onnx.wasm!.wasmPaths = {
  mjs: new URL('../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs', import.meta.url).href,
  wasm: new URL('../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm', import.meta.url).href,
};
env.allowLocalModels = false;

interface LoadedEngine {
  engine: TransformersEngine;
  asr: AutomaticSpeechRecognitionPipeline;
  device: 'webgpu' | 'wasm';
  gpuError?: string;
}

let loaded: Promise<LoadedEngine> | null = null;

const progress_callback = (p: any) => {
  if (p?.status === 'progress' && p.file) {
    post({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
  }
};

async function createEngine(engine: TransformersEngine): Promise<LoadedEngine> {
  // Cast avoids transformers.js' pipeline overload union, which exceeds TypeScript's limits
  const create = pipeline as any;
  const gpu = await detectWebGpu();
  let gpuError = gpu.reason;
  if (gpu.available) {
    gpuError = undefined;
    try {
      const asr = await create('automatic-speech-recognition', engine.model, {
        device: 'webgpu',
        dtype: engine.dtype.webgpu,
        revision: engine.revision,
        progress_callback,
      });
      // The first GPU run compiles shaders; do it now rather than on the first phrase
      await asr(new Float32Array(16000));
      return { engine, asr, device: 'webgpu' };
    } catch (err: any) {
      gpuError = err?.message || String(err);
      console.warn('[HuskyNote] WebGPU speech model failed, using CPU:', err);
    }
  }
  const asr = await create('automatic-speech-recognition', engine.model, {
    device: 'wasm',
    dtype: engine.dtype.wasm,
    revision: engine.revision,
    progress_callback,
  });
  await asr(new Float32Array(16000));
  return { engine, asr, device: 'wasm', gpuError };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type === 'load') {
    if (req.engine.runtime !== 'transformers') return;
    try {
      if (!loaded) {
        loaded = createEngine(req.engine);
        loaded.catch(() => {
          loaded = null; // allow a retry after a failed download
        });
      }
      const { device, gpuError } = await loaded;
      post({ type: 'ready', engineId: req.engine.id, device, gpuError });
    } catch (err: any) {
      post({ type: 'error', message: err?.message || String(err) });
    }
    return;
  }

  if (req.type === 'transcribe') {
    try {
      if (!loaded) throw new Error('No speech engine loaded.');
      const { asr, engine } = await loaded;
      const options =
        engine.languages === 'multilingual'
          ? { task: 'transcribe', language: req.language, chunk_length_s: 30, return_timestamps: engine.timestamps }
          : engine.timestamps
          ? { return_timestamps: true }
          : {};
      const output: any = await asr(req.audio, options);
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
