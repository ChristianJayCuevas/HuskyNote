import type { AIProvider, AICompletionOptions } from './provider';
import type { OllamaModel, AIChatMessage } from '../../types';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<OllamaModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}`);
      }
      const data = await res.json();
      return (data.models || []) as OllamaModel[];
    } catch (err: any) {
      console.warn('[HuskyNote] Failed to query Ollama models:', err?.message);
      return [];
    }
  }

  async generate(prompt: string, options?: AICompletionOptions): Promise<string> {
    const model = options?.model;
    if (!model) throw new Error('No Ollama model selected.');

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: options?.systemPrompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.3,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama generate error (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data.response || '';
  }

  async streamGenerate(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: AICompletionOptions
  ): Promise<string> {
    const model = options?.model;
    if (!model) throw new Error('No Ollama model selected.');

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: options?.systemPrompt,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.3,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama streaming error (${res.status}): ${errText || res.statusText}`);
    }

    if (!res.body) {
      throw new Error('Readable stream not supported by browser response.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullText += parsed.response;
            onChunk(parsed.response);
          }
        } catch {
          // ignore partial JSON parse errors
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) {
          fullText += parsed.response;
          onChunk(parsed.response);
        }
      } catch {
        // ignore trailing
      }
    }

    return fullText;
  }

  async chat(
    messages: AIChatMessage[],
    onChunk: (chunk: string) => void,
    options?: AICompletionOptions
  ): Promise<string> {
    const model = options?.model;
    if (!model) throw new Error('No Ollama model selected.');

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.3,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama chat error (${res.status}): ${errText || res.statusText}`);
    }

    if (!res.body) throw new Error('Readable stream not supported by browser response.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const piece = parsed.message?.content || '';
          if (piece) {
            fullText += piece;
            onChunk(piece);
          }
        } catch {
          // ignore
        }
      }
    }

    return fullText;
  }

  async pullModel(
    name: string,
    onProgress?: (progress: PullProgressUpdate) => void,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stream: true }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          success: false,
          message: `Ollama pull error (${res.status}): ${errText || res.statusText}`,
        };
      }

      if (!res.body) {
        return { success: false, message: 'Readable stream is not supported in this browser.' };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            const percent =
              data.total && data.completed
                ? Math.min(100, Math.round((data.completed / data.total) * 100))
                : undefined;

            onProgress?.({
              status: data.status || 'Downloading...',
              digest: data.digest,
              total: data.total,
              completed: data.completed,
              percent,
            });

            if (data.error) {
              return { success: false, message: data.error };
            }
          } catch {
            // ignore partial JSON parse errors
          }
        }
      }

      return { success: true, message: `Successfully pulled model "${name}".` };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, message: `Model download for "${name}" was cancelled.` };
      }
      return { success: false, message: err?.message || `Failed to pull model "${name}".` };
    }
  }
}

export interface PullProgressUpdate {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
}

export const ollama = new OllamaProvider();

