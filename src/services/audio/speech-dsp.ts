/** Conservative preprocessing for recognition only; recorded audio stays untouched. */
export class SpeechHighPass {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private readonly b0: number;
  private readonly b1: number;
  private readonly b2: number;
  private readonly a1: number;
  private readonly a2: number;

  constructor(sampleRate: number) {
    // Second-order Butterworth high-pass at 70 Hz: remove DC/rumble without
    // an aggressive telephone-band cutoff that would remove voice fundamentals.
    const w = 2 * Math.PI * 70 / sampleRate;
    const c = Math.cos(w);
    const alpha = Math.sin(w) / Math.SQRT2;
    const a0 = 1 + alpha;
    this.b0 = (1 + c) / (2 * a0);
    this.b1 = -(1 + c) / a0;
    this.b2 = this.b0;
    this.a1 = -2 * c / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(input: Float32Array): Float32Array {
    const out = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const x = Number.isFinite(input[i]) ? input[i] : 0;
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
        - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;
      out[i] = y;
    }
    return out;
  }
}

/** Normalize accepted speech, never the detector input. Constant gain avoids
 * pumping within a phrase. Cap amplification at 12 dB and leave peak headroom. */
export function normalizeSpeech(input: Float32Array): Float32Array {
  let peak = 0;
  let sum = 0;
  for (const sample of input) {
    peak = Math.max(peak, Math.abs(sample));
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / Math.max(1, input.length));
  if (!Number.isFinite(rms) || rms < 0.003 || peak === 0) return input;
  const gain = Math.min(4, 0.1 / rms, 0.95 / peak);
  return input.map((sample) => sample * gain);
}
