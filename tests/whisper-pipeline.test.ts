import { describe, it, expect } from 'vitest';
import {
  SpeechChunker,
  resample,
  takeChunkBatch,
  locateInBatch,
  WHISPER_SAMPLE_RATE,
  type SpeechChunk,
} from '../src/services/audio/pcm-capture';
import { isNonSpeech, toWhisperLanguage } from '../src/services/audio/whisper-engine';

const RATE = 48000;

function tone(seconds: number, amplitude = 0.2): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * 220 * i) / RATE) * amplitude;
  return out;
}

const silence = (seconds: number) => new Float32Array(Math.round(seconds * RATE));

/** Feed audio in the 4096-sample blocks the capture worklet posts */
function feed(chunker: SpeechChunker, audio: Float32Array) {
  for (let i = 0; i < audio.length; i += 4096) chunker.push(audio.subarray(i, i + 4096));
}

describe('Whisper Speech Chunking Pipeline', () => {
  it('resamples to the requested rate', () => {
    const out = resample(tone(1), RATE, WHISPER_SAMPLE_RATE);
    expect(out.length).toBe(WHISPER_SAMPLE_RATE);
  });

  it('cuts one chunk per phrase at pauses, with capture-relative start times', () => {
    const chunks: SpeechChunk[] = [];
    const chunker = new SpeechChunker(RATE, (c) => chunks.push(c));
    feed(chunker, silence(1));
    feed(chunker, tone(2));
    feed(chunker, silence(1.2));
    feed(chunker, tone(1.5));
    feed(chunker, silence(1.2));

    expect(chunks).toHaveLength(2);
    expect(chunks[0].startSeconds).toBeGreaterThanOrEqual(0);
    expect(chunks[1].startSeconds).toBeGreaterThan(3);
    expect(chunks[1].startSeconds).toBeLessThan(4.3);
    // Output is 16 kHz mono
    expect(chunks[0].audio.length).toBeLessThan(4 * WHISPER_SAMPLE_RATE);
  });

  it('never emits pure silence', () => {
    const chunks: SpeechChunk[] = [];
    const chunker = new SpeechChunker(RATE, (c) => chunks.push(c));
    feed(chunker, silence(40));
    chunker.flush();
    expect(chunks).toHaveLength(0);
  });

  it('forces long uninterrupted speech out at the maximum chunk length', () => {
    const chunks: SpeechChunk[] = [];
    const chunker = new SpeechChunker(RATE, (c) => chunks.push(c), { maxChunkSeconds: 10 });
    feed(chunker, tone(25));
    chunker.flush();
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) expect(c.audio.length).toBeLessThanOrEqual(10.2 * WHISPER_SAMPLE_RATE);
  });

  it('flushes buffered speech when capture stops mid-phrase', () => {
    const chunks: SpeechChunk[] = [];
    const chunker = new SpeechChunker(RATE, (c) => chunks.push(c));
    feed(chunker, tone(1.5));
    expect(chunks).toHaveLength(0);
    chunker.flush();
    expect(chunks).toHaveLength(1);
  });

  it('merges queued chunks into one batch and maps times back to each chunk', () => {
    const mk = (seconds: number, startSeconds: number, speaker: string) => ({
      audio: new Float32Array(seconds * WHISPER_SAMPLE_RATE),
      startSeconds,
      meta: { speaker },
    });
    const queue = [mk(4, 10, 'A'), mk(3, 20, 'B'), mk(20, 30, 'C')];
    const batch = takeChunkBatch(queue, 25);

    // The 20 s chunk would exceed the limit, so it stays queued
    expect(batch.parts).toHaveLength(2);
    expect(queue).toHaveLength(1);
    expect(batch.audio.length).toBe(7 * WHISPER_SAMPLE_RATE);

    expect(locateInBatch(batch, 1)).toEqual({ captureSeconds: 11, meta: { speaker: 'A' } });
    expect(locateInBatch(batch, 5)).toEqual({ captureSeconds: 21, meta: { speaker: 'B' } });
  });

  it('always takes at least one chunk even if it exceeds the batch limit', () => {
    const queue = [{ audio: new Float32Array(30 * WHISPER_SAMPLE_RATE), startSeconds: 0, meta: null }];
    expect(takeChunkBatch(queue, 25).parts).toHaveLength(1);
    expect(queue).toHaveLength(0);
  });

  it('filters Whisper non-speech output and maps language tags', () => {
    expect(isNonSpeech('[BLANK_AUDIO]')).toBe(true);
    expect(isNonSpeech(' (music) ')).toBe(true);
    expect(isNonSpeech(' . ')).toBe(true);
    expect(isNonSpeech('Good morning everyone.')).toBe(false);
    expect(toWhisperLanguage('auto')).toBeUndefined();
    expect(toWhisperLanguage('fr-FR')).toBe('fr');
    expect(toWhisperLanguage('ja')).toBe('ja');
  });
});
