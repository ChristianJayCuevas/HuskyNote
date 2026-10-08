import type { AIProvider, AICompletionOptions } from './provider';
import type { OllamaModel, AIChatMessage } from '../../types';

/**
 * ChatGPT through Codex: uses the person's ChatGPT plan by running the
 * official Codex CLI on this computer. HuskyNote's local server starts Codex
 * (see server/codex-bridge.ts and the Windows app's StaticServer.cs); sign-in
 * and tokens stay inside Codex. Codex runs with its tools off, so it only
 * reads what HuskyNote sends and writes text back.
 */

export interface CodexModelOption {
  id: string;
  name: string;
  description: string;
}

export interface CodexStatus {
  /** HuskyNote's local server can start Codex (desktop app or `npm run dev`) */
  reachable: boolean;
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  authMethod?: 'chatgpt' | 'apikey';
  models: CodexModelOption[];
  loginInProgress: boolean;
  loginUrl?: string;
  loginError?: string;
}

const UNREACHABLE: CodexStatus = { reachable: false, installed: false, loggedIn: false, models: [], loginInProgress: false };
const HEADERS = { 'X-HuskyNote': '1' };

const PREFACE =
  'You are the writing engine inside HuskyNote, a notes and meetings app. Answer the request below in your final message only. '
  + 'Do not use tools, do not ask follow-up questions, and do not describe what you are about to do: reply with exactly the content the request asks for, in the format it asks for.';

/** One prompt for Codex: HuskyNote's framing, any instructions, then the request */
export function buildCodexPrompt(prompt: string, systemPrompt?: string): string {
  return [PREFACE, systemPrompt?.trim() ? `<instructions>\n${systemPrompt.trim()}\n</instructions>` : '', `<request>\n${prompt}\n</request>`]
    .filter(Boolean)
    .join('\n\n');
}

/** A chat as one request: the conversation so far, answered as the assistant */
export function chatToCodexPrompt(messages: AIChatMessage[]): { prompt: string; system: string } {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages
    .filter((m) => m.role !== 'system' && m.content.trim())
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content.trim()}`);
  return {
    system,
    prompt: `<conversation>\n${turns.join('\n\n')}\n</conversation>\n\nReply as the Assistant to the last User message.`,
  };
}

export class CodexProvider implements AIProvider {
  name = 'Codex';

  async getStatus(): Promise<CodexStatus> {
    try {
      const res = await fetch('/api/codex/status', { headers: HEADERS, cache: 'no-store' });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return UNREACHABLE;
      return { ...UNREACHABLE, ...(await res.json()), reachable: true };
    } catch {
      return UNREACHABLE;
    }
  }

  /** Runs `codex login`, which opens ChatGPT sign-in in the browser */
  async startLogin(): Promise<{ url?: string }> {
    const res = await fetch('/api/codex/login', { method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/json' }, body: '{}' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not start Codex sign-in.');
    return body;
  }

  async isAvailable(): Promise<boolean> {
    const status = await this.getStatus();
    return status.installed && status.loggedIn;
  }

  async getModels(): Promise<OllamaModel[]> {
    return (await this.getStatus()).models.map(toModel);
  }

  private async run(prompt: string, options: AICompletionOptions | undefined, onChunk?: (chunk: string) => void, system?: string): Promise<string> {
    const systemPrompt = [system, options?.systemPrompt].filter(Boolean).join('\n\n');
    let res: Response;
    try {
      res = await fetch('/api/codex/generate', {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildCodexPrompt(prompt, systemPrompt), model: options?.model || undefined }),
      });
    } catch {
      throw new Error('Could not reach Codex. Use the HuskyNote desktop app, or run HuskyNote with npm run dev.');
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 404 && !body.error) throw new Error('Codex is only available in the HuskyNote desktop app for Windows or with npm run dev.');
    if (!res.ok || typeof body.text !== 'string') throw new Error(describeCodexError(body.error));
    // Codex answers in one piece; hand it over as a single chunk
    onChunk?.(body.text);
    return body.text;
  }

  generate(prompt: string, options?: AICompletionOptions): Promise<string> {
    return this.run(prompt, options);
  }

  streamGenerate(prompt: string, onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    return this.run(prompt, options, onChunk);
  }

  chat(messages: AIChatMessage[], onChunk: (chunk: string) => void, options?: AICompletionOptions): Promise<string> {
    const { prompt, system } = chatToCodexPrompt(messages);
    return this.run(prompt, options, onChunk, system || undefined);
  }
}

export function describeCodexError(error: unknown): string {
  const message = typeof error === 'string' ? error.trim() : '';
  if (!message) return 'Codex did not return an answer.';
  if (/not logged in|unauthori[sz]ed|401|sign in again|refresh token/i.test(message)) return 'Codex is signed out. Sign in with ChatGPT in Settings.';
  if (/usage limit|rate limit|429/i.test(message)) return `Your ChatGPT plan's Codex limit was reached. ${message}`;
  return `Codex: ${message}`;
}

const toModel = (m: CodexModelOption): OllamaModel => ({
  name: m.id,
  model: m.id,
  size: 0,
  modified_at: '',
  details: { family: 'codex', parameter_size: m.name },
});

export const codexModelsAsOptions = (models: CodexModelOption[]): OllamaModel[] => models.map(toModel);

export const codex = new CodexProvider();
