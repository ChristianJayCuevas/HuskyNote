import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRANSCRIPTION_ENGINES,
  DEFAULT_TRANSCRIPTION_ENGINE,
  MULTILINGUAL_FALLBACK_ENGINE,
  engineSupportsLanguage,
  getTranscriptionEngine,
  resolveTranscriptionEngine,
  setPreferredTranscriptionEngine,
  recommendTranscriptionEngine,
} from '../src/services/audio/transcription-engines';
import { wordsToSentences } from '../src/services/audio/asr-protocol';
import { toWhisperLanguage } from '../src/services/audio/speech-engine';

describe('Transcription Engine Selection', () => {
  beforeEach(() => setPreferredTranscriptionEngine(DEFAULT_TRANSCRIPTION_ENGINE));

  it('defaults to Parakeet and falls back to the default for unknown ids', () => {
    expect(getTranscriptionEngine(undefined).id).toBe('parakeet-v3');
    expect(getTranscriptionEngine('no-such-engine').id).toBe('parakeet-v3');
  });

  it('uses the preferred engine when it supports the spoken language', () => {
    expect(resolveTranscriptionEngine('en-US').id).toBe('parakeet-v3');
    expect(resolveTranscriptionEngine('fr-FR').id).toBe('parakeet-v3');
    expect(resolveTranscriptionEngine('auto').id).toBe('whisper-base');
  });

  it('switches to the multilingual engine for languages the preferred one lacks', () => {
    expect(resolveTranscriptionEngine('ja-JP').id).toBe(MULTILINGUAL_FALLBACK_ENGINE);
    expect(resolveTranscriptionEngine('zh-CN').id).toBe(MULTILINGUAL_FALLBACK_ENGINE);
    setPreferredTranscriptionEngine('moonshine-base');
    expect(resolveTranscriptionEngine('en').id).toBe('moonshine-base');
    expect(resolveTranscriptionEngine('fr-FR').id).toBe(MULTILINGUAL_FALLBACK_ENGINE);
  });

  it('keeps the multilingual fallback able to handle every language', () => {
    const fallback = getTranscriptionEngine(MULTILINGUAL_FALLBACK_ENGINE);
    for (const lang of ['ja', 'zh', 'ko', 'fil']) expect(engineSupportsLanguage(fallback, lang)).toBe(true);
  });

  it('has unique engine ids', () => {
    const ids = TRANSCRIPTION_ENGINES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['fil', 'fil-PH', 'tl', 'tl-PH', 'FIL_ph', 'taglish'])('routes %s to local multilingual recognition', (language) => {
    expect(toWhisperLanguage(language)).toBe('tl');
    for (const preferred of ['parakeet-v3', 'moonshine-base']) {
      setPreferredTranscriptionEngine(preferred);
      expect(resolveTranscriptionEngine(language).id).toBe('whisper-base');
    }
  });

  it('favors compatible cached stable engines and never recommends experimental weights', () => {
    expect(recommendTranscriptionEngine('en-US').id).toBe('moonshine-base');
    expect(recommendTranscriptionEngine('en-US', ['parakeet-v3']).id).toBe('parakeet-v3');
    expect(recommendTranscriptionEngine('fil-PH', ['parakeet-v3', 'whisper-turbo']).id).toBe('whisper-base');
    expect(recommendTranscriptionEngine('auto', ['moonshine-base']).id).toBe('whisper-base');
    for (const engine of TRANSCRIPTION_ENGINES) expect(engine.revision).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe('Parakeet Word Grouping', () => {
  const w = (text: string, start_time: number, end_time: number) => ({ text, start_time, end_time });

  it('splits at sentence punctuation and keeps each sentence start time', () => {
    const sentences = wordsToSentences([
      w('Good', 0.1, 0.3), w('morning.', 0.35, 0.8),
      w('Let us', 1.0, 1.3), w('begin.', 1.35, 1.7),
    ]);
    expect(sentences).toEqual([
      { start: 0.1, text: 'Good morning.' },
      { start: 1.0, text: 'Let us begin.' },
    ]);
  });

  it('splits at long pauses even without punctuation', () => {
    const sentences = wordsToSentences([w('first', 0, 0.4), w('part', 0.5, 0.9), w('second', 2.5, 2.9)]);
    expect(sentences.map((s) => s.text)).toEqual(['first part', 'second']);
    expect(sentences[1].start).toBe(2.5);
  });

  it('ignores empty words', () => {
    expect(wordsToSentences([w(' ', 0, 0.1)])).toEqual([]);
  });
});
