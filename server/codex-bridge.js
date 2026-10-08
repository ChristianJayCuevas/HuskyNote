var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
var MODEL_ID = /^[A-Za-z0-9][\w.-]{0,63}$/;
var MAX_BODY_BYTES = 8 * 1024 * 1024;
var RUN_TIMEOUT_MS = 15 * 60 * 1000;
var LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
var MAX_PARALLEL_RUNS = 3;
var DISABLED_FEATURES = [
    'shell_tool', 'unified_exec', 'code_mode_host', 'apps', 'plugins', 'multi_agent', 'browser_use',
    'computer_use', 'image_generation', 'view_image', 'goals', 'sleep_tool', 'tool_suggest', 'skill_search',
];
/** `codex exec` arguments: text in, text out, nothing else */
export function codexExecArgs(workdir, model) {
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray([
        'exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
        '--sandbox', 'read-only', '--color', 'never', '--json', '-C', workdir
    ], DISABLED_FEATURES.flatMap(function (feature) { return ['--disable', feature]; }), true), [
        '-c', 'web_search="disabled"', '-c', 'model_reasoning_effort="medium"'
    ], false), (model && MODEL_ID.test(model) ? ['-m', model] : []), true), [
        '-',
    ], false);
}
/** The answer in `codex exec --json` output: the last agent message, or why there is none */
export function readCodexEvents(jsonl) {
    var _a, _b, _c, _d, _e, _f;
    var text = '';
    var error = '';
    var warning = '';
    for (var _i = 0, _g = jsonl.split('\n'); _i < _g.length; _i++) {
        var line = _g[_i];
        if (!line.trim().startsWith('{'))
            continue;
        var event_1 = void 0;
        try {
            event_1 = JSON.parse(line);
        }
        catch (_h) {
            continue;
        }
        if (event_1.type === 'item.completed' && ((_a = event_1.item) === null || _a === void 0 ? void 0 : _a.type) === 'agent_message' && typeof event_1.item.text === 'string')
            text = event_1.item.text;
        else if (event_1.type === 'item.completed' && ((_b = event_1.item) === null || _b === void 0 ? void 0 : _b.type) === 'error')
            warning = String((_c = event_1.item.message) !== null && _c !== void 0 ? _c : '');
        else if (event_1.type === 'turn.failed')
            error = String((_e = (_d = event_1.error) === null || _d === void 0 ? void 0 : _d.message) !== null && _e !== void 0 ? _e : 'Codex could not finish the request.');
        else if (event_1.type === 'error')
            error = String((_f = event_1.message) !== null && _f !== void 0 ? _f : 'Codex reported an error.');
    }
    return { text: text.trim(), error: error || (text ? '' : warning) };
}
function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    }
    catch (_a) {
        return false;
    }
}
/** The Codex executable: on PATH, from the Codex app, or inside an npm install */
export function findCodex() {
    var windows = process.platform === 'win32';
    var name = windows ? 'codex.exe' : 'codex';
    var dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    if (windows && process.env.LOCALAPPDATA)
        dirs.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'OpenAI', 'Codex', 'bin'));
    if (!windows)
        dirs.push('/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'));
    for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
        var dir = dirs_1[_i];
        var file = path.join(dir, name);
        if (isFile(file))
            return file;
    }
    // npm's codex.cmd needs a shell; run the binary it wraps instead
    if (windows && process.env.APPDATA) {
        var scope = path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai');
        try {
            for (var _a = 0, _b = fs.readdirSync(scope).filter(function (p) { return p.startsWith('codex-win32-'); }); _a < _b.length; _a++) {
                var pkg = _b[_a];
                var vendor = path.join(scope, pkg, 'vendor');
                for (var _c = 0, _d = fs.readdirSync(vendor); _c < _d.length; _c++) {
                    var triple = _d[_c];
                    for (var _e = 0, _f = [path.join(vendor, triple, 'bin', 'codex.exe'), path.join(vendor, triple, 'codex', 'codex.exe')]; _e < _f.length; _e++) {
                        var file = _f[_e];
                        if (isFile(file))
                            return file;
                    }
                }
            }
        }
        catch ( /* not installed with npm */_g) { /* not installed with npm */ }
    }
    return null;
}
var workdir = (function () {
    var dir = '';
    return function () {
        if (!dir) {
            dir = path.join(os.tmpdir(), 'huskynote-codex');
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    };
})();
function run(exe, args, timeoutMs) {
    if (timeoutMs === void 0) { timeoutMs = 20000; }
    return new Promise(function (resolve) {
        var out = '';
        var child = spawn(exe, args, { cwd: workdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        var timer = setTimeout(function () { return child.kill(); }, timeoutMs);
        child.stdout.on('data', function (d) { out += d; });
        child.stderr.on('data', function (d) { out += d; });
        child.on('error', function () { clearTimeout(timer); resolve({ code: -1, out: out }); });
        child.on('close', function (code) { clearTimeout(timer); resolve({ code: code, out: out }); });
    });
}
var modelCache = null;
function listModels(exe) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, code, out, models, catalog;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (modelCache && Date.now() - modelCache.at < 10 * 60000)
                        return [2 /*return*/, modelCache.models];
                    return [4 /*yield*/, run(exe, ['debug', 'models'])];
                case 1:
                    _a = _c.sent(), code = _a.code, out = _a.out;
                    models = [];
                    try {
                        catalog = JSON.parse(out.slice(out.indexOf('{')));
                        models = ((_b = catalog.models) !== null && _b !== void 0 ? _b : [])
                            .filter(function (m) { return (m === null || m === void 0 ? void 0 : m.visibility) === 'list' && typeof m.slug === 'string' && MODEL_ID.test(m.slug); })
                            .sort(function (a, b) { var _a, _b; return ((_a = a.priority) !== null && _a !== void 0 ? _a : 99) - ((_b = b.priority) !== null && _b !== void 0 ? _b : 99); })
                            .map(function (m) { return ({ id: m.slug, name: String(m.display_name || m.slug), description: String(m.description || '') }); });
                    }
                    catch ( /* older Codex without a model catalog: Codex picks its default */_d) { /* older Codex without a model catalog: Codex picks its default */ }
                    if (code === 0 && models.length)
                        modelCache = { at: Date.now(), models: models };
                    return [2 /*return*/, models];
            }
        });
    });
}
var login = null;
var loginError = '';
function getStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var exe, _a, version, auth, models, authText, loggedIn;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    exe = findCodex();
                    if (!exe)
                        return [2 /*return*/, { installed: false, loggedIn: false, models: [], loginInProgress: false }];
                    return [4 /*yield*/, Promise.all([run(exe, ['--version']), run(exe, ['login', 'status']), listModels(exe)])];
                case 1:
                    _a = _c.sent(), version = _a[0], auth = _a[1], models = _a[2];
                    authText = auth.out.trim();
                    loggedIn = auth.code === 0 && /logged in/i.test(authText) && !/not logged in/i.test(authText);
                    return [2 /*return*/, {
                            installed: true,
                            version: (_b = version.out.match(/\d+\.\d+\.\d+\S*/)) === null || _b === void 0 ? void 0 : _b[0],
                            loggedIn: loggedIn,
                            authMethod: loggedIn ? (/api key/i.test(authText) ? 'apikey' : 'chatgpt') : undefined,
                            models: models,
                            loginInProgress: Boolean(login),
                            loginUrl: login === null || login === void 0 ? void 0 : login.url,
                            loginError: loginError || undefined,
                        }];
            }
        });
    });
}
// ── Sign in ─────────────────────────────────────────────────────────────────
function startLogin(exe) {
    if (login)
        return Promise.resolve({ url: login.url });
    loginError = '';
    var current = { startedAt: Date.now() };
    login = current;
    var output = '';
    var child = spawn(exe, ['login'], { cwd: workdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    var timer = setTimeout(function () { loginError = 'Sign-in timed out. Try again.'; child.kill(); }, LOGIN_TIMEOUT_MS);
    return new Promise(function (resolve) {
        var answer = setTimeout(function () { return resolve({ url: current.url }); }, 4000);
        var onData = function (chunk) {
            var _a;
            output += chunk;
            var url = (_a = output.match(/https:\/\/auth\.openai\.com\/\S+/)) === null || _a === void 0 ? void 0 : _a[0];
            if (url && !current.url) {
                current.url = url;
                clearTimeout(answer);
                resolve({ url: url });
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        var finish = function (code) {
            clearTimeout(timer);
            clearTimeout(answer);
            if (code !== 0 && !loginError) {
                loginError = output.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !l.includes('http'); }).pop() || 'Sign-in did not finish.';
            }
            if (login === current)
                login = null;
            resolve({ url: current.url });
        };
        child.on('error', function () { return finish(-1); });
        child.on('close', finish);
    });
}
// ── Generate ────────────────────────────────────────────────────────────────
var running = 0;
var waiting = [];
var acquire = function () { return new Promise(function (resolve) {
    if (running < MAX_PARALLEL_RUNS) {
        running++;
        resolve();
    }
    else
        waiting.push(function () { running++; resolve(); });
}); };
var release = function () { var _a; running--; (_a = waiting.shift()) === null || _a === void 0 ? void 0 : _a(); };
function generate(exe, prompt, model, res) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, acquire()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    if (res.writableEnded || res.destroyed)
                        return [2 /*return*/, { status: 499, body: { error: 'Cancelled.' } }];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            var out = '';
                            var errOut = '';
                            var child = spawn(exe, codexExecArgs(workdir(), model), { cwd: workdir(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
                            var timer = setTimeout(function () { return child.kill(); }, RUN_TIMEOUT_MS);
                            // Stop Codex when HuskyNote stops waiting for the answer
                            var onClose = function () { if (!res.writableEnded)
                                child.kill(); };
                            res.on('close', onClose);
                            child.stdout.on('data', function (d) { out += d; });
                            child.stderr.on('data', function (d) { errOut += d; });
                            child.stdin.on('error', function () { });
                            child.stdin.end(prompt);
                            var done = function (code) {
                                clearTimeout(timer);
                                res.off('close', onClose);
                                var _a = readCodexEvents(out), text = _a.text, error = _a.error;
                                if (text)
                                    resolve({ status: 200, body: { text: text } });
                                else {
                                    var detail = error || errOut.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).pop() || "Codex stopped (exit code ".concat(code, ").");
                                    resolve({ status: 502, body: { error: detail } });
                                }
                            };
                            child.on('error', function () { return done(-1); });
                            child.on('close', done);
                        })];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    release();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ── HTTP ────────────────────────────────────────────────────────────────────
/** Only HuskyNote's own page: same host, same origin, and the X-HuskyNote header */
function isFromHuskyNote(req) {
    var port = req.socket.localPort;
    var hosts = new Set(["127.0.0.1:".concat(port), "localhost:".concat(port)]);
    if (!hosts.has(String(req.headers.host || '').toLowerCase()))
        return false;
    if (req.headers['x-huskynote'] !== '1')
        return false;
    var site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin')
        return false;
    var origin = req.headers.origin;
    if (origin)
        return hosts.has(origin.toLowerCase().replace(/^http:\/\//, ''));
    return req.method === 'GET';
}
function send(res, status, body) {
    if (res.writableEnded || res.destroyed)
        return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
}
function readBody(req) {
    return new Promise(function (resolve, reject) {
        var size = 0;
        var chunks = [];
        req.on('data', function (chunk) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request too large.'));
                req.destroy();
            }
            else
                chunks.push(chunk);
        });
        req.on('end', function () { return resolve(Buffer.concat(chunks).toString('utf8')); });
        req.on('error', reject);
    });
}
/** Answers /api/codex/* requests; returns false for anything else */
export function handleCodexRequest(req, res) {
    var _this = this;
    var url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/codex/'))
        return false;
    if (!isFromHuskyNote(req)) {
        send(res, 403, { error: 'Only HuskyNote can use this.' });
        return true;
    }
    void (function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b, exe, _c, _d, body, _e, _f, prompt_1, model, result, err_1;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 8, , 9]);
                    if (!(url === '/api/codex/status' && req.method === 'GET')) return [3 /*break*/, 2];
                    _a = send;
                    _b = [res, 200];
                    return [4 /*yield*/, getStatus()];
                case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_g.sent()]))];
                case 2:
                    exe = findCodex();
                    if (!(url === '/api/codex/login' && req.method === 'POST')) return [3 /*break*/, 4];
                    if (!exe)
                        return [2 /*return*/, send(res, 404, { error: 'Codex is not installed on this computer.' })];
                    _c = send;
                    _d = [res, 200];
                    return [4 /*yield*/, startLogin(exe)];
                case 3: return [2 /*return*/, _c.apply(void 0, _d.concat([_g.sent()]))];
                case 4:
                    if (!(url === '/api/codex/generate' && req.method === 'POST')) return [3 /*break*/, 7];
                    if (!exe)
                        return [2 /*return*/, send(res, 404, { error: 'Codex is not installed on this computer.' })];
                    _f = (_e = JSON).parse;
                    return [4 /*yield*/, readBody(req)];
                case 5:
                    body = _f.apply(_e, [_g.sent()]);
                    prompt_1 = typeof body.prompt === 'string' ? body.prompt : '';
                    if (!prompt_1.trim())
                        return [2 /*return*/, send(res, 400, { error: 'Nothing to send.' })];
                    model = typeof body.model === 'string' && MODEL_ID.test(body.model) ? body.model : undefined;
                    return [4 /*yield*/, generate(exe, prompt_1, model, res)];
                case 6:
                    result = _g.sent();
                    return [2 /*return*/, send(res, result.status, result.body)];
                case 7:
                    send(res, 404, { error: 'Unknown Codex request.' });
                    return [3 /*break*/, 9];
                case 8:
                    err_1 = _g.sent();
                    send(res, 500, { error: err_1 instanceof Error ? err_1.message : String(err_1) });
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); })();
    return true;
}
