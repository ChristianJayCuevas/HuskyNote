/// <reference lib="webworker" />
/**
 * Speech-to-text worker for NVIDIA Parakeet TDT through parakeet.js. The
 * encoder runs on the GPU through WebGPU (fp16) when the device supports it,
 * otherwise the whole model runs on the CPU (int8). Model files download once
 * from Hugging Face and are cached in IndexedDB; audio never leaves the device.
 */
import { fromHub, type ParakeetModel } from 'parakeet.js';
// The same onnxruntime-web module parakeet.js imports (its pinned version)
import * as ort from 'parakeet-ort-dist/ort.bundle.min.mjs';
import ortMjsUrl from 'parakeet-ort-dist/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasmUrl from 'parakeet-ort-dist/ort-wasm-simd-threaded.jsep.wasm?url';
import type { ParakeetEngine } from './transcription-engines';
import { postToClient as post, detectWebGpu, wordsToSentences, type WorkerRequest } from './asr-protocol';

interface LoadedModel {
  model: ParakeetModel;
  device: 'webgpu' | 'wasm';
  gpuError?: string;
}

let loaded: Promise<LoadedModel> | null = null;

// Serve the ONNX Runtime binaries from the app bundle instead of a CDN, so a cached model
// also starts offline. parakeet.js ignores its own `wasmPaths` option and only falls back to
// the CDN when the runtime has no path set, so set it on the runtime directly.
ort.env.wasm.wasmPaths = {
  mjs: new URL(ortMjsUrl, self.location.href).href,
  wasm: new URL(ortWasmUrl, self.location.href).href,
};

const progress = (p: { loaded: number; total: number; file: string }) => {
  post({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
};

async function createEngine(engine: ParakeetEngine): Promise<LoadedModel> {
  const gpu = await detectWebGpu();
  let gpuError: string | undefined;
  // fp16 encoder weights need GPU fp16 shader support
  if (gpu.available && gpu.fp16) {
    try {
      // 'webgpu-hybrid' puts the encoder on the GPU and the decoder on the CPU. The plain 'webgpu'
      // alias sets no execution provider in fromUrls, so ONNX Runtime silently loads the fp16
      // model on the CPU and runs out of memory (std::bad_alloc).
      const model = await fromHub(engine.model, { backend: 'webgpu-hybrid', ...engine.quant.webgpu, progress });
      await warmUp(model);
      return { model, device: 'webgpu' };
    } catch (err: any) {
      gpuError = err?.message || String(err);
      console.warn('[HuskyNote] Parakeet on WebGPU failed, using CPU:', err);
    }
  } else if (gpu.available) {
    gpuError = 'This GPU does not support fp16 shaders in the browser.';
  }
  const model = await fromHub(engine.model, { backend: 'wasm', ...engine.quant.wasm, progress });
  return { model, device: 'wasm', gpuError };
}

/**
 * The first GPU inference compiles shaders and takes several seconds. Run it on
 * a second of silence during load so the first real phrase is not delayed.
 */
async function warmUp(model: ParakeetModel): Promise<void> {
  await model.transcribe(new Float32Array(16000), 16000);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (req.type === 'load') {
    if (req.engine.runtime !== 'parakeet') return;
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
      const { model } = await loaded;
      const result = await model.transcribe(req.audio, 16000, { returnTimestamps: true });
      const chunks =
        result.words && result.words.length > 0
          ? wordsToSentences(result.words)
          : result.utterance_text?.trim()
          ? [{ start: 0, text: result.utterance_text.trim() }]
          : [];
      post({ type: 'result', id: req.id, chunks });
    } catch (err: any) {
      post({ type: 'error', id: req.id, message: err?.message || String(err) });
    }
  }
};
