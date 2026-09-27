/**
 * AudioRecorder captures microphone audio using the browser MediaRecorder API
 * and provides real-time audio level metering via the Web Audio AnalyserNode.
 *
 * Supported MIME types (with automatic fallback):
 * 1. `audio/webm;codecs=opus` (Chrome, Edge, Firefox)
 * 2. `audio/webm` (generic WebM)
 * 3. `audio/mp4` (Safari)
 * 4. `audio/ogg;codecs=opus` (Firefox fallback)
 *
 * Usage:
 * ```ts
 * const recorder = new AudioRecorder();
 * await recorder.start((level) => console.log('Audio level:', level));
 * // ... recording ...
 * const audioBlob = await recorder.stop();
 * ```
 */
import { openMicrophone } from './microphone';
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private ownsStream = true;
  private chunks: Blob[] = [];
  private animFrameId: number | null = null;

  /**
   * Start recording audio from the user's microphone.
   * Requests microphone permission, initializes the Web Audio analyser for
   * level metering, and begins MediaRecorder capture in 1-second chunks.
   *
   * @param onAudioLevel - Optional callback invoked per animation frame with
   *   the current audio input level (0–100).
   * @param inputStream - Record this stream (for example mixed tab + mic audio)
   *   instead of opening the microphone. The caller keeps ownership of it.
   * @throws Will throw if microphone access is denied by the user.
   */
  async start(onAudioLevel?: (level: number) => void, inputStream?: MediaStream): Promise<void> {
    this.chunks = [];

    if (inputStream) {
      this.stream = inputStream;
      this.ownsStream = false;
    } else {
      // Request microphone permission explicitly, on the microphone chosen in the app
      this.stream = await openMicrophone({ echoCancellation: true, noiseSuppression: true });
      this.ownsStream = true;
    }

    // Setup Web Audio Analyser for visualizer
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      if (onAudioLevel) {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          onAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          this.animFrameId = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      }
    }

    // Determine supported mime type with cross-browser fallback chain
    const mimeType = this.getSupportedMimeType();

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000); // 1-second chunks
  }

  /**
   * Stop the active recording and return the captured audio as a Blob.
   * Cleans up the media stream, audio context, and animation frame.
   *
   * @returns A Blob containing the recorded audio data.
   */
  async stop(): Promise<Blob> {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });

        // Clean up tracks
        if (this.stream) {
          if (this.ownsStream) this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
          this.audioContext.close().catch(() => {});
          this.audioContext = null;
        }

        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Enable or disable audio track transmission (mute/unmute).
   * @param muted - If true, audio tracks are disabled.
   */
  setMuted(muted: boolean): void {
    if (this.stream) {
      this.stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /** The stream being recorded, so a transcriber can listen to the same audio. */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Check whether the recorder is currently capturing audio.
   * @returns `true` if MediaRecorder state is 'recording'.
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Determine the best supported MIME type for audio recording
   * across Chrome, Firefox, Safari, and Edge.
   * @returns A supported MIME type string.
   */
  private getSupportedMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    // Final fallback — let the browser decide
    return 'audio/webm';
  }
}
