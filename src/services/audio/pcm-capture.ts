/**
 * Captures raw PCM from a MediaStream and splits it into speech chunks at
 * natural pauses, resampled to the 16 kHz mono input Whisper expects.
 */

export const WHISPER_SAMPLE_RATE = 16000;

export interface SpeechChunk {
  /** 16 kHz mono samples */
  audio: Float32Array;
  /** Offset of the chunk start from the beginning of capture, in seconds */
  startSeconds: number;
}

interface ChunkerOptions {
  /** RMS level above which a frame counts as speech */
  speechThreshold?: number;
  /** Silence after speech that ends a chunk, in seconds */
  endSilenceSeconds?: number;
  /** Chunks are forced out at this length, in seconds */
  maxChunkSeconds?: number;
  /** Speech needed before a chunk is worth transcribing, in seconds */
  minSpeechSeconds?: number;
}

/** Linear-interpolation resampler for mono audio */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export class SpeechChunker {
  private buffers: Float32Array[] = [];
  private bufferedSamples = 0;
  private speechSamples = 0;
  private silenceRun = 0;
  private chunkStartSample = 0;
  private totalSamples = 0;
  private frameRemainder: number[] = [];
  private readonly frameSize: number;
  private readonly opts: Required<ChunkerOptions>;

  constructor(
    private readonly sampleRate: number,
    private readonly onChunk: (chunk: SpeechChunk) => void,
    options: ChunkerOptions = {}
  ) {
    this.frameSize = Math.round(sampleRate * 0.03);
    this.opts = {
      speechThreshold: options.speechThreshold ?? 0.01,
      endSilenceSeconds: options.endSilenceSeconds ?? 0.8,
      maxChunkSeconds: options.maxChunkSeconds ?? 15,
      minSpeechSeconds: options.minSpeechSeconds ?? 0.3,
    };
  }

  push(samples: Float32Array): void {
    this.buffers.push(samples);
    this.bufferedSamples += samples.length;
    this.totalSamples += samples.length;

    // Classify 30 ms frames as speech or silence
    const pending = this.frameRemainder.length ? Float32Array.from([...this.frameRemainder, ...samples]) : samples;
    let offset = 0;
    for (; offset + this.frameSize <= pending.length; offset += this.frameSize) {
      let sum = 0;
      for (let i = offset; i < offset + this.frameSize; i++) sum += pending[i] * pending[i];
      const rms = Math.sqrt(sum / this.frameSize);
      if (rms >= this.opts.speechThreshold) {
        this.speechSamples += this.frameSize;
        this.silenceRun = 0;
      } else {
        this.silenceRun += this.frameSize;
      }
    }
    this.frameRemainder = Array.from(pending.subarray(offset));

    const sr = this.sampleRate;
    const hasSpeech = this.speechSamples >= this.opts.minSpeechSeconds * sr;
    if (hasSpeech && this.silenceRun >= this.opts.endSilenceSeconds * sr) {
      this.emit();
    } else if (this.bufferedSamples >= this.opts.maxChunkSeconds * sr) {
      if (hasSpeech) this.emit();
      else this.dropSilence();
    }
  }

  /** Emit whatever speech is buffered (used when capture stops or pauses). */
  flush(): void {
    if (this.speechSamples >= this.opts.minSpeechSeconds * this.sampleRate) this.emit();
    else this.dropSilence();
  }

  private collect(): Float32Array {
    const all = new Float32Array(this.bufferedSamples);
    let pos = 0;
    for (const b of this.buffers) {
      all.set(b, pos);
      pos += b.length;
    }
    return all;
  }

  private emit(): void {
    const audio = resample(this.collect(), this.sampleRate, WHISPER_SAMPLE_RATE);
    const startSeconds = this.chunkStartSample / this.sampleRate;
    this.reset();
    this.onChunk({ audio, startSeconds });
  }

  private dropSilence(): void {
    this.reset();
  }

  private reset(): void {
    this.buffers = [];
    this.bufferedSamples = 0;
    this.speechSamples = 0;
    this.silenceRun = 0;
    this.chunkStartSample = this.totalSamples;
  }
}

export interface ChunkBatch<T> {
  audio: Float32Array;
  /** Where each merged chunk begins inside `audio`, in seconds */
  parts: { offset: number; startSeconds: number; meta: T }[];
}

/**
 * Merge queued chunks (oldest first) into one buffer of at most `maxSeconds`,
 * so a transcriber that has fallen behind catches up with fewer model calls.
 * Always takes at least one chunk. Removes the merged chunks from `queue`.
 */
export function takeChunkBatch<T>(queue: (SpeechChunk & { meta: T })[], maxSeconds: number): ChunkBatch<T> {
  const taken: (SpeechChunk & { meta: T })[] = [];
  let samples = 0;
  while (queue.length > 0) {
    const next = queue[0];
    if (taken.length > 0 && samples + next.audio.length > maxSeconds * WHISPER_SAMPLE_RATE) break;
    taken.push(queue.shift()!);
    samples += next.audio.length;
  }
  const audio = new Float32Array(samples);
  const parts: ChunkBatch<T>['parts'] = [];
  let pos = 0;
  for (const c of taken) {
    audio.set(c.audio, pos);
    parts.push({ offset: pos / WHISPER_SAMPLE_RATE, startSeconds: c.startSeconds, meta: c.meta });
    pos += c.audio.length;
  }
  return { audio, parts };
}

/** Map a time inside a merged batch back to capture time and the chunk it came from. */
export function locateInBatch<T>(batch: ChunkBatch<T>, seconds: number): { captureSeconds: number; meta: T } {
  let part = batch.parts[0];
  for (const p of batch.parts) {
    if (p.offset <= seconds + 0.05) part = p;
    else break;
  }
  return { captureSeconds: part.startSeconds + Math.max(0, seconds - part.offset), meta: part.meta };
}

// AudioWorklet that mixes input channels to mono and posts ~4096-sample blocks
const TAP_WORKLET = `
class PcmTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.len = 0; }
  process(inputs) {
    const channels = inputs[0];
    if (channels && channels.length && channels[0]) {
      const n = channels[0].length;
      for (let i = 0; i < n; i++) {
        let v = 0;
        for (let c = 0; c < channels.length; c++) v += channels[c][i];
        this.buf[this.len++] = v / channels.length;
        if (this.len === this.buf.length) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(4096);
          this.len = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-tap', PcmTap);
`;

export interface PcmCapture {
  pause(): void;
  resume(): void;
  /** Stops capture and flushes any buffered speech as a final chunk. */
  stop(): void;
}

export async function startPcmCapture(
  stream: MediaStream,
  onChunk: (chunk: SpeechChunk) => void
): Promise<PcmCapture> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioCtx();
  const moduleUrl = URL.createObjectURL(new Blob([TAP_WORKLET], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const chunker = new SpeechChunker(ctx.sampleRate, onChunk);
  const source = ctx.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ctx, 'pcm-tap');
  // A muted path to the destination keeps the worklet pulling audio without playing it
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(tap);
  tap.connect(mute);
  mute.connect(ctx.destination);

  let paused = false;
  tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (!paused) chunker.push(event.data);
  };
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  return {
    pause() {
      paused = true;
      chunker.flush();
    },
    resume() {
      paused = false;
    },
    stop() {
      paused = true;
      tap.port.onmessage = null;
      chunker.flush();
      source.disconnect();
      tap.disconnect();
      mute.disconnect();
      ctx.close().catch(() => {});
    },
  };
}
