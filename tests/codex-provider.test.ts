// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { codexExecArgs, handleCodexRequest, readCodexEvents } from '../server/codex-bridge';
import { buildCodexPrompt, chatToCodexPrompt, describeCodexError } from '../src/services/ai/codex';

describe('codex exec arguments', () => {
  it('runs Codex with every tool off and without the user config', () => {
    const args = codexExecArgs('C:/tmp/huskynote-codex', 'gpt-6.1-sol');
    expect(args[0]).toBe('exec');
    for (const flag of ['--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json']) expect(args).toContain(flag);
    expect(args.join(' ')).toContain('--sandbox read-only');
    for (const feature of ['shell_tool', 'unified_exec', 'code_mode_host', 'browser_use', 'computer_use', 'apps', 'plugins']) {
      expect(args.join(' ')).toContain(`--disable ${feature}`);
    }
    expect(args.join(' ')).toContain('web_search="disabled"');
    expect(args.join(' ')).toContain('-m gpt-6.1-sol');
    // The prompt is read from stdin, never the command line
    expect(args[args.length - 1]).toBe('-');
  });

  it('drops a model id that is not a plain name', () => {
    expect(codexExecArgs('/tmp', 'gpt; rm -rf /')).not.toContain('-m');
    expect(codexExecArgs('/tmp', '--sandbox=danger-full-access')).not.toContain('-m');
    expect(codexExecArgs('/tmp')).not.toContain('-m');
  });
});

describe('readCodexEvents', () => {
  const line = (event: object) => JSON.stringify(event);

  it('takes the last agent message as the answer', () => {
    const out = [
      line({ type: 'thread.started', thread_id: 't' }),
      line({ type: 'item.completed', item: { type: 'error', message: 'Code Mode is unavailable' } }),
      line({ type: 'item.completed', item: { type: 'agent_message', text: 'Working on it.' } }),
      line({ type: 'item.completed', item: { type: 'agent_message', text: '  {"overview":"Done"}  ' } }),
      line({ type: 'turn.completed', usage: {} }),
      'not json',
    ].join('\n');
    expect(readCodexEvents(out)).toEqual({ text: '{"overview":"Done"}', error: '' });
  });

  it('reports why there is no answer', () => {
    expect(readCodexEvents(line({ type: 'turn.failed', error: { message: 'You have hit your usage limit.' } }))).toEqual({ text: '', error: 'You have hit your usage limit.' });
    expect(readCodexEvents(line({ type: 'error', message: 'stream disconnected' })).error).toBe('stream disconnected');
    expect(readCodexEvents(line({ type: 'item.completed', item: { type: 'error', message: 'Not logged in' } })).error).toBe('Not logged in');
    expect(readCodexEvents('')).toEqual({ text: '', error: '' });
  });
});

describe('Codex endpoints refuse anyone but HuskyNote', () => {
  let server: http.Server;
  let port = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (!handleCodexRequest(req, res)) { res.writeHead(200); res.end('static'); }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const request = (method: string, path: string, headers: Record<string, string>, body?: string) =>
    new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }));
      });
      req.on('error', reject);
      req.end(body);
    });

  it('needs the X-HuskyNote header', async () => {
    expect((await request('GET', '/api/codex/status', {})).status).toBe(403);
  });

  it('refuses other sites, even with the header', async () => {
    const json = { 'X-HuskyNote': '1', 'Content-Type': 'application/json' };
    expect((await request('POST', '/api/codex/generate', { ...json, Origin: 'https://evil.example' }, '{"prompt":"hi"}')).status).toBe(403);
    expect((await request('POST', '/api/codex/generate', { ...json, Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'cross-site' }, '{"prompt":"hi"}')).status).toBe(403);
    // A POST without an Origin is not from a browser page
    expect((await request('POST', '/api/codex/generate', json, '{"prompt":"hi"}')).status).toBe(403);
    // DNS rebinding: another name pointed at 127.0.0.1
    expect((await request('GET', '/api/codex/status', { 'X-HuskyNote': '1', Host: `evil.example:${port}` })).status).toBe(403);
  });

  it('answers a cross-site preflight without CORS headers', async () => {
    const res = await request('OPTIONS', '/api/codex/generate', { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' });
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('leaves other paths alone', async () => {
    expect((await request('GET', '/index.html', {})).body).toBe('static');
  });
});

describe('Codex prompts', () => {
  it('frames a request with HuskyNote instructions', () => {
    const prompt = buildCodexPrompt('Summarize this meeting.', 'Reply in JSON.');
    expect(prompt).toMatch(/^You are the writing engine inside HuskyNote/);
    expect(prompt).toContain('<instructions>\nReply in JSON.\n</instructions>');
    expect(prompt.trimEnd().endsWith('<request>\nSummarize this meeting.\n</request>')).toBe(true);
    expect(buildCodexPrompt('Hi')).not.toContain('<instructions>');
  });

  it('turns a chat into one request', () => {
    const { prompt, system } = chatToCodexPrompt([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'My colour is teal.' },
      { role: 'assistant', content: 'Noted.' },
      { role: 'user', content: 'What is it?' },
    ] as any);
    expect(system).toBe('Be brief.');
    expect(prompt).toContain('User: My colour is teal.\n\nAssistant: Noted.\n\nUser: What is it?');
    expect(prompt).toContain('Reply as the Assistant to the last User message.');
  });

  it('explains common Codex errors', () => {
    expect(describeCodexError('Not logged in')).toBe('Codex is signed out. Sign in with ChatGPT in Settings.');
    expect(describeCodexError('You have hit your usage limit.')).toMatch(/^Your ChatGPT plan's Codex limit was reached\./);
    expect(describeCodexError('')).toBe('Codex did not return an answer.');
    expect(describeCodexError('stream disconnected')).toBe('Codex: stream disconnected');
  });
});
