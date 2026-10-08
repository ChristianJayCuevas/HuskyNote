/** Claude subscriptions through the official local Claude Code CLI. Credentials stay in Claude Code. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MODEL_ID = /^[A-Za-z0-9][\w.-]{0,63}$/;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const RUN_TIMEOUT_MS = 15 * 60_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
export const CLAUDE_SUBSCRIPTION_MODELS = [
  { id: 'default', name: 'Plan default', description: 'Claude Code chooses the default model for your plan.' },
  { id: 'sonnet', name: 'Claude Sonnet', description: 'Balanced speed and capability. Availability depends on your plan.' },
  { id: 'opus', name: 'Claude Opus', description: 'For complex requests. Availability depends on your plan.' },
  { id: 'haiku', name: 'Claude Haiku', description: 'For quick requests. Availability depends on your plan.' },
];

/** Keep subscription requests independent of inherited API keys, gateways, and agent settings. */
export function claudeEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const key of Object.keys(clean)) {
    if (/^ANTHROPIC_/i.test(key) || /^CLAUDE_CODE_USE_/i.test(key)
      || /^(CLAUDECODE|CLAUDE_CODE_SIMPLE|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_API_KEY|CLAUDE_CODE_BASE_URL|CLAUDE_CODE_SAFE_MODE|CLAUDE_CODE_BARE)/i.test(key)) delete clean[key];
  }
  return { ...clean, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_SAFE_MODE: '1' };
}

/** Text only: no tools, MCP servers, hooks, skills, browser, or saved sessions. */
export function claudeExecArgs(model?: string): string[] {
  return [
    '--print', '--output-format', 'json', '--tools', '', '--disallowedTools', '*',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands',
    '--setting-sources', '', '--settings', '{"disableAllHooks":true}',
    '--no-chrome', '--no-session-persistence', '--permission-mode', 'dontAsk',
    ...(model && model !== 'default' && MODEL_ID.test(model) ? ['--model', model] : []),
  ];
}

export function readClaudeResult(output: string): { text: string; error: string } {
  try {
    const result = JSON.parse(output.trim());
    if (result.type !== 'result') return { text: '', error: 'Claude Code returned an unexpected response.' };
    if (result.is_error || result.subtype !== 'success') {
      return { text: '', error: (Array.isArray(result.errors) ? result.errors.filter((e: unknown) => typeof e === 'string').join('\n') : '')
        || (typeof result.result === 'string' ? result.result : '') || 'Claude Code could not finish the request.' };
    }
    return { text: typeof result.result === 'string' ? result.result.trim() : '', error: '' };
  } catch { return { text: '', error: 'Claude Code did not return a valid response.' }; }
}

/** Return account state only; never expose credentials or personal account details. */
export function readClaudeAuth(output: string, code: number | null): { loggedIn: boolean; authMethod?: 'subscription' | 'apikey' } {
  try {
    const auth = JSON.parse(output.trim());
    const loggedIn = code === 0 && auth.loggedIn === true;
    return { loggedIn, authMethod: loggedIn ? (auth.authMethod === 'claude.ai' ? 'subscription' : 'apikey') : undefined };
  } catch { return { loggedIn: false }; }
}

interface Command { exe: string; prefix: string[] }
function isFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

/** Native installs and npm installs; npm shims are bypassed to avoid invoking a shell. */
export function findClaude(): Command | null {
  const windows = process.platform === 'win32';
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((d) => d.replace(/^"|"$/g, ''));
  dirs.push(path.join(os.homedir(), '.local', 'bin'));
  if (!windows) dirs.push('/opt/homebrew/bin', '/usr/local/bin');
  for (const dir of dirs) {
    const file = path.join(dir, windows ? 'claude.exe' : 'claude');
    if (isFile(file)) return { exe: file, prefix: [] };
  }
  if (windows) {
    const npmDirs = [...dirs];
    if (process.env.APPDATA) npmDirs.push(path.join(process.env.APPDATA, 'npm'));
    for (const dir of npmDirs) {
      const cli = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (isFile(cli)) return { exe: process.execPath, prefix: [cli] };
    }
  }
  return null;
}

function workdir(): string {
  const dir = path.join(os.tmpdir(), 'huskynote-claude');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function start(command: Command, args: string[]) {
  return spawn(command.exe, [...command.prefix, ...args], {
    cwd: workdir(), env: claudeEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function run(command: Command, args: string[], timeout = 20_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    let out = '';
    const child = start(command, args);
    child.stdin.end();
    child.stdin.on('error', () => {});
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, out }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

let login: { url?: string } | null = null;
let loginError = '';
async function getStatus() {
  const command = findClaude();
  if (!command) return { installed: false, loggedIn: false, models: [], loginInProgress: false };
  const [version, auth] = await Promise.all([run(command, ['--version']), run(command, ['--setting-sources', '', 'auth', 'status', '--json'])]);
  return {
    installed: true, version: version.out.match(/\d+\.\d+\.\d+\S*/)?.[0],
    ...readClaudeAuth(auth.out, auth.code), models: CLAUDE_SUBSCRIPTION_MODELS,
    loginInProgress: Boolean(login), loginUrl: login?.url, loginError: loginError || undefined,
  };
}
function startLogin(command: Command): Promise<{ url?: string }> {
  if (login) return Promise.resolve({ url: login.url });
  const current: { url?: string } = {};
  login = current;
  loginError = '';
  const child = start(command, ['--setting-sources', '', 'auth', 'login', '--claudeai']);
  child.stdin.end();
  child.stdin.on('error', () => {});
  let output = '';
  let finished = false;
  const timer = setTimeout(() => { loginError = 'Sign-in timed out. Try again.'; child.kill(); }, LOGIN_TIMEOUT_MS);
  return new Promise((resolve) => {
    const answer = setTimeout(() => resolve({ url: current.url }), 4000);
    const onData = (chunk: Buffer) => {
      output += chunk;
      const url = output.match(/https:\/\/(?:claude\.ai|console\.anthropic\.com|platform\.claude\.com)\/[^\s\x1b]+/)?.[0];
      if (url && !current.url) { current.url = url; clearTimeout(answer); resolve({ url }); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearTimeout(answer);
      if (code !== 0 && !loginError) loginError = 'Claude Code sign-in did not finish. Try again, or run claude auth login in a terminal.';
      if (login === current) login = null;
      resolve({ url: current.url });
    };
    child.on('error', () => finish(-1));
    child.on('close', finish);
  });
}

let running = 0;
const waiting: Array<() => void> = [];
const acquire = () => new Promise<void>((resolve) => {
  if (running < 3) { running++; resolve(); } else waiting.push(() => { running++; resolve(); });
});
const release = () => { running--; waiting.shift()?.(); };
async function generate(command: Command, prompt: string, model: string | undefined, res: ServerResponse): Promise<{ status: number; body: object }> {
  await acquire();
  try {
    if (res.destroyed || res.writableEnded) return { status: 499, body: { error: 'Cancelled.' } };
    const auth = await run(command, ['--setting-sources', '', 'auth', 'status', '--json']);
    if (readClaudeAuth(auth.out, auth.code).authMethod !== 'subscription') {
      return { status: 401, body: { error: 'Sign in with your Claude subscription in Settings before sending requests.' } };
    }
    return await new Promise((resolve) => {
      const child = start(command, claudeExecArgs(model));
      let out = ''; let stderr = ''; let timedOut = false; let finished = false;
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, RUN_TIMEOUT_MS);
      const onClose = () => { if (!res.writableEnded) child.kill(); };
      res.on('close', onClose);
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
      const done = (code: number | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer); res.off('close', onClose);
        const { text, error } = readClaudeResult(out);
        if (!timedOut && code === 0 && text && !error) resolve({ status: 200, body: { text } });
        else resolve({ status: 502, body: { error: timedOut ? 'Claude Code timed out. Try a shorter request.'
          : (stderr.trim() || error || 'Claude Code did not return an answer.') } });
      };
      child.on('error', () => done(-1));
      child.on('close', done);
    });
  } finally { release(); }
}

function isFromHuskyNote(req: IncomingMessage): boolean {
  const hosts = new Set([`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`]);
  if (!hosts.has(String(req.headers.host || '').toLowerCase()) || req.headers['x-huskynote'] !== '1') return false;
  if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false;
  const origin = req.headers.origin;
  if (origin) return origin.startsWith('http://') && hosts.has(origin.slice(7).toLowerCase());
  return req.method === 'GET';
}
function send(res: ServerResponse, status: number, body: object): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('Request too large.')); req.destroy(); } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
export function handleClaudeRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/claude-subscription/')) return false;
  if (!isFromHuskyNote(req)) { send(res, 403, { error: 'Only HuskyNote can use this.' }); return true; }
  void (async () => {
    try {
      if (url === '/api/claude-subscription/status' && req.method === 'GET') return send(res, 200, await getStatus());
      if (req.method !== 'POST' || !['/api/claude-subscription/login', '/api/claude-subscription/generate'].includes(url)) {
        return send(res, 404, { error: 'Unknown Claude subscription request.' });
      }
      const command = findClaude();
      if (!command) return send(res, 404, { error: 'Claude Code is not installed on this computer.' });
      if (url.endsWith('/login')) return send(res, 200, await startLogin(command));
      let body: { prompt?: unknown; model?: unknown };
      try { body = JSON.parse(await readBody(req)); }
      catch { return send(res, 400, { error: 'Invalid request JSON.' }); }
      if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) return send(res, 400, { error: 'Nothing to send.' });
      if (body.model !== undefined && (typeof body.model !== 'string' || !MODEL_ID.test(body.model))) return send(res, 400, { error: 'Invalid model.' });
      const result = await generate(command, body.prompt, body.model as string | undefined, res);
      send(res, result.status, result.body);
    } catch (err) { send(res, 500, { error: err instanceof Error ? err.message : String(err) }); }
  })();
  return true;
}
