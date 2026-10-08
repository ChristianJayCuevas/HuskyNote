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
import { db } from '../../db';
export const activeRecordingIds = new Set<string>();
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private ownsStream = true;
  private chunks: Blob[] = [];
  private animFrameId: number | null = null;
  private recordingId: string | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private sequence = 0;
  private writeError: Error | null = null;
  private stopping: Promise<Blob> | null = null;
  private onStorageError?: (error: Error) => void;
  private queuedWrites = 0;
  private meetingId: string | null = null;

  /**
   * Save each 1-second chunk to IndexedDB as it is recorded.
   * Pass the meeting id so the "was this recording deleted?" check is a cheap
   * primary-key read; scanning every meeting on each chunk got slower as
   * transcripts grew until the write queue backed up and recording stopped.
   */
  setPersistence(recordingId: string, onError: (error: Error) => void, meetingId?: string): void {
    this.recordingId = recordingId;
    this.onStorageError = onError;
    this.meetingId = meetingId ?? null;
  }

  /** True while the meeting that owns this recording still points at its audio */
  private async recordingStillLinked(recordingId: string): Promise<boolean> {
    if (this.meetingId) return (await db.meetings.get(this.meetingId))?.audioBlobId === recordingId;
    return (await db.meetings.filter((m) => m.audioBlobId === recordingId).count()) > 0;
  }

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
    this.sequence = 0; this.writeError = null; this.stopping = null;
    this.queuedWrites = 0;
    this.writeQueue = Promise.resolve();

    if (inputStream) {
      this.stream = inputStream;
      this.ownsStream = false;
    } else {
      // Request microphone permission explicitly, on the microphone chosen in the app
      this.stream = await openMicrophone({ echoCancellation: true, noiseSuppression: true });
      this.ownsStream = true;
    }

    try {
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

    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        if (this.recordingId) {
          // About a minute of audio (~1 MB) may wait for storage before we give up
          if (this.queuedWrites >= 60) {
            this.writeError = new Error('Audio storage cannot keep up. Recording stopped to limit memory use.');
            this.onStorageError?.(this.writeError);
            void this.stop().catch(() => {});
            return;
          }
          const recordingId = this.recordingId;
          const sequence = this.sequence++;
          this.queuedWrites++;
          this.writeQueue = this.writeQueue.then(async () => {
            if (this.writeError) return;
            // Checking every chunk is unnecessary; every 15 s still stops promptly after a delete
            if (sequence % 15 === 0 && !(await this.recordingStillLinked(recordingId))) throw new Error('Recording was deleted in another window.');
            await db.audioChunks.put({ id: `${recordingId}-${sequence}`, recordingId, sequence, data: e.data, createdAt: Date.now() });
          }).catch((error) => {
            this.writeError = error instanceof Error ? error : new Error(String(error));
            this.onStorageError?.(this.writeError);
            if (this.mediaRecorder?.state === 'recording') void this.stop().catch(() => {});
          }).finally(() => { this.queuedWrites--; });
        } else this.chunks.push(e.data);
      }
    };

    // Device loss can stop MediaRecorder without a UI Stop click.
    this.mediaRecorder.onstop = () => { void this.stop().catch(() => {}); };
    this.mediaRecorder.onerror = () => {
      this.onStorageError?.(new Error('Audio capture failed. Previously saved chunks remain in Recordings & storage.'));
      void this.stop().catch(() => {});
    };
    this.mediaRecorder.start(1000); // 1-second chunks
    if (this.recordingId) activeRecordingIds.add(this.recordingId);
    } catch (error) {
      if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      if (this.ownsStream) this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.source?.disconnect();
      this.analyser = null;
      if (this.audioContext?.state !== 'closed') await this.audioContext?.close().catch(() => {});
      this.audioContext = null;
      throw error;
    }
  }

  /**
   * Stop the active recording and return the captured audio as a Blob.
   * Cleans up the media stream, audio context, and animation frame.
   *
   * @returns A Blob containing the recorded audio data.
   */
  async stop(): Promise<Blob> {
    if (this.stopping) return this.stopping;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.stopping = new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }

      const finish = async () => {
        // Clean up tracks
        if (this.stream) {
          if (this.ownsStream) this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
          this.audioContext.close().catch(() => {});
          this.audioContext = null;
        }

        try {
          await this.writeQueue;
          const chunks = this.recordingId
            ? (await db.audioChunks.where('recordingId').equals(this.recordingId).sortBy('sequence')).map((c) => c.data)
            : this.chunks;
          // A storage hiccup mid-recording must not lose what was already saved:
          // finish with the saved chunks and only fail when nothing was kept.
          if (this.writeError && chunks.length === 0) throw this.writeError;
          const audioBlob = new Blob(chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          if (this.recordingId) {
            const id = this.recordingId;
            if (!(await this.recordingStillLinked(id))) throw new Error('Recording was deleted before it finished.');
            await db.transaction('rw', db.blobs, db.audioChunks, async () => {
              await db.blobs.put({ id, data: audioBlob, mimeType: audioBlob.type, createdAt: Date.now() });
              await db.audioChunks.where('recordingId').equals(id).delete();
            });
          }
          this.chunks = [];
          resolve(audioBlob);
        } catch (error) { reject(error); }
        finally { if (this.recordingId) activeRecordingIds.delete(this.recordingId); }
      };
      this.mediaRecorder.onstop = () => { void finish(); };
      if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
      else void finish();
    });
    return this.stopping;
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
    return '';
  }
}
