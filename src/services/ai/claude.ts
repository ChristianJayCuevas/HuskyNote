import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AICompletionOptions } from './provider';
import type { OllamaModel, AIChatMessage } from '../../types';

/**
 * Claude (Anthropic API) provider. The user brings their own API key from
 * platform.claude.com; requests go from this device straight to the
 * Anthropic API, so the key never passes through any other server.
 */

export interface ClaudeModelOption {
  id: string;
  name: string;
  description: string;
}

export const CLAUDE_MODELS: ClaudeModelOption[] = [
  { id: 'claude-opus-5', name: 'Claude Opus 5', description: 'Most capable. Best meeting summaries and document analysis.' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', description: 'Faster and lower cost, strong for everyday notes.' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fastest and lowest cost, for quick edits and short answers.' },
];

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

// Models that support server-side refusal fallbacks ("default" routing)
const FALLBACK_MODELS = new Set(['claude-opus-5']);

/** Turn SDK errors into messages a user can act on */
export function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Claude rejected the API key. Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to the selected Claude model.';
  if (err instanceof Anthropic.NotFoundError) return 'The selected Claude model was not found for this API key.';
  if (err instanceof Anthropic.RateLimitError) return 'Claude rate limit reached. Wait a moment and try again.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Claude API. Check your internet connection.';
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? 'unknown'}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

export class ClaudeProvider implements AIProvider {
  name = 'Claude';
  private client: Anthropic | null = null;

  setApiKey(apiKey: string): void {
    const key = apiKey.trim();
    this.client = key ? new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }) : null;
  }

  hasApiKey(): boolean {
    return this.client !== null;
  }

  private requireClient(): Anthropic {
    if (!this.client) throw new Error('Add your Claude API key in Settings to use Claude.');
    return this.client;
  }

  /** Validates the key with a lightweight model lookup (no tokens used). */
  async isAvailable(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.models.retrieve(DEFAULT_CLAUDE_MODEL);
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<OllamaModel[]> {
    return CLAUDE_MODELS.map((m) => ({
      name: m.id,
      model: m.id,
      size: 0,
      modified_at: '',
      details: { family: 'claude', parameter_size: m.name },
    }));
  }

  /** Streams every request so long outputs never hit HTTP timeouts. */
  private async run(
    messages: Anthropic.Beta.BetaMessageParam[],
    options: AICompletionOptions | undefined,
    onChunk?: (chunk: string) => void,
    system?: string
  ): Promise<string> {
    const client = this.requireClient();
    const model = options?.model || DEFAULT_CLAUDE_MODEL;
    const systemPrompt = [system, options?.systemPrompt].filter(Boolean).join('\n\n') || undefined;

    try {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 64000,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages,
        ...(FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      });
      if (onChunk) stream.on('text', (delta) => onChunk(delta));
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new Error('Claude declined to answer this request.');
      }
      return message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
    } catch (err) {
      throw new Error(describeClaudeError(err));
    }
  }

  generate(prompt: string, options?: AICompletionOptions): Promise<string> {
    return this.run([{ role: 'user', content: prompt }], options);
  }

  streamGenerate(prompt: string, onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    return this.run([{ role: 'user', content: prompt }], options, onChunk);
  }

  chat(messages: AIChatMessage[], onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const turns: Anthropic.Beta.BetaMessageParam[] = messages
      .filter((m) => m.role !== 'system' && m.content.trim())
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return this.run(turns, options, onChunk, system || undefined);
  }
}

export const claude = new ClaudeProvider();
