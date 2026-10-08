// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const state = vi.hoisted(() => ({ authMethod: 'claude.ai', loggedIn: true, result: {} as object, spawnCalls: [] as any[], prompts: [] as string[] }));
vi.mock('node:fs', () => ({ default: {
  statSync: () => ({ isFile: () => true }), mkdirSync: () => {},
} }));
vi.mock('node:child_process', () => ({ spawn: (exe: string, args: string[], options: object) => {
  state.spawnCalls.push({ exe, args, options });
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
  let input = '';
  child.stdin.on('data', (d) => { input += d; });
  child.stdin.on('finish', () => {
    setImmediate(() => {
      let output: string;
      if (args.includes('--version')) output = '2.1.295 (Claude Code)';
      else if (args.includes('status')) output = JSON.stringify({ loggedIn: state.loggedIn, authMethod: state.authMethod, email: 'private@example.com', token: 'secret' });
      else { state.prompts.push(input); output = JSON.stringify(state.result); }
      child.stdout.end(output); child.emit('close', 0);
    });
  });
  return child;
} }));

import { claudeEnvironment, claudeExecArgs, handleClaudeRequest, readClaudeAuth, readClaudeResult } from '../server/claude-bridge.ts';
import { ClaudeSubscriptionProvider, isClaudeSubscriptionReady, describeClaudeSubscriptionError } from '../src/services/ai/claude-subscription';
import { ai, setActiveProvider } from '../src/services/ai/active-provider';

afterEach(() => { vi.unstubAllGlobals(); state.authMethod = 'claude.ai'; state.loggedIn = true; state.spawnCalls = []; state.prompts = []; setActiveProvider('ollama'); });

describe('Claude subscription authentication and result parsing', () => {
  it('removes credentials that would override subscription billing and preserves the local login directory', () => {
    const env = claudeEnvironment({ PATH: 'bin', ANTHROPIC_API_KEY: 'secret', ANTHROPIC_AUTH_TOKEN: 'secret', ANTHROPIC_BASE_URL: 'https://proxy', ANTHROPIC_PROFILE: 'console', CLAUDE_CODE_USE_BEDROCK: '1', CLAUDECODE: '1', CLAUDE_CONFIG_DIR: '/account', CLAUDE_CODE_SIMPLE: '1' });
    expect(env).toEqual({ PATH: 'bin', CLAUDE_CONFIG_DIR: '/account', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_SAFE_MODE: '1' });
  });
  it('never enables bare mode, permission bypasses, inherited hooks, or tools', () => {
    const args = claudeExecArgs('sonnet');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--disallowedTools') + 1]).toBe('*');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args[args.indexOf('--settings') + 1]).toBe('{"disableAllHooks":true}');
    expect(args).toContain('--strict-mcp-config');
    expect(args).toContain('--no-session-persistence');
    expect(args).not.toContain('--bare');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet');
    expect(claudeExecArgs('default')).not.toContain('--model');
    expect(claudeExecArgs('--dangerously-skip-permissions')).not.toContain('--model');
  });
  it('accepts only authenticated Claude accounts as subscriptions', () => {
    expect(readClaudeAuth('{"loggedIn":true,"authMethod":"claude.ai","email":"private"}', 0)).toEqual({ loggedIn: true, authMethod: 'subscription' });
    expect(readClaudeAuth('{"loggedIn":true,"authMethod":"api_key"}', 0).authMethod).toBe('apikey');
    expect(readClaudeAuth('{"loggedIn":true,"authMethod":"claude.ai"}', 1).loggedIn).toBe(false);
    expect(readClaudeAuth('invalid', 0).loggedIn).toBe(false);
    expect(isClaudeSubscriptionReady({ reachable: true, installed: true, loggedIn: true, authMethod: 'apikey', models: [], loginInProgress: false })).toBe(false);
  });
  it('returns only successful results and explains limits and failed turns', () => {
    expect(readClaudeResult('{"type":"result","subtype":"success","is_error":false,"result":"  Answer  "}')).toEqual({ text: 'Answer', error: '' });
    expect(readClaudeResult('{"type":"result","subtype":"error_during_execution","is_error":true,"result":"partial","errors":["Usage limit reached"]}')).toEqual({ text: '', error: 'Usage limit reached' });
    expect(readClaudeResult('{"type":"assistant","result":"partial"}').text).toBe('');
    expect(readClaudeResult('not JSON').error).toMatch(/valid response/);
    expect(describeClaudeSubscriptionError('Not logged in')).toMatch(/Sign in/);
    expect(describeClaudeSubscriptionError('Usage limit reached')).toMatch(/Claude plan/);
  });
});

describe('Claude subscription HTTP bridge', () => {
  let server: http.Server; let port: number;
  beforeAll(async () => {
    server = http.createServer((req, res) => { if (!handleClaudeRequest(req, res)) res.end('static'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const request = (method: string, pathname: string, headers: Record<string, string> = {}, body?: string) =>
    new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
        let data = ''; res.on('data', (d) => { data += d; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }));
      });
      req.on('error', reject); req.end(body);
    });
  const headers = () => ({ 'X-HuskyNote': '1', Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json' });
  it('refuses cross-site, missing-header, missing-origin, and rebinding requests without starting a process', async () => {
    for (const h of [{}, { ...headers(), Origin: 'https://evil.example' }, { 'X-HuskyNote': '1' }, { ...headers(), Host: `evil.example:${port}` }, { ...headers(), 'Sec-Fetch-Site': 'cross-site' }]) {
      expect((await request('POST', '/api/claude-subscription/generate', h, '{"prompt":"hi"}')).status).toBe(403);
    }
    const preflight = await request('OPTIONS', '/api/claude-subscription/generate', { Origin: 'https://evil.example' });
    expect(preflight.status).toBe(403); expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    expect(state.spawnCalls).toHaveLength(0);
  });
  it('reports installation and account status without returning private account data', async () => {
    const res = await request('GET', '/api/claude-subscription/status', { 'X-HuskyNote': '1' });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ installed: true, loggedIn: true, authMethod: 'subscription' });
    expect(res.body).not.toContain('secret'); expect(res.body).not.toContain('private@');
  });
  it('rejects invalid input before starting Claude', async () => {
    for (const body of ['invalid', 'null', '{"prompt":""}', '{"prompt":"hi","model":"--tools=default"}', '{"prompt":"hi","model":123}']) {
      expect((await request('POST', '/api/claude-subscription/generate', headers(), body)).status).toBe(400);
    }
    expect(state.spawnCalls).toHaveLength(0);
  });
  it('refuses API-account generation instead of charging the API account', async () => {
    state.authMethod = 'api_key';
    const res = await request('POST', '/api/claude-subscription/generate', headers(), '{"prompt":"hi"}');
    expect(res.status).toBe(401); expect(state.prompts).toHaveLength(0);
  });
  it('sends the prompt on stdin and returns the completed answer', async () => {
    state.result = { type: 'result', subtype: 'success', is_error: false, result: 'Meeting summary' };
    const res = await request('POST', '/api/claude-subscription/generate', headers(), '{"prompt":"Summarize the meeting","model":"sonnet"}');
    expect(res.status).toBe(200); expect(JSON.parse(res.body)).toEqual({ text: 'Meeting summary' });
    expect(state.prompts).toEqual(['Summarize the meeting']);
    const generation = state.spawnCalls.find((c) => c.args.includes('--print'));
    expect(generation.args).not.toContain('Summarize the meeting');
    expect(generation.options.windowsHide).toBe(true);
  });
  it('reports CLI failures without treating partial text as a successful answer', async () => {
    state.result = { type: 'result', subtype: 'error_during_execution', is_error: true, result: 'partial', errors: ['Usage limit reached'] };
    const res = await request('POST', '/api/claude-subscription/generate', headers(), '{"prompt":"hi"}');
    expect(res.status).toBe(502); expect(JSON.parse(res.body).error).toBe('Usage limit reached');
    expect((await request('GET', '/index.html')).body).toBe('static');
  });
});

describe('Claude subscription provider routing', () => {
  it('routes chat and generation to the subscription bridge with model and instructions', async () => {
    const fetchMock = vi.fn(async () => new Response('{"text":"Hello"}', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock); setActiveProvider('claude-subscription');
    const onChunk = vi.fn();
    await expect(ai.chat([{ role: 'user', content: 'Hi', id: '1', timestamp: 0 }], onChunk, { model: 'opus', systemPrompt: 'Be brief.' })).resolves.toBe('Hello');
    expect(onChunk).toHaveBeenCalledWith('Hello');
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe('/api/claude-subscription/generate');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'opus' });
    expect(JSON.parse(init.body).prompt).toContain('Be brief.');
    expect(JSON.parse(init.body).prompt).toContain('User: Hi');
    await expect(ai.generate('Summarize')).resolves.toBe('Hello');
  });
  it('marks a static hosted page unavailable instead of mistaking HTML for account status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } })));
    expect((await new ClaudeSubscriptionProvider().getStatus()).reachable).toBe(false);
  });
});
