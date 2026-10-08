import { describe, it, expect } from 'vitest';
import { SpeechHighPass, normalizeSpeech } from '../src/services/audio/speech-dsp';
import { SpeechChunker, type SpeechChunk } from '../src/services/audio/pcm-capture';

const tone = (rate: number, hz: number, amplitude = 0.2) =>
  Float32Array.from({ length: rate }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / rate));
const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('recognition DSP', () => {
  it.each([16000, 44100, 48000])('rejects rumble while retaining speech at %i Hz', (rate) => {
    const low = tone(rate, 20);
    const voice = tone(rate, 300);
    const filteredLow = new SpeechHighPass(rate).process(low).subarray(1000);
    const filteredVoice = new SpeechHighPass(rate).process(voice).subarray(1000);
    expect(rms(filteredLow) / rms(low.subarray(1000))).toBeLessThan(0.1);
    expect(rms(filteredVoice) / rms(voice.subarray(1000))).toBeGreaterThan(0.99);
  });

  it('retains filter state across blocks and does not mutate the source', () => {
    const input = tone(48000, 220);
    const original = input.slice();
    const expected = new SpeechHighPass(48000).process(input);
    const filter = new SpeechHighPass(48000);
    const actual = new Float32Array(input.length);
    for (let i = 0; i < input.length; i += 4096) actual.set(filter.process(input.subarray(i, i + 4096)), i);
    expect(actual).toEqual(expected);
    expect(input).toEqual(original);
  });

  it('removes constant DC without generating speech chunks', () => {
    const chunks: SpeechChunk[] = [];
    const chunker = new SpeechChunker(48000, (c) => chunks.push(c));
    for (let i = 0; i < 200; i++) chunker.push(new Float32Array(4096).fill(0.15));
    chunker.flush();
    expect(chunks).toHaveLength(0);
  });

  it('boosts accepted quiet speech with a bounded gain and leaves silence/noise alone', () => {
    const input = tone(16000, 440, 0.02);
    const out = normalizeSpeech(input);
    expect(rms(out) / rms(input)).toBeCloseTo(4);
    const noise = tone(16000, 1000, 0.001);
    expect(normalizeSpeech(noise)).toBe(noise);
    const silence = new Float32Array(100);
    expect(normalizeSpeech(silence)).toBe(silence);
  });

  it('preserves length and keeps transient peaks below clipping', () => {
    const input = tone(16000, 440, 0.02);
    input[8000] = 0.9;
    const out = normalizeSpeech(input);
    expect(out.length).toBe(input.length);
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.951);
    expect(input[8000]).toBeCloseTo(0.9);
  });
});
