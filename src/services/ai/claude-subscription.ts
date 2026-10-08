import type { AIProvider, AICompletionOptions } from './provider';
import type { OllamaModel, AIChatMessage } from '../../types';
import { buildCodexPrompt, chatToCodexPrompt } from './codex';

export interface ClaudeSubscriptionModel { id: string; name: string; description: string }
export interface ClaudeSubscriptionStatus {
  reachable: boolean;
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  authMethod?: 'subscription' | 'apikey';
  models: ClaudeSubscriptionModel[];
  loginInProgress: boolean;
  loginUrl?: string;
  loginError?: string;
}
const UNREACHABLE: ClaudeSubscriptionStatus = { reachable: false, installed: false, loggedIn: false, models: [], loginInProgress: false };
const HEADERS = { 'X-HuskyNote': '1' };
export const isClaudeSubscriptionReady = (status: ClaudeSubscriptionStatus | null): boolean =>
  Boolean(status?.reachable && status.installed && status.loggedIn && status.authMethod === 'subscription');

/** Runs the official Claude Code CLI locally; the app never handles subscription tokens. */
export class ClaudeSubscriptionProvider implements AIProvider {
  name = 'Claude Subscription';

  async getStatus(): Promise<ClaudeSubscriptionStatus> {
    try {
      const res = await fetch('/api/claude-subscription/status', { headers: HEADERS, cache: 'no-store' });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return UNREACHABLE;
      return { ...UNREACHABLE, ...(await res.json()), reachable: true };
    } catch { return UNREACHABLE; }
  }
  async startLogin(): Promise<{ url?: string }> {
    const res = await fetch('/api/claude-subscription/login', {
      method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/json' }, body: '{}',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not start Claude sign-in.');
    return body;
  }
  async isAvailable(): Promise<boolean> { return isClaudeSubscriptionReady(await this.getStatus()); }
  async getModels(): Promise<OllamaModel[]> { return claudeSubscriptionModelsAsOptions((await this.getStatus()).models); }

  private async run(prompt: string, options?: AICompletionOptions, onChunk?: (chunk: string) => void, system?: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch('/api/claude-subscription/generate', {
        method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildCodexPrompt(prompt, [system, options?.systemPrompt].filter(Boolean).join('\n\n')), model: options?.model || undefined }),
      });
    } catch { throw new Error('Could not reach Claude Code. Use the HuskyNote desktop app for Windows, or run npm run dev.'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || typeof body.text !== 'string') throw new Error(describeClaudeSubscriptionError(body.error));
    onChunk?.(body.text);
    return body.text;
  }
  generate(prompt: string, options?: AICompletionOptions): Promise<string> { return this.run(prompt, options); }
  streamGenerate(prompt: string, onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    return this.run(prompt, options, onChunk);
  }
  chat(messages: AIChatMessage[], onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    const { prompt, system } = chatToCodexPrompt(messages);
    return this.run(prompt, options, onChunk, system);
  }
}
export function describeClaudeSubscriptionError(error: unknown): string {
  const message = typeof error === 'string' ? error.trim() : '';
  if (!message) return 'Claude Code did not return an answer. Use the HuskyNote desktop app for Windows, or run npm run dev.';
  if (/not logged in|unauthori[sz]ed|401|sign in|login|authentication/i.test(message)) return 'Sign in with your Claude subscription in Settings.';
  if (/usage limit|rate limit|429|limit reached|hit your limit/i.test(message)) return `Your Claude plan's usage limit was reached. ${message}`;
  return `Claude Code: ${message}`;
}
export const claudeSubscriptionModelsAsOptions = (models: ClaudeSubscriptionModel[]): OllamaModel[] => models.map((m) => ({
  name: m.id, model: m.id, size: 0, modified_at: '', details: { family: 'claude-subscription', parameter_size: m.name },
}));
export const claudeSubscription = new ClaudeSubscriptionProvider();
