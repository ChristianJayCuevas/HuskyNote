// Web Audio API tactile sound synthesizer for HuskyNote
// Generates mechanical keyboard switch "thocks", clicks, pops, and chimes on-the-fly.
// Zero network latency, works 100% offline, cross-platform.

class SoundFXService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.35; // Default subtle tactile volume

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMuted = localStorage.getItem('huskynote_sound_muted');
      if (savedMuted !== null) {
        this.isMuted = savedMuted === 'true';
      }
      const savedVolume = localStorage.getItem('huskynote_sound_volume');
      if (savedVolume !== null) {
        const parsed = parseFloat(savedVolume);
        if (!isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
      }
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setIsMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('huskynote_sound_muted', String(muted));
    }
  }

  public toggleMute(): boolean {
    this.setIsMuted(!this.isMuted);
    if (!this.isMuted) {
      this.thock();
    }
    return this.isMuted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('huskynote_sound_volume', String(this.volume));
    }
  }

  // The signature mechanical keyboard "thock"
  // Punchy low-frequency resonance + subtle tactile bandpass click
  public thock(pitchMultiplier: number = 1.0) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume, now);
      masterGain.connect(ctx.destination);

      // 1. Low frequency bottom-out body (Sine pitch drop ~140Hz -> ~45Hz)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 * pitchMultiplier, now);
      osc.frequency.exponentialRampToValueAtTime(45 * pitchMultiplier, now + 0.045);

      oscGain.gain.setValueAtTime(0.7, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.05);

      // 2. High-frequency stem click transient (filtered noise buffer)
      const bufferSize = Math.floor(ctx.sampleRate * 0.012); // 12ms noise
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1600 * pitchMultiplier, now);
      bandpass.Q.setValueAtTime(3.5, now);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

      whiteNoise.connect(bandpass);
      bandpass.connect(clickGain);
      clickGain.connect(masterGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.015);
    } catch {
      // AudioContext could be blocked by browser policy until interaction
    }
  }

  // Crisp mechanical click for button presses and active states
  public click() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);

      gain.gain.setValueAtTime(this.volume * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.02);
    } catch {}
  }

  // Soft pop for tabs, selector pills, and dropdowns
  public pop() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.03);

      gain.gain.setValueAtTime(this.volume * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {}
  }

  // Two-tone harmonic chime for save success, milestone reached, or export
  public chime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [
        { freq: 587.33, delay: 0 }, // D5
        { freq: 880.0, delay: 0.07 }, // A5
      ].forEach(({ freq, delay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(this.volume * 0.35, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.25);
      });
    } catch {}
  }

  // Toggle switch sound
  public switch(on: boolean) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (on) {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.035);
      } else {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
      }

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {}
  }
}

export const soundFX = new SoundFXService();
