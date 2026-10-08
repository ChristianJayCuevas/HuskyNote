import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechEngine } from '../src/services/audio/speech-engine';
import { getTranscriptionEngine } from '../src/services/audio/transcription-engines';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { message: string }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
  send(data: unknown) { this.onmessage?.({ data }); }
}
let engine: SpeechEngine;
beforeEach(() => {
  vi.useFakeTimers(); TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
  engine = new SpeechEngine();
});
afterEach(() => { engine.cancel(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const model = getTranscriptionEngine('whisper-base');

describe('speech worker lifecycle', () => {
  it('reuses a warm model and keeps retryable caller audio intact', async () => {
    const load = engine.load(model);
    const worker = TestWorker.instances[0];
    worker.send({ type: 'ready', engineId: model.id, device: 'wasm' }); await load;
    await engine.load(model);
    expect(TestWorker.instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const audio = new Float32Array([0.1, 0.2]);
    const result = engine.transcribe(audio, 'tl');
    await vi.advanceTimersByTimeAsync(0);
    const request = worker.postMessage.mock.calls.at(-1)![0];
    expect(request.audio).not.toBe(audio);
    expect(request.language).toBe('tl');
    worker.send({ type: 'result', id: request.id, chunks: [{ start: 0, text: 'Salamat.' }] });
    expect(await result).toEqual([{ start: 0, text: 'Salamat.' }]);
  });

  it('rejects cancelled setup and ignores messages from its terminated worker', async () => {
    const first = engine.load(model);
    const rejected = expect(first).rejects.toThrow('cancelled');
    const old = TestWorker.instances[0]; engine.cancel(); await rejected;
    const second = engine.load(model); let ready = false; void second.then(() => { ready = true; });
    old.send({ type: 'ready', engineId: model.id, device: 'wasm' });
    await Promise.resolve(); expect(ready).toBe(false);
    TestWorker.instances[1].send({ type: 'ready', engineId: model.id, device: 'wasm' }); await second;
  });

  it('times out a stuck inference and permits a fresh worker on retry', async () => {
    const loaded = engine.load(model);
    TestWorker.instances[0].send({ type: 'ready', engineId: model.id, device: 'wasm' }); await loaded;
    const result = engine.transcribe(new Float32Array(16000));
    const rejection = expect(result).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(120001); await rejection;
    const retry = engine.load(model);
    expect(TestWorker.instances).toHaveLength(2);
    TestWorker.instances[1].send({ type: 'ready', engineId: model.id, device: 'wasm' }); await retry;
  });
});
