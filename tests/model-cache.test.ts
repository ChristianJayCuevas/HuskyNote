import { describe, it, expect } from 'vitest';
import { completeModelDevices } from '../src/services/audio/model-cache';
import { getTranscriptionEngine } from '../src/services/audio/transcription-engines';

describe('model cache completeness', () => {
  it('does not label a partial transformer download ready', () => {
    const model = getTranscriptionEngine('whisper-base');
    const files = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json', 'onnx/encoder_model_quantized.onnx'];
    expect(completeModelDevices(model, files)).toEqual([]);
    files.push('onnx/decoder_model_merged_quantized.onnx');
    expect(completeModelDevices(model, files)).toEqual(['wasm']);
    files.push('onnx/encoder_model.onnx', 'onnx/decoder_model_merged_q4.onnx');
    expect(completeModelDevices(model, files)).toEqual(['webgpu', 'wasm']);
  });
  it('requires the shared decoder, vocabulary and preprocessor for Parakeet', () => {
    const model = getTranscriptionEngine('parakeet-v3');
    const files = ['encoder-model.fp16.onnx', 'decoder_joint-model.int8.onnx'];
    expect(completeModelDevices(model, files)).toEqual([]);
    files.push('vocab.txt', 'nemo128.onnx');
    expect(completeModelDevices(model, files)).toEqual(['webgpu']);
    files.push('encoder-model.int8.onnx');
    expect(completeModelDevices(model, files)).toEqual(['webgpu', 'wasm']);
  });
});
