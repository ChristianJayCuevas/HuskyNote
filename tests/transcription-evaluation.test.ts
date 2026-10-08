import { describe, it, expect } from 'vitest';
import { wordErrorRate } from '../src/services/audio/transcription-evaluation';
import { TAP_WORKLET } from '../src/services/audio/pcm-capture';

describe('transcription evaluation', () => {
  it('scores mixed-language edits without treating punctuation as words', () => {
    expect(wordErrorRate('I-send natin ang report bukas.', 'I send natin ang report bukas')).toEqual({ errors: 0, words: 6, rate: 0 });
    expect(wordErrorRate('meeting natin bukas', 'meeting natin ngayon')).toEqual({ errors: 1, words: 3, rate: 1 / 3 });
    expect(wordErrorRate('', 'invented speech')).toEqual({ errors: 2, words: 0, rate: null });
  });

  it('flushes the last partial worklet block before acknowledging stop', () => {
    const sent: unknown[] = [];
    class Processor { port = { onmessage: null as null | ((e: { data: string }) => void), postMessage: (data: unknown) => sent.push(data) }; }
    let ProcessorType: any;
    new Function('AudioWorkletProcessor', 'registerProcessor', TAP_WORKLET)(Processor, (_name: string, type: any) => { ProcessorType = type; });
    const processor = new ProcessorType();
    processor.process([[new Float32Array(128).fill(0.5)]]);
    expect(sent).toHaveLength(0);
    processor.port.onmessage({ data: 'stop' });
    expect(sent[0]).toEqual(new Float32Array(128).fill(0.5));
    expect(sent[1]).toEqual({ type: 'flushed' });
    expect(processor.process([[new Float32Array(128)]])).toBe(false);
  });
});
