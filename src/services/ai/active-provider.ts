import type { AICompletionOptions } from './provider';
import type { AIChatMessage } from '../../types';
import { ollama } from './ollama';
import { claude } from './claude';

/**
 * Routes AI requests to the provider chosen in Settings (local Ollama or
 * Claude). Feature code calls `ai.*` and does not need to know which one runs.
 */

export type AIProviderId = 'ollama' | 'claude';

let activeProvider: AIProviderId = 'ollama';

export function setActiveProvider(provider: AIProviderId): void {
  activeProvider = provider;
}

export function getActiveProvider(): AIProviderId {
  return activeProvider;
}

const current = () => (activeProvider === 'claude' ? claude : ollama);

export const ai = {
  generate: (prompt: string, options?: AICompletionOptions) => current().generate(prompt, options),
  streamGenerate: (prompt: string, onChunk: (chunk: string) => void, options?: AICompletionOptions) =>
    current().streamGenerate(prompt, onChunk, options),
  chat: (messages: AIChatMessage[], onChunk: (chunk: string) => void, options?: AICompletionOptions) =>
    current().chat(messages, onChunk, options),
};
