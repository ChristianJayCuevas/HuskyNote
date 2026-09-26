/**
 * Main-thread client for the Whisper worker plus a shared status store that
 * the UI subscribes to (model download progress, readiness, errors).
 */
import type { TimedText, WorkerRequest, WorkerResponse } from './whisper.worker';

export type { TimedText };

export type SpeechEngineState = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface SpeechEngineStatus {
  state: SpeechEngineState;
  /** Model download progress, 0-100, while `state` is 'loading' */
  progress?: number;
  message?: string;
  /** Where the model runs once loaded */
  device?: 'webgpu' | 'wasm';
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

/** Whisper expects ISO 639-1 codes; the app uses BCP 47 tags such as 'fr-FR' or 'auto' */
export function toWhisperLanguage(lang: string): string | undefined {
  if (!lang || lang === 'auto') return undefined;
  return lang.split('-')[0].toLowerCase();
}

/** Whisper emits these on silence or noise; they should never become transcript text */
const NON_SPEECH = /^[\s.,!?]*$|^\s*[[(].*[\])]\s*$/;

export function isNonSpeech(text: string): boolean {
  return NON_SPEECH.test(text);
}

class WhisperEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (chunks: TimedText[]) => void; reject: (err: Error) => void }>();
  private device: 'webgpu' | 'wasm' | undefined;
  private loadPromise: Promise<void> | null = null;
  private fileProgress = new Map<string, { loaded: number; total: number }>();

  isSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        const message = event.message || 'Speech model worker failed to start.';
        speechStatus.set({ state: 'error', message });
        this.pending.forEach((p) => p.reject(new Error(message)));
        this.pending.clear();
      };
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
        speechStatus.set({ state: 'loading', progress: Math.max(progress, current.state === 'loading' ? current.progress ?? 0 : 0) });
        break;
      }
      case 'ready':
        this.device = msg.device;
        speechStatus.set({ state: 'ready', device: msg.device });
        break;
      case 'result': {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p?.resolve(msg.chunks);
        if (this.pending.size === 0 && speechStatus.get().state === 'transcribing') {
          speechStatus.set({ state: 'ready', device: this.device });
        }
        break;
      }
      case 'error': {
        speechStatus.set({ state: 'error', message: msg.message });
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          p?.reject(new Error(msg.message));
        }
        break;
      }
    }
  }

  /** Download (first use) and initialize the model. Safe to call repeatedly. */
  load(): Promise<void> {
    if (!this.loadPromise) {
      if (speechStatus.get().state !== 'ready') speechStatus.set({ state: 'loading' });
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
        worker.postMessage({ type: 'load' } satisfies WorkerRequest);
      });
    }
    return this.loadPromise;
  }

  /** Transcribe 16 kHz mono PCM into text pieces timed from the start of `audio`. */
  async transcribe(audio: Float32Array, language?: string): Promise<TimedText[]> {
    await this.load();
    const id = this.nextId++;
    speechStatus.set({ state: 'transcribing', device: this.device });
    return new Promise<TimedText[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.getWorker().postMessage({ type: 'transcribe', id, audio, language } satisfies WorkerRequest, [audio.buffer]);
    });
  }
}

export const whisperEngine = new WhisperEngine();
