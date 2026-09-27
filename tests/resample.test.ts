import { describe, it, expect } from 'vitest';
import { resample } from '../src/services/audio/pcm-capture';

const tone = (freq: number, rate: number, seconds = 1) => {
  const x = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * freq * i) / rate);
  return x;
};

// RMS in dB relative to a full-scale sine, ignoring the chunk edges
const levelDb = (x: Float32Array) => {
  const inner = x.subarray(200, x.length - 200);
  const rms = Math.sqrt(inner.reduce((s, v) => s + v * v, 0) / inner.length);
  return 20 * Math.log10(Math.max(1e-9, rms / Math.SQRT1_2));
};

describe('resample (mic audio to 16 kHz for speech models)', () => {
  it.each([48000, 44100])('keeps the speech band intact from %i Hz', (rate) => {
    for (const freq of [300, 1000, 3000, 5000, 6000]) {
      expect(Math.abs(levelDb(resample(tone(freq, rate), rate, 16000)))).toBeLessThan(0.1);
    }
  });

  it.each([48000, 44100])('removes content above 8 kHz from %i Hz instead of folding it into speech', (rate) => {
    for (const freq of [9000, 12000, 20000]) {
      expect(levelDb(resample(tone(freq, rate), rate, 16000))).toBeLessThan(-60);
    }
  });

  it('returns the expected length and passes through when rates match', () => {
    const x = tone(1000, 48000, 0.5);
    expect(resample(x, 48000, 16000).length).toBe(8000);
    expect(resample(x, 16000, 16000)).toBe(x);
  });
});
