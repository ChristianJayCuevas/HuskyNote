/**
 * Decode the audio of a recording file (a Teams/Zoom video, or any audio file)
 * into 16 kHz mono for speech recognition.
 *
 * MP4-family files (.mp4, .m4a, .mov, .m4v) are read in 8 MB slices and only
 * their audio track is decoded with WebCodecs, so an hour-long video never has
 * to sit in memory whole. Other formats, or browsers without WebCodecs, use
 * decodeAudioData on the whole file, which suits audio-only files.
 */
import { resample, WHISPER_SAMPLE_RATE } from './pcm-capture';
import { SpeechHighPass } from './speech-dsp';

export interface DecodedMedia {
  /** 16 kHz mono samples */
  audio: Float32Array;
  durationSeconds: number;
}

export type DecodeProgress = (fraction: number) => void;

const READ_SLICE_BYTES = 8 * 1024 * 1024;
/** decodeAudioData needs the whole file in memory: refuse files that would not fit comfortably */
const WHOLE_FILE_LIMIT_BYTES = 600 * 1024 * 1024;
/** Resample in blocks this long so block edges are rare and the sinc kernel has room */
const RESAMPLE_BLOCK_SECONDS = 10;

const isMp4Family = (file: File) => /\.(mp4|m4a|m4v|mov|3gp)$/i.test(file.name) || /^(video|audio)\/(mp4|quicktime|x-m4a)/.test(file.type);

/** Gathers decoded audio at the source rate, filters it like the live recorder, and resamples to 16 kHz */
class MonoCollector {
  private pending: Float32Array[] = [];
  private pendingLength = 0;
  private readonly out: Float32Array[] = [];
  private outLength = 0;
  private readonly highPass: SpeechHighPass;

  constructor(private readonly sampleRate: number) {
    this.highPass = new SpeechHighPass(sampleRate);
  }

  push(mono: Float32Array): void {
    this.pending.push(this.highPass.process(mono));
    this.pendingLength += mono.length;
    if (this.pendingLength >= this.sampleRate * RESAMPLE_BLOCK_SECONDS) this.drain();
  }

  private drain(): void {
    if (!this.pendingLength) return;
    const block = new Float32Array(this.pendingLength);
    let offset = 0;
    for (const part of this.pending) { block.set(part, offset); offset += part.length; }
    this.pending = [];
    this.pendingLength = 0;
    const resampled = resample(block, this.sampleRate, WHISPER_SAMPLE_RATE);
    this.out.push(resampled);
    this.outLength += resampled.length;
  }

  finish(): Float32Array {
    this.drain();
    const audio = new Float32Array(this.outLength);
    let offset = 0;
    for (const part of this.out) { audio.set(part, offset); offset += part.length; }
    return audio;
  }
}

const downmix = (channels: Float32Array[]): Float32Array => {
  if (channels.length === 1) return channels[0];
  const mono = new Float32Array(channels[0].length);
  for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
  return mono;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Import cancelled.', 'AbortError');
};

/** Decode with decodeAudioData (whole file in memory) */
async function decodeWholeFile(file: File, onProgress?: DecodeProgress, signal?: AbortSignal): Promise<DecodedMedia> {
  if (file.size > WHOLE_FILE_LIMIT_BYTES) {
    throw new Error('This file is too large to decode in one piece. For long Teams recordings use the .mp4 video, which HuskyNote reads in slices.');
  }
  onProgress?.(0.05);
  const bytes = await file.arrayBuffer();
  throwIfAborted(signal);
  onProgress?.(0.3);
  const context = new OfflineAudioContext(1, 1, WHISPER_SAMPLE_RATE);
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(bytes);
  } catch {
    throw new Error('This file has no audio HuskyNote can read. Try the .mp4 or an .m4a, .mp3 or .wav file.');
  }
  throwIfAborted(signal);
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c));
  // decodeAudioData already resampled to the context's 16 kHz; filter like live audio
  const audio = new SpeechHighPass(decoded.sampleRate).process(downmix(channels));
  onProgress?.(1);
  return { audio, durationSeconds: decoded.duration };
}

/** Decode only the audio track of an MP4-family file, reading it in slices */
async function decodeMp4Audio(file: File, onProgress?: DecodeProgress, signal?: AbortSignal): Promise<DecodedMedia> {
  const { createFile, MP4BoxBuffer } = await import('mp4box');
  const mp4 = createFile();

  interface AudioTrackInfo { id: number; codec: string; sampleRate: number; channels: number; timescale: number; description?: Uint8Array; durationSeconds: number }
  type Mp4Sample = { data?: Uint8Array; is_sync: boolean; cts: number; duration: number; timescale: number; number: number };
  let track: AudioTrackInfo | null = null;
  let readError: Error | null = null;
  let decoder: AudioDecoder | null = null;
  let collector: MonoCollector | null = null;
  let decodeError: Error | null = null;
  let decodedSeconds = 0;
  // Samples that arrive before the decoder is configured (configuring is async)
  const waiting: Mp4Sample[] = [];

  const decodeSample = (sample: Mp4Sample) => {
    const timescale = sample.timescale || track!.timescale;
    decoder!.decode(new EncodedAudioChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (1e6 * sample.cts) / timescale,
      duration: (1e6 * sample.duration) / timescale,
      data: sample.data!,
    }));
  };

  mp4.onError = (_module: string, message: string) => { readError = new Error(`Could not read this video: ${message}`); };
  mp4.onReady = (info) => {
    const audioTrack = info.audioTracks[0];
    if (!audioTrack?.audio) { readError = new Error('This video has no audio track.'); return; }
    // AAC needs its AudioSpecificConfig from the esds box as the decoder description
    const entry = mp4.getTrackById(audioTrack.id)?.mdia?.minf?.stbl?.stsd?.entries?.[0] as { esds?: { esd?: { descs?: { descs?: { data?: Uint8Array }[] }[] } } } | undefined;
    track = {
      id: audioTrack.id,
      codec: audioTrack.codec,
      sampleRate: audioTrack.audio.sample_rate,
      channels: audioTrack.audio.channel_count,
      timescale: audioTrack.timescale,
      description: entry?.esds?.esd?.descs?.[0]?.descs?.[0]?.data,
      durationSeconds: audioTrack.duration / audioTrack.timescale || info.duration / info.timescale,
    };
    // Extraction has to start here, inside onReady, for samples already appended to flow
    mp4.setExtractionOptions(audioTrack.id, undefined, { nbSamples: 1000 });
    mp4.start();
  };
  mp4.onSamples = (id, _user, samples) => {
    for (const sample of samples as unknown as Mp4Sample[]) {
      if (!sample.data) continue;
      if (decoder) decodeSample(sample);
      else waiting.push(sample);
    }
    // Decoded chunks hold their own copy, so mp4box can drop its buffers
    if (decoder && samples.length) mp4.releaseUsedSamples(id, samples[samples.length - 1].number);
  };

  const setUpDecoder = async (info: AudioTrackInfo) => {
    const config: AudioDecoderConfig = { codec: info.codec, sampleRate: info.sampleRate, numberOfChannels: info.channels, description: info.description };
    const support = await AudioDecoder.isConfigSupported(config).catch(() => ({ supported: false }));
    if (!support.supported) throw new Error(`UNSUPPORTED_CODEC:${info.codec}`);
    const output = new MonoCollector(info.sampleRate);
    collector = output;
    decoder = new AudioDecoder({
      output: (data) => {
        const channels = Array.from({ length: data.numberOfChannels }, (_, plane) => {
          const channel = new Float32Array(data.numberOfFrames);
          data.copyTo(channel, { planeIndex: plane, format: 'f32-planar' });
          return channel;
        });
        output.push(downmix(channels));
        decodedSeconds += data.numberOfFrames / data.sampleRate;
        data.close();
      },
      error: (error) => { decodeError = error instanceof Error ? error : new Error(String(error)); },
    });
    decoder.configure(config);
    for (const sample of waiting.splice(0)) decodeSample(sample);
  };

  let offset = 0;
  while (offset < file.size) {
    throwIfAborted(signal);
    if (readError) throw readError;
    if (decodeError) throw decodeError;
    const slice = await file.slice(offset, offset + READ_SLICE_BYTES).arrayBuffer();
    const isLast = offset + slice.byteLength >= file.size;
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(slice, offset), isLast);
    offset = Math.max(offset + slice.byteLength, typeof next === 'number' ? next : 0);
    if (track && !decoder) await setUpDecoder(track);
    // Keep the decoder from queuing the whole file
    while (decoder && (decoder as AudioDecoder).decodeQueueSize > 400) await new Promise((r) => setTimeout(r, 5));
    const total = (track as AudioTrackInfo | null)?.durationSeconds;
    onProgress?.(Math.min(0.99, total ? decodedSeconds / total : offset / file.size));
  }
  mp4.flush();
  if (readError) throw readError;
  if (!track) throw new Error('Could not find the audio in this video.');
  if (!decoder) await setUpDecoder(track);
  await (decoder as unknown as AudioDecoder).flush();
  (decoder as unknown as AudioDecoder).close();
  if (decodeError) throw decodeError;
  const audio = (collector as MonoCollector | null)?.finish() ?? new Float32Array(0);
  onProgress?.(1);
  return { audio, durationSeconds: audio.length / WHISPER_SAMPLE_RATE };
}

/** Decode any supported recording to 16 kHz mono */
export async function decodeMediaFile(file: File, onProgress?: DecodeProgress, signal?: AbortSignal): Promise<DecodedMedia> {
  if (isMp4Family(file) && typeof AudioDecoder !== 'undefined') {
    try {
      return await decodeMp4Audio(file, onProgress, signal);
    } catch (error) {
      // Fall back for codecs WebCodecs cannot handle, when the file is small enough
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (!(error instanceof Error && error.message.startsWith('UNSUPPORTED_CODEC')) || file.size > WHOLE_FILE_LIMIT_BYTES) {
        throw error instanceof Error && error.message.startsWith('UNSUPPORTED_CODEC')
          ? new Error('This browser cannot decode the audio in this video.')
          : error;
      }
    }
  }
  return decodeWholeFile(file, onProgress, signal);
}
