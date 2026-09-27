/**
 * Main-thread client for the speech-to-text workers plus a shared status
 * store that the UI subscribes to (model download progress, readiness, errors).
 */
import type { TimedText, WorkerRequest, WorkerResponse } from './asr-protocol';
import type { TranscriptionEngine } from './transcription-engines';
import { requestPersistentStorage } from './model-cache';

export type { TimedText };

export type SpeechEngineState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface SpeechEngineStatus {
  state: SpeechEngineState;
  /** Model download progress, 0-100, while `state` is 'loading' */
  progress?: number;
  message?: string;
  /** Where the model runs once loaded */
  device?: 'webgpu' | 'wasm';
  /** Display name of the engine being loaded or used */
  engineName?: string;
  /** Why the model runs on the CPU although this device has a GPU */
  gpuError?: string;
}

type Listener = (status: SpeechEngineStatus) => void;

class SpeechStatusStore {
  private status: SpeechEngineStatus = { state: 'idle' };
  private listeners = new Set<Listener>();

  get(): SpeechEngineStatus {
    return this.status;
  }

  set(status: SpeechEngineStatus): void {
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const speechStatus = new SpeechStatusStore();

/** Engines expect ISO 639-1 codes; the app uses BCP 47 tags such as 'fr-FR' or 'auto' */
export function toWhisperLanguage(lang: string): string | undefined {
  if (!lang || lang === 'auto') return undefined;
  return lang.split('-')[0].toLowerCase();
}

/** Models emit these on silence or noise; they should never become transcript text */
const NON_SPEECH = /^[\s.,!?]*$|^\s*[[(].*[\])]\s*$/;

export function isNonSpeech(text: string): boolean {
  return NON_SPEECH.test(text);
}

function createWorker(engine: TranscriptionEngine): Worker {
  return engine.runtime === 'parakeet'
    ? new Worker(new URL('./parakeet-asr.worker.ts', import.meta.url), { type: 'module' })
    : new Worker(new URL('./transformers-asr.worker.ts', import.meta.url), { type: 'module' });
}

class SpeechEngine {
  private worker: Worker | null = null;
  private engine: TranscriptionEngine | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (chunks: TimedText[]) => void; reject: (err: Error) => void }>();
  private loadPromise: Promise<void> | null = null;
  private fileProgress = new Map<string, { loaded: number; total: number }>();
  private device: 'webgpu' | 'wasm' | undefined;
  private gpuError: string | undefined;
  private storageRequested = false;

  isSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
  }

  /** The engine currently loaded or loading */
  getEngine(): TranscriptionEngine | null {
    return this.engine;
  }

  private setStatus(status: SpeechEngineStatus): void {
    speechStatus.set({
      ...status,
      engineName: this.engine?.name,
      device: status.device ?? this.device,
      gpuError: status.gpuError ?? this.gpuError,
    });
  }

  private reset(reason: string): void {
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
    this.device = undefined;
    this.gpuError = undefined;
    this.fileProgress.clear();
    this.pending.forEach((p) => p.reject(new Error(reason)));
    this.pending.clear();
  }

  private getWorker(): Worker {
    if (!this.worker) {
      const worker = createWorker(this.engine!);
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(event.data);
      worker.onerror = (event) => {
        const message = event.message || 'Speech model worker failed to start.';
        this.setStatus({ state: 'error', message });
        this.pending.forEach((p) => p.reject(new Error(message)));
        this.pending.clear();
      };
      this.worker = worker;
    }
    return this.worker;
  }

  private handleMessage(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'progress': {
        // Track only the model weights; small config files would make the bar jump around
        if (msg.total < 1_000_000) break;
        this.fileProgress.set(msg.file, { loaded: msg.loaded, total: msg.total });
        let loaded = 0;
        let total = 0;
        this.fileProgress.forEach((f) => {
          loaded += f.loaded;
          total += f.total;
        });
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        const current = speechStatus.get();
        // Weight files register at different times; never move the bar backwards
        this.setStatus({ state: 'loading', progress: Math.max(progress, current.state === 'loading' ? current.progress ?? 0 : 0) });
        break;
      }
      case 'ready':
        this.device = msg.device;
        this.gpuError = msg.gpuError;
        if (msg.gpuError) console.warn(`[HuskyNote] ${this.engine?.name} is running on the CPU: ${msg.gpuError}`);
        this.setStatus({ state: 'ready', device: msg.device, gpuError: msg.gpuError });
        break;
      case 'result': {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p?.resolve(msg.chunks);
        if (this.pending.size === 0 && speechStatus.get().state === 'transcribing') {
          this.setStatus({ state: 'ready' });
        }
        break;
      }
      case 'error': {
        this.setStatus({ state: 'error', message: msg.message });
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          p?.reject(new Error(msg.message));
        }
        break;
      }
    }
  }

  /**
   * Download (first use) and initialize an engine. Switching to a different
   * engine replaces the worker and frees the previous model.
   */
  load(engine: TranscriptionEngine): Promise<void> {
    if (this.engine?.id !== engine.id) {
      this.reset('Speech engine changed.');
      this.engine = engine;
    }
    if (!this.loadPromise) {
      // Models are hundreds of MB; keep the browser from evicting them under storage pressure
      if (!this.storageRequested) {
        this.storageRequested = true;
        requestPersistentStorage();
      }
      if (speechStatus.get().state !== 'ready' || !this.device) this.setStatus({ state: 'loading' });
      this.loadPromise = new Promise<void>((resolve, reject) => {
        const worker = this.getWorker();
        const unsubscribe = speechStatus.subscribe((s) => {
          if (s.state === 'ready') {
            unsubscribe();
            resolve();
          } else if (s.state === 'error') {
            unsubscribe();
            this.loadPromise = null;
            reject(new Error(s.message));
          }
        });
        worker.postMessage({ type: 'load', engine } satisfies WorkerRequest);
      });
    }
    return this.loadPromise;
  }

  /** Transcribe 16 kHz mono PCM into text pieces timed from the start of `audio`. */
  async transcribe(audio: Float32Array, language?: string): Promise<TimedText[]> {
    if (!this.engine) throw new Error('No speech engine selected.');
    await this.load(this.engine);
    const id = this.nextId++;
    this.setStatus({ state: 'transcribing' });
    return new Promise<TimedText[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.getWorker().postMessage({ type: 'transcribe', id, audio, language } satisfies WorkerRequest, [audio.buffer]);
    });
  }
}

export const speechEngine = new SpeechEngine();
