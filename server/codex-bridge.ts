/**
 * Lets HuskyNote use the person's ChatGPT plan through the official Codex CLI
 * on this computer. The page cannot start programs, so the dev server answers:
 *
 *   GET  /api/codex/status    is Codex installed and signed in, and its models
 *   POST /api/codex/login     run `codex login` (opens ChatGPT sign-in in the browser)
 *   POST /api/codex/generate  { prompt, model? } -> { text }
 *
 * Sign-in, tokens and billing stay inside Codex; HuskyNote never sees them.
 * Codex runs with every tool turned off (no shell, no code, no web, no files),
 * so a transcript or document can only be read and answered, never acted on.
 * Only HuskyNote's own page may call these endpoints (same host, same origin,
 * and a custom header that a cross-site request cannot send without a
 * preflight, which is refused).
 *
 * desktop/windows/StaticServer.cs serves the same endpoints in the Windows app.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MODEL_ID = /^[A-Za-z0-9][\w.-]{0,63}$/;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_PARALLEL_RUNS = 3;

const DISABLED_FEATURES = [
  'shell_tool', 'unified_exec', 'code_mode_host', 'apps', 'plugins', 'multi_agent', 'browser_use',
  'computer_use', 'image_generation', 'view_image', 'goals', 'sleep_tool', 'tool_suggest', 'skill_search',
];

/** `codex exec` arguments: text in, text out, nothing else */
export function codexExecArgs(workdir: string, model?: string): string[] {
  return [
    'exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    '--sandbox', 'read-only', '--color', 'never', '--json', '-C', workdir,
    ...DISABLED_FEATURES.flatMap((feature) => ['--disable', feature]),
    '-c', 'web_search="disabled"', '-c', 'model_reasoning_effort="medium"',
    ...(model && MODEL_ID.test(model) ? ['-m', model] : []),
    '-',
  ];
}

/** The answer in `codex exec --json` output: the last agent message, or why there is none */
export function readCodexEvents(jsonl: string): { text: string; error: string } {
  let text = '';
  let error = '';
  let warning = '';
  for (const line of jsonl.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') text = event.item.text;
    else if (event.type === 'item.completed' && event.item?.type === 'error') warning = String(event.item.message ?? '');
    else if (event.type === 'turn.failed') error = String(event.error?.message ?? 'Codex could not finish the request.');
    else if (event.type === 'error') error = String(event.message ?? 'Codex reported an error.');
  }
  return { text: text.trim(), error: error || (text ? '' : warning) };
}

function isFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

/** The Codex executable: on PATH, from the Codex app, or inside an npm install */
export function findCodex(): string | null {
  const windows = process.platform === 'win32';
  const name = windows ? 'codex.exe' : 'codex';
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (windows && process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin'));
  if (!windows) dirs.push('/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'));
  for (const dir of dirs) {
    const file = path.join(dir, name);
    if (isFile(file)) return file;
  }
  // npm's codex.cmd needs a shell; run the binary it wraps instead
  if (windows && process.env.APPDATA) {
    const scope = path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai');
    try {
      for (const pkg of fs.readdirSync(scope).filter((p) => p.startsWith('codex-win32-'))) {
        const vendor = path.join(scope, pkg, 'vendor');
        for (const triple of fs.readdirSync(vendor)) {
          for (const file of [path.join(vendor, triple, 'bin', 'codex.exe'), path.join(vendor, triple, 'codex', 'codex.exe')]) {
            if (isFile(file)) return file;
          }
        }
      }
    } catch { /* not installed with npm */ }
  }
  return null;
}

const workdir = (() => {
  let dir = '';
  return () => {
    if (!dir) {
      dir = path.join(os.tmpdir(), 'huskynote-codex');
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };
})();

function run(exe: string, args: string[], timeoutMs = 20_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(exe, args, { cwd: workdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, out }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

// ── Status ──────────────────────────────────────────────────────────────────

interface CodexModel { id: string; name: string; description: string }
interface CodexStatus {
  installed: boolean;
  version?: string;
  loggedIn: boolean;
  authMethod?: 'chatgpt' | 'apikey';
  models: CodexModel[];
  loginInProgress: boolean;
  loginUrl?: string;
  loginError?: string;
}

let modelCache: { at: number; models: CodexModel[] } | null = null;

async function listModels(exe: string): Promise<CodexModel[]> {
  if (modelCache && Date.now() - modelCache.at < 10 * 60_000) return modelCache.models;
  const { code, out } = await run(exe, ['debug', 'models']);
  let models: CodexModel[] = [];
  try {
    const catalog = JSON.parse(out.slice(out.indexOf('{'))) as { models?: any[] };
    models = (catalog.models ?? [])
      .filter((m) => m?.visibility === 'list' && typeof m.slug === 'string' && MODEL_ID.test(m.slug))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((m) => ({ id: m.slug, name: String(m.display_name || m.slug), description: String(m.description || '') }));
  } catch { /* older Codex without a model catalog: Codex picks its default */ }
  if (code === 0 && models.length) modelCache = { at: Date.now(), models };
  return models;
}

let login: { url?: string; startedAt: number } | null = null;
let loginError = '';

async function getStatus(): Promise<CodexStatus> {
  const exe = findCodex();
  if (!exe) return { installed: false, loggedIn: false, models: [], loginInProgress: false };
  const [version, auth, models] = await Promise.all([run(exe, ['--version']), run(exe, ['login', 'status']), listModels(exe)]);
  const authText = auth.out.trim();
  const loggedIn = auth.code === 0 && /logged in/i.test(authText) && !/not logged in/i.test(authText);
  return {
    installed: true,
    version: version.out.match(/\d+\.\d+\.\d+\S*/)?.[0],
    loggedIn,
    authMethod: loggedIn ? (/api key/i.test(authText) ? 'apikey' : 'chatgpt') : undefined,
    models,
    loginInProgress: Boolean(login),
    loginUrl: login?.url,
    loginError: loginError || undefined,
  };
}

// ── Sign in ─────────────────────────────────────────────────────────────────

function startLogin(exe: string): Promise<{ url?: string }> {
  if (login) return Promise.resolve({ url: login.url });
  loginError = '';
  const current: { url?: string; startedAt: number } = { startedAt: Date.now() };
  login = current;
  let output = '';
  const child = spawn(exe, ['login'], { cwd: workdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => { loginError = 'Sign-in timed out. Try again.'; child.kill(); }, LOGIN_TIMEOUT_MS);
  return new Promise((resolve) => {
    const answer = setTimeout(() => resolve({ url: current.url }), 4000);
    const onData = (chunk: Buffer) => {
      output += chunk;
      const url = output.match(/https:\/\/auth\.openai\.com\/\S+/)?.[0];
      if (url && !current.url) {
        current.url = url;
        clearTimeout(answer);
        resolve({ url });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const finish = (code: number | null) => {
      clearTimeout(timer);
      clearTimeout(answer);
      if (code !== 0 && !loginError) {
        loginError = output.split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('http')).pop() || 'Sign-in did not finish.';
      }
      if (login === current) login = null;
      resolve({ url: current.url });
    };
    child.on('error', () => finish(-1));
    child.on('close', finish);
  });
}

// ── Generate ────────────────────────────────────────────────────────────────

let running = 0;
const waiting: Array<() => void> = [];
const acquire = () => new Promise<void>((resolve) => {
  if (running < MAX_PARALLEL_RUNS) { running++; resolve(); } else waiting.push(() => { running++; resolve(); });
});
const release = () => { running--; waiting.shift()?.(); };

async function generate(exe: string, prompt: string, model: string | undefined, res: ServerResponse): Promise<{ status: number; body: object }> {
  await acquire();
  try {
    if (res.writableEnded || res.destroyed) return { status: 499, body: { error: 'Cancelled.' } };
    return await new Promise((resolve) => {
      let out = '';
      let errOut = '';
      const child = spawn(exe, codexExecArgs(workdir(), model), { cwd: workdir(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const timer = setTimeout(() => child.kill(), RUN_TIMEOUT_MS);
      // Stop Codex when HuskyNote stops waiting for the answer
      const onClose = () => { if (!res.writableEnded) child.kill(); };
      res.on('close', onClose);
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { errOut += d; });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
      const done = (code: number | null) => {
        clearTimeout(timer);
        res.off('close', onClose);
        const { text, error } = readCodexEvents(out);
        if (text) resolve({ status: 200, body: { text } });
        else {
          const detail = error || errOut.split('\n').map((l) => l.trim()).filter(Boolean).pop() || `Codex stopped (exit code ${code}).`;
          resolve({ status: 502, body: { error: detail } });
        }
      };
      child.on('error', () => done(-1));
      child.on('close', done);
    });
  } finally {
    release();
  }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

/** Only HuskyNote's own page: same host, same origin, and the X-HuskyNote header */
function isFromHuskyNote(req: IncomingMessage): boolean {
  const port = req.socket.localPort;
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!hosts.has(String(req.headers.host || '').toLowerCase())) return false;
  if (req.headers['x-huskynote'] !== '1') return false;
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin') return false;
  const origin = req.headers.origin;
  if (origin) return hosts.has(origin.toLowerCase().replace(/^http:\/\//, ''));
  return req.method === 'GET';
}

function send(res: ServerResponse, status: number, body: object): void {
  if (res.writableEnded || res.destroyed) return;
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

/** Answers /api/codex/* requests; returns false for anything else */
export function handleCodexRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/codex/')) return false;
  if (!isFromHuskyNote(req)) {
    send(res, 403, { error: 'Only HuskyNote can use this.' });
    return true;
  }
  void (async () => {
    try {
      if (url === '/api/codex/status' && req.method === 'GET') return send(res, 200, await getStatus());
      const exe = findCodex();
      if (url === '/api/codex/login' && req.method === 'POST') {
        if (!exe) return send(res, 404, { error: 'Codex is not installed on this computer.' });
        return send(res, 200, await startLogin(exe));
      }
      if (url === '/api/codex/generate' && req.method === 'POST') {
        if (!exe) return send(res, 404, { error: 'Codex is not installed on this computer.' });
        const body = JSON.parse(await readBody(req)) as { prompt?: unknown; model?: unknown };
        const prompt = typeof body.prompt === 'string' ? body.prompt : '';
        if (!prompt.trim()) return send(res, 400, { error: 'Nothing to send.' });
        const model = typeof body.model === 'string' && MODEL_ID.test(body.model) ? body.model : undefined;
        const result = await generate(exe, prompt, model, res);
        return send(res, result.status, result.body);
      }
      send(res, 404, { error: 'Unknown Codex request.' });
    } catch (err) {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true;
}
