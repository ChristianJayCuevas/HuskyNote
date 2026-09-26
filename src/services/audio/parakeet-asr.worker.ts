/// <reference lib="webworker" />
/**
 * Speech-to-text worker for NVIDIA Parakeet TDT through parakeet.js. The
 * encoder runs on the GPU through WebGPU (fp16) when the device supports it,
 * otherwise the whole model runs on the CPU (int8). Model files download once
 * from Hugging Face and are cached in IndexedDB; audio never leaves the device.
 */
import { fromHub, type ParakeetModel } from 'parakeet.js';
import type { ParakeetEngine } from './transcription-engines';
import { postToClient as post, detectWebGpu, wordsToSentences, type WorkerRequest } from './asr-protocol';

let loaded: Promise<{ model: ParakeetModel; device: 'webgpu' | 'wasm' }> | null = null;

const progress = (p: { loaded: number; total: number; file: string }) => {
  post({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total });
};

async function createEngine(engine: ParakeetEngine): Promise<{ model: ParakeetModel; device: 'webgpu' | 'wasm' }> {
  const gpu = await detectWebGpu();
  // fp16 encoder weights need GPU fp16 shader support
  if (gpu.available && gpu.fp16) {
    try {
      const model = await fromHub(engine.model, { backend: 'webgpu', ...engine.quant.webgpu, progress });
      return { model, device: 'webgpu' };
    } catch (err) {
      console.warn('[HuskyNote] Parakeet on WebGPU failed, using CPU:', err);
    }
  }
  const model = await fromHub(engine.model, { backend: 'wasm', ...engine.quant.wasm, progress });
  return { model, device: 'wasm' };
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
      const { device } = await loaded;
      post({ type: 'ready', engineId: req.engine.id, device });
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
