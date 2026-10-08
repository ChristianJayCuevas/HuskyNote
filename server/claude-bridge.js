var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
/** Claude subscriptions through the official local Claude Code CLI. Credentials stay in Claude Code. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
var MODEL_ID = /^[A-Za-z0-9][\w.-]{0,63}$/;
var MAX_BODY_BYTES = 8 * 1024 * 1024;
var RUN_TIMEOUT_MS = 15 * 60000;
var LOGIN_TIMEOUT_MS = 10 * 60000;
export var CLAUDE_SUBSCRIPTION_MODELS = [
    { id: 'default', name: 'Plan default', description: 'Claude Code chooses the default model for your plan.' },
    { id: 'sonnet', name: 'Claude Sonnet', description: 'Balanced speed and capability. Availability depends on your plan.' },
    { id: 'opus', name: 'Claude Opus', description: 'For complex requests. Availability depends on your plan.' },
    { id: 'haiku', name: 'Claude Haiku', description: 'For quick requests. Availability depends on your plan.' },
];
/** Keep subscription requests independent of inherited API keys, gateways, and agent settings. */
export function claudeEnvironment(env) {
    if (env === void 0) { env = process.env; }
    var clean = __assign({}, env);
    for (var _i = 0, _a = Object.keys(clean); _i < _a.length; _i++) {
        var key = _a[_i];
        if (/^ANTHROPIC_/i.test(key) || /^CLAUDE_CODE_USE_/i.test(key)
            || /^(CLAUDECODE|CLAUDE_CODE_SIMPLE|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_API_KEY|CLAUDE_CODE_BASE_URL|CLAUDE_CODE_SAFE_MODE|CLAUDE_CODE_BARE)/i.test(key))
            delete clean[key];
    }
    return __assign(__assign({}, clean), { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_SAFE_MODE: '1' });
}
/** Text only: no tools, MCP servers, hooks, skills, browser, or saved sessions. */
export function claudeExecArgs(model) {
    return __spreadArray([
        '--print', '--output-format', 'json', '--tools', '', '--disallowedTools', '*',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands',
        '--setting-sources', '', '--settings', '{"disableAllHooks":true}',
        '--no-chrome', '--no-session-persistence', '--permission-mode', 'dontAsk'
    ], (model && model !== 'default' && MODEL_ID.test(model) ? ['--model', model] : []), true);
}
export function readClaudeResult(output) {
    try {
        var result = JSON.parse(output.trim());
        if (result.type !== 'result')
            return { text: '', error: 'Claude Code returned an unexpected response.' };
        if (result.is_error || result.subtype !== 'success') {
            return { text: '', error: (Array.isArray(result.errors) ? result.errors.filter(function (e) { return typeof e === 'string'; }).join('\n') : '')
                    || (typeof result.result === 'string' ? result.result : '') || 'Claude Code could not finish the request.' };
        }
        return { text: typeof result.result === 'string' ? result.result.trim() : '', error: '' };
    }
    catch (_a) {
        return { text: '', error: 'Claude Code did not return a valid response.' };
    }
}
/** Return account state only; never expose credentials or personal account details. */
export function readClaudeAuth(output, code) {
    try {
        var auth = JSON.parse(output.trim());
        var loggedIn = code === 0 && auth.loggedIn === true;
        return { loggedIn: loggedIn, authMethod: loggedIn ? (auth.authMethod === 'claude.ai' ? 'subscription' : 'apikey') : undefined };
    }
    catch (_a) {
        return { loggedIn: false };
    }
}
function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    }
    catch (_a) {
        return false;
    }
}
/** Native installs and npm installs; npm shims are bypassed to avoid invoking a shell. */
export function findClaude() {
    var windows = process.platform === 'win32';
    var dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean).map(function (d) { return d.replace(/^"|"$/g, ''); });
    dirs.push(path.join(os.homedir(), '.local', 'bin'));
    if (!windows)
        dirs.push('/opt/homebrew/bin', '/usr/local/bin');
    for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
        var dir = dirs_1[_i];
        var file = path.join(dir, windows ? 'claude.exe' : 'claude');
        if (isFile(file))
            return { exe: file, prefix: [] };
    }
    if (windows) {
        var npmDirs = __spreadArray([], dirs, true);
        if (process.env.APPDATA)
            npmDirs.push(path.join(process.env.APPDATA, 'npm'));
        for (var _a = 0, npmDirs_1 = npmDirs; _a < npmDirs_1.length; _a++) {
            var dir = npmDirs_1[_a];
            var cli = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
            if (isFile(cli))
                return { exe: process.execPath, prefix: [cli] };
        }
    }
    return null;
}
function workdir() {
    var dir = path.join(os.tmpdir(), 'huskynote-claude');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
function start(command, args) {
    return spawn(command.exe, __spreadArray(__spreadArray([], command.prefix, true), args, true), {
        cwd: workdir(), env: claudeEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
}
function run(command, args, timeout) {
    if (timeout === void 0) { timeout = 20000; }
    return new Promise(function (resolve) {
        var out = '';
        var child = start(command, args);
        child.stdin.end();
        child.stdin.on('error', function () { });
        var timer = setTimeout(function () { return child.kill(); }, timeout);
        child.stdout.on('data', function (d) { out += d; });
        child.on('error', function () { clearTimeout(timer); resolve({ code: -1, out: out }); });
        child.on('close', function (code) { clearTimeout(timer); resolve({ code: code, out: out }); });
    });
}
var login = null;
var loginError = '';
function getStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var command, _a, version, auth;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    command = findClaude();
                    if (!command)
                        return [2 /*return*/, { installed: false, loggedIn: false, models: [], loginInProgress: false }];
                    return [4 /*yield*/, Promise.all([run(command, ['--version']), run(command, ['--setting-sources', '', 'auth', 'status', '--json'])])];
                case 1:
                    _a = _c.sent(), version = _a[0], auth = _a[1];
                    return [2 /*return*/, __assign(__assign({ installed: true, version: (_b = version.out.match(/\d+\.\d+\.\d+\S*/)) === null || _b === void 0 ? void 0 : _b[0] }, readClaudeAuth(auth.out, auth.code)), { models: CLAUDE_SUBSCRIPTION_MODELS, loginInProgress: Boolean(login), loginUrl: login === null || login === void 0 ? void 0 : login.url, loginError: loginError || undefined })];
            }
        });
    });
}
function startLogin(command) {
    if (login)
        return Promise.resolve({ url: login.url });
    var current = {};
    login = current;
    loginError = '';
    var child = start(command, ['--setting-sources', '', 'auth', 'login', '--claudeai']);
    child.stdin.end();
    child.stdin.on('error', function () { });
    var output = '';
    var finished = false;
    var timer = setTimeout(function () { loginError = 'Sign-in timed out. Try again.'; child.kill(); }, LOGIN_TIMEOUT_MS);
    return new Promise(function (resolve) {
        var answer = setTimeout(function () { return resolve({ url: current.url }); }, 4000);
        var onData = function (chunk) {
            var _a;
            output += chunk;
            var url = (_a = output.match(/https:\/\/(?:claude\.ai|console\.anthropic\.com|platform\.claude\.com)\/[^\s\x1b]+/)) === null || _a === void 0 ? void 0 : _a[0];
            if (url && !current.url) {
                current.url = url;
                clearTimeout(answer);
                resolve({ url: url });
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        var finish = function (code) {
            if (finished)
                return;
            finished = true;
            clearTimeout(timer);
            clearTimeout(answer);
            if (code !== 0 && !loginError)
                loginError = 'Claude Code sign-in did not finish. Try again, or run claude auth login in a terminal.';
            if (login === current)
                login = null;
            resolve({ url: current.url });
        };
        child.on('error', function () { return finish(-1); });
        child.on('close', finish);
    });
}
var running = 0;
var waiting = [];
var acquire = function () { return new Promise(function (resolve) {
    if (running < 3) {
        running++;
        resolve();
    }
    else
        waiting.push(function () { running++; resolve(); });
}); };
var release = function () { var _a; running--; (_a = waiting.shift()) === null || _a === void 0 ? void 0 : _a(); };
function generate(command, prompt, model, res) {
    return __awaiter(this, void 0, void 0, function () {
        var auth;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, acquire()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 5, 6]);
                    if (res.destroyed || res.writableEnded)
                        return [2 /*return*/, { status: 499, body: { error: 'Cancelled.' } }];
                    return [4 /*yield*/, run(command, ['--setting-sources', '', 'auth', 'status', '--json'])];
                case 3:
                    auth = _a.sent();
                    if (readClaudeAuth(auth.out, auth.code).authMethod !== 'subscription') {
                        return [2 /*return*/, { status: 401, body: { error: 'Sign in with your Claude subscription in Settings before sending requests.' } }];
                    }
                    return [4 /*yield*/, new Promise(function (resolve) {
                            var child = start(command, claudeExecArgs(model));
                            var out = '';
                            var stderr = '';
                            var timedOut = false;
                            var finished = false;
                            var timer = setTimeout(function () { timedOut = true; child.kill(); }, RUN_TIMEOUT_MS);
                            var onClose = function () { if (!res.writableEnded)
                                child.kill(); };
                            res.on('close', onClose);
                            child.stdout.on('data', function (d) { out += d; });
                            child.stderr.on('data', function (d) { stderr += d; });
                            child.stdin.on('error', function () { });
                            child.stdin.end(prompt);
                            var done = function (code) {
                                if (finished)
                                    return;
                                finished = true;
                                clearTimeout(timer);
                                res.off('close', onClose);
                                var _a = readClaudeResult(out), text = _a.text, error = _a.error;
                                if (!timedOut && code === 0 && text && !error)
                                    resolve({ status: 200, body: { text: text } });
                                else
                                    resolve({ status: 502, body: { error: timedOut ? 'Claude Code timed out. Try a shorter request.'
                                                : (stderr.trim() || error || 'Claude Code did not return an answer.') } });
                            };
                            child.on('error', function () { return done(-1); });
                            child.on('close', done);
                        })];
                case 4: return [2 /*return*/, _a.sent()];
                case 5:
                    release();
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function isFromHuskyNote(req) {
    var hosts = new Set(["127.0.0.1:".concat(req.socket.localPort), "localhost:".concat(req.socket.localPort)]);
    if (!hosts.has(String(req.headers.host || '').toLowerCase()) || req.headers['x-huskynote'] !== '1')
        return false;
    if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')
        return false;
    var origin = req.headers.origin;
    if (origin)
        return origin.startsWith('http://') && hosts.has(origin.slice(7).toLowerCase());
    return req.method === 'GET';
}
function send(res, status, body) {
    if (res.destroyed || res.writableEnded)
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
export function handleClaudeRequest(req, res) {
    var _this = this;
    var url = (req.url || '').split('?')[0];
    if (!url.startsWith('/api/claude-subscription/'))
        return false;
    if (!isFromHuskyNote(req)) {
        send(res, 403, { error: 'Only HuskyNote can use this.' });
        return true;
    }
    void (function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, _b, command, _c, _d, body, _e, _f, _g, result, err_1;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 10, , 11]);
                    if (!(url === '/api/claude-subscription/status' && req.method === 'GET')) return [3 /*break*/, 2];
                    _a = send;
                    _b = [res, 200];
                    return [4 /*yield*/, getStatus()];
                case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_h.sent()]))];
                case 2:
                    if (req.method !== 'POST' || !['/api/claude-subscription/login', '/api/claude-subscription/generate'].includes(url)) {
                        return [2 /*return*/, send(res, 404, { error: 'Unknown Claude subscription request.' })];
                    }
                    command = findClaude();
                    if (!command)
                        return [2 /*return*/, send(res, 404, { error: 'Claude Code is not installed on this computer.' })];
                    if (!url.endsWith('/login')) return [3 /*break*/, 4];
                    _c = send;
                    _d = [res, 200];
                    return [4 /*yield*/, startLogin(command)];
                case 3: return [2 /*return*/, _c.apply(void 0, _d.concat([_h.sent()]))];
                case 4:
                    body = void 0;
                    _h.label = 5;
                case 5:
                    _h.trys.push([5, 7, , 8]);
                    _f = (_e = JSON).parse;
                    return [4 /*yield*/, readBody(req)];
                case 6:
                    body = _f.apply(_e, [_h.sent()]);
                    return [3 /*break*/, 8];
                case 7:
                    _g = _h.sent();
                    return [2 /*return*/, send(res, 400, { error: 'Invalid request JSON.' })];
                case 8:
                    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim())
                        return [2 /*return*/, send(res, 400, { error: 'Nothing to send.' })];
                    if (body.model !== undefined && (typeof body.model !== 'string' || !MODEL_ID.test(body.model)))
                        return [2 /*return*/, send(res, 400, { error: 'Invalid model.' })];
                    return [4 /*yield*/, generate(command, body.prompt, body.model, res)];
                case 9:
                    result = _h.sent();
                    send(res, result.status, result.body);
                    return [3 /*break*/, 11];
                case 10:
                    err_1 = _h.sent();
                    send(res, 500, { error: err_1 instanceof Error ? err_1.message : String(err_1) });
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); })();
    return true;
}
