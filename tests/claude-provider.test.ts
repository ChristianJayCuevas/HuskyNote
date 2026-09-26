import { describe, it, expect, vi, beforeEach } from 'vitest';

const streamCalls: any[] = [];
let nextStopReason = 'end_turn';

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number;
  }
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = class extends APIError {};
    static NotFoundError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static APIConnectionError = class extends APIError {};
    models = { retrieve: vi.fn(async () => ({ id: 'claude-opus-5' })) };
    beta = {
      messages: {
        stream: (params: any) => {
          streamCalls.push(params);
          const handlers: Record<string, (d: string) => void> = {};
          return {
            on: (event: string, fn: (d: string) => void) => {
              handlers[event] = fn;
            },
            finalMessage: async () => {
              handlers.text?.('Hello ');
              handlers.text?.('there');
              return {
                stop_reason: nextStopReason,
                content: [{ type: 'text', text: 'Hello there' }],
              };
            },
          };
        },
      },
    };
  }
  return { default: Anthropic };
});

import { ClaudeProvider, DEFAULT_CLAUDE_MODEL } from '../src/services/ai/claude';

describe('Claude AI Provider', () => {
  beforeEach(() => {
    streamCalls.length = 0;
    nextStopReason = 'end_turn';
  });

  it('requires an API key before sending requests', async () => {
    const provider = new ClaudeProvider();
    expect(provider.hasApiKey()).toBe(false);
    await expect(provider.generate('hi')).rejects.toThrow(/API key/);
  });

  it('streams text, defaults to Claude Opus 5, and enables refusal fallbacks', async () => {
    const provider = new ClaudeProvider();
    provider.setApiKey('sk-ant-test');
    const chunks: string[] = [];
    const text = await provider.streamGenerate('Summarize', (c) => chunks.push(c), { systemPrompt: 'Be brief.' });

    expect(text).toBe('Hello there');
    expect(chunks).toEqual(['Hello ', 'there']);
    expect(streamCalls[0].model).toBe(DEFAULT_CLAUDE_MODEL);
    expect(streamCalls[0].system).toBe('Be brief.');
    expect(streamCalls[0].fallbacks).toBe('default');
    expect(streamCalls[0].betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(streamCalls[0].temperature).toBeUndefined();
  });

  it('does not send fallbacks for models without server-side fallback routing', async () => {
    const provider = new ClaudeProvider();
    provider.setApiKey('sk-ant-test');
    await provider.generate('Hi', { model: 'claude-haiku-4-5' });
    expect(streamCalls[0].model).toBe('claude-haiku-4-5');
    expect(streamCalls[0].fallbacks).toBeUndefined();
  });

  it('moves system chat messages into the system prompt and keeps turn order', async () => {
    const provider = new ClaudeProvider();
    provider.setApiKey('sk-ant-test');
    await provider.chat(
      [
        { id: '1', role: 'system', content: 'Context: meeting notes' },
        { id: '2', role: 'user', content: 'What was decided?' },
        { id: '3', role: 'assistant', content: 'Ship on Friday.' },
        { id: '4', role: 'user', content: 'Who owns it?' },
      ],
      () => {}
    );
    expect(streamCalls[0].system).toBe('Context: meeting notes');
    expect(streamCalls[0].messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('reports a refusal instead of returning empty text', async () => {
    const provider = new ClaudeProvider();
    provider.setApiKey('sk-ant-test');
    nextStopReason = 'refusal';
    await expect(provider.generate('Hi')).rejects.toThrow(/declined/);
  });
});
