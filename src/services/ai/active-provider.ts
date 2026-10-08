import type { AICompletionOptions } from './provider';
import type { AIChatMessage } from '../../types';
import { ollama } from './ollama';
import { claude } from './claude';
import { codex } from './codex';
import { claudeSubscription } from './claude-subscription';

/**
 * Routes AI requests to the provider chosen in Settings (local Ollama,
 * Claude API, Claude subscription, or ChatGPT through Codex). Feature code calls `ai.*` and does not
 * need to know which one runs.
 */

export type AIProviderId = 'ollama' | 'claude' | 'codex' | 'claude-subscription';

/** Short names for status lines and buttons */
export const PROVIDER_NAMES: Record<AIProviderId, string> = { ollama: 'Ollama', claude: 'Claude API', codex: 'Codex', 'claude-subscription': 'Claude Subscription' };

/** Who receives the text a provider answers about; null when it stays on this computer */
export const PROVIDER_RECIPIENTS: Record<AIProviderId, string | null> = {
  ollama: null,
  claude: 'Claude (Anthropic)',
  codex: 'ChatGPT (OpenAI) through Codex',
  'claude-subscription': 'Claude (Anthropic) through Claude Code',
};

let activeProvider: AIProviderId = 'ollama';

export function setActiveProvider(provider: AIProviderId): void {
  activeProvider = provider;
}

export function getActiveProvider(): AIProviderId {
  return activeProvider;
}

const current = () => (activeProvider === 'claude' ? claude : activeProvider === 'codex' ? codex : activeProvider === 'claude-subscription' ? claudeSubscription : ollama);

export const ai = {
  generate: (prompt: string, options?: AICompletionOptions) => current().generate(prompt, options),
  streamGenerate: (prompt: string, onChunk: (chunk: string) => void, options?: AICompletionOptions) =>
    current().streamGenerate(prompt, onChunk, options),
  chat: (messages: AIChatMessage[], onChunk: (chunk: string) => void, options?: AICompletionOptions) =>
    current().chat(messages, onChunk, options),
};
