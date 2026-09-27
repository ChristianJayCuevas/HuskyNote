/**
 * On-device speech-to-text engines offered in Settings. Each runs in a web
 * worker; model weights download once and are cached on the device.
 */

export type EngineDtype = string | Record<string, string>;

interface EngineBase {
  id: string;
  name: string;
  description: string;
  /** ISO 639-1 codes the engine transcribes, or 'multilingual' */
  languages: string[] | 'multilingual';
  /** Approximate one-time download in MB, per device */
  downloadMb: { webgpu: number; wasm: number };
}

/** Engines run through transformers.js pipelines (Whisper, Moonshine) */
export interface TransformersEngine extends EngineBase {
  runtime: 'transformers';
  /** Hugging Face model repository */
  model: string;
  dtype: { webgpu: EngineDtype; wasm: EngineDtype };
  /** Model returns segment timestamps (Whisper) */
  timestamps: boolean;
}

/** NVIDIA Parakeet TDT through parakeet.js */
export interface ParakeetEngine extends EngineBase {
  runtime: 'parakeet';
  /** parakeet.js model key */
  model: string;
  /** Hugging Face repository parakeet.js downloads the model key from (names its cached files) */
  cacheRepo: string;
  quant: {
    webgpu: { encoderQuant: 'fp16' | 'fp32'; decoderQuant: 'int8' | 'fp32' };
    wasm: { encoderQuant: 'int8' | 'fp32'; decoderQuant: 'int8' | 'fp32' };
  };
}

export type TranscriptionEngine = TransformersEngine | ParakeetEngine;

// Parakeet TDT v3 covers these 25 European languages (NVIDIA model card)
const PARAKEET_V3_LANGUAGES = [
  'bg', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'el', 'hu', 'it',
  'lv', 'lt', 'mt', 'pl', 'pt', 'ro', 'sk', 'sl', 'es', 'sv', 'ru', 'uk',
];

export const TRANSCRIPTION_ENGINES: TranscriptionEngine[] = [
  {
    id: 'parakeet-v3',
    runtime: 'parakeet',
    name: 'Parakeet TDT v3',
    description: 'Fastest and most accurate. English and 24 other European languages.',
    model: 'parakeet-tdt-0.6b-v3',
    cacheRepo: 'ysdede/parakeet-tdt-0.6b-v3-onnx',
    languages: PARAKEET_V3_LANGUAGES,
    downloadMb: { webgpu: 1215, wasm: 640 },
    quant: {
      webgpu: { encoderQuant: 'fp16', decoderQuant: 'int8' },
      wasm: { encoderQuant: 'int8', decoderQuant: 'int8' },
    },
  },
  {
    id: 'moonshine-base',
    runtime: 'transformers',
    name: 'Moonshine Base',
    description: 'Light and quick, runs well without a GPU. English only.',
    model: 'onnx-community/moonshine-base-ONNX',
    languages: ['en'],
    downloadMb: { webgpu: 150, wasm: 120 },
    dtype: {
      webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
    },
    timestamps: false,
  },
  {
    id: 'whisper-base',
    runtime: 'transformers',
    name: 'Whisper Base',
    description: 'Multilingual, including Japanese and Chinese. Slower than the others.',
    model: 'Xenova/whisper-base',
    languages: 'multilingual',
    downloadMb: { webgpu: 206, wasm: 77 },
    dtype: { webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, wasm: 'q8' },
    timestamps: true,
  },
];

export const DEFAULT_TRANSCRIPTION_ENGINE = 'parakeet-v3';
/** Used whenever the chosen engine cannot handle the spoken language */
export const MULTILINGUAL_FALLBACK_ENGINE = 'whisper-base';

export function getTranscriptionEngine(id: string | undefined): TranscriptionEngine {
  return (
    TRANSCRIPTION_ENGINES.find((e) => e.id === id) ??
    TRANSCRIPTION_ENGINES.find((e) => e.id === DEFAULT_TRANSCRIPTION_ENGINE)!
  );
}

/** Whether an engine can transcribe the chosen spoken language ('auto' always passes). */
export function engineSupportsLanguage(engine: TranscriptionEngine, lang: string): boolean {
  if (engine.languages === 'multilingual' || !lang || lang === 'auto') return true;
  return engine.languages.includes(lang.split('-')[0].toLowerCase());
}

let preferredEngineId = DEFAULT_TRANSCRIPTION_ENGINE;

/** Set from Settings (and on startup from saved settings). */
export function setPreferredTranscriptionEngine(id: string): void {
  preferredEngineId = getTranscriptionEngine(id).id;
}

export function getPreferredTranscriptionEngine(): TranscriptionEngine {
  return getTranscriptionEngine(preferredEngineId);
}

/**
 * The engine to use for a session: the preferred one, unless it cannot
 * handle the spoken language, in which case the multilingual fallback.
 */
export function resolveTranscriptionEngine(lang: string): TranscriptionEngine {
  const preferred = getPreferredTranscriptionEngine();
  return engineSupportsLanguage(preferred, lang) ? preferred : getTranscriptionEngine(MULTILINGUAL_FALLBACK_ENGINE);
}
