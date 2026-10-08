using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace HuskyNote
{
    /// <summary>
    /// Lets HuskyNote use the person's ChatGPT plan through the official Codex CLI
    /// on this computer. The page cannot start programs, so the app's local server
    /// answers (the same endpoints as server/codex-bridge.ts in the dev server):
    ///
    ///   GET  /api/codex/status    is Codex installed and signed in, and its models
    ///   POST /api/codex/login     run `codex login` (opens ChatGPT sign-in in the browser)
    ///   POST /api/codex/generate  { prompt, model? } -> { text }
    ///
    /// Sign-in, tokens and billing stay inside Codex. Codex runs with every tool
    /// turned off (no shell, no code, no web, no files), so a transcript or
    /// document can only be read and answered, never acted on. Only HuskyNote's
    /// own page may call these endpoints.
    /// </summary>
    public static class CodexBridge
    {
        private static readonly Regex ModelId = new(@"^[A-Za-z0-9][\w.-]{0,63}$");
        private const long MaxBodyBytes = 8 * 1024 * 1024;
        private static readonly TimeSpan RunTimeout = TimeSpan.FromMinutes(15);
        private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(20);
        private static readonly TimeSpan LoginTimeout = TimeSpan.FromMinutes(10);
        private static readonly SemaphoreSlim Runs = new(3);

        private static readonly string[] DisabledFeatures =
        {
            "shell_tool", "unified_exec", "code_mode_host", "apps", "plugins", "multi_agent", "browser_use",
            "computer_use", "image_generation", "view_image", "goals", "sleep_tool", "tool_suggest", "skill_search",
        };

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        private sealed record CodexModel(string Id, string Name, string Description);

        public static bool Handles(HttpListenerRequest req) =>
            req.Url?.AbsolutePath.StartsWith("/api/codex/", StringComparison.Ordinal) == true;

        public static async Task HandleAsync(HttpListenerContext context, int port)
        {
            var req = context.Request;
            var res = context.Response;
            try
            {
                if (!IsFromHuskyNote(req, port))
                {
                    await Send(res, 403, new { error = "Only HuskyNote can use this." });
                    return;
                }
                string path = req.Url!.AbsolutePath;
                if (path == "/api/codex/status" && req.HttpMethod == "GET")
                {
                    await Send(res, 200, await GetStatus());
                    return;
                }
                string? exe = FindCodex();
                if (path == "/api/codex/login" && req.HttpMethod == "POST")
                {
                    if (exe == null) await Send(res, 404, new { error = "Codex is not installed on this computer." });
                    else await Send(res, 200, await StartLogin(exe));
                    return;
                }
                if (path == "/api/codex/generate" && req.HttpMethod == "POST")
                {
                    if (exe == null)
                    {
                        await Send(res, 404, new { error = "Codex is not installed on this computer." });
                        return;
                    }
                    string? body = await ReadBody(req);
                    if (body == null)
                    {
                        await Send(res, 413, new { error = "Request too large." });
                        return;
                    }
                    using var doc = JsonDocument.Parse(body);
                    string prompt = doc.RootElement.TryGetProperty("prompt", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? "" : "";
                    string? model = doc.RootElement.TryGetProperty("model", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
                    if (string.IsNullOrWhiteSpace(prompt))
                    {
                        await Send(res, 400, new { error = "Nothing to send." });
                        return;
                    }
                    var (status, result) = await Generate(exe, prompt, model != null && ModelId.IsMatch(model) ? model : null);
                    await Send(res, status, result);
                    return;
                }
                await Send(res, 404, new { error = "Unknown Codex request." });
            }
            catch (Exception ex)
            {
                try { await Send(res, 500, new { error = ex.Message }); } catch { }
            }
        }

        /// <summary>Only HuskyNote's own page: same host, same origin, and the X-HuskyNote header</summary>
        private static bool IsFromHuskyNote(HttpListenerRequest req, int port)
        {
            var hosts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { $"127.0.0.1:{port}", $"localhost:{port}" };
            if (!hosts.Contains(req.Headers["Host"] ?? "")) return false;
            if (req.Headers["X-HuskyNote"] != "1") return false;
            string? site = req.Headers["Sec-Fetch-Site"];
            if (!string.IsNullOrEmpty(site) && site != "same-origin") return false;
            string? origin = req.Headers["Origin"];
            if (!string.IsNullOrEmpty(origin))
                return origin.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && hosts.Contains(origin.Substring("http://".Length));
            return req.HttpMethod == "GET";
        }

        private static async Task Send(HttpListenerResponse res, int status, object body)
        {
            byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(body, JsonOptions);
            res.StatusCode = status;
            res.ContentType = "application/json; charset=utf-8";
            res.Headers["Cache-Control"] = "no-store";
            res.ContentLength64 = bytes.Length;
            await res.OutputStream.WriteAsync(bytes);
            res.Close();
        }

        private static async Task<string?> ReadBody(HttpListenerRequest req)
        {
            if (req.ContentLength64 > MaxBodyBytes) return null;
            using var buffer = new MemoryStream();
            var chunk = new byte[81920];
            int read;
            while ((read = await req.InputStream.ReadAsync(chunk)) > 0)
            {
                if (buffer.Length + read > MaxBodyBytes) return null;
                buffer.Write(chunk, 0, read);
            }
            return Encoding.UTF8.GetString(buffer.ToArray());
        }

        /// <summary>The Codex executable: on PATH, from the Codex app, or inside an npm install</summary>
        public static string? FindCodex()
        {
            var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "")
                .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
                .ToList();
            dirs.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "OpenAI", "Codex", "bin"));
            foreach (string dir in dirs)
            {
                try
                {
                    string file = Path.Combine(dir.Trim().Trim('"'), "codex.exe");
                    if (File.Exists(file)) return file;
                }
                catch { }
            }
            // npm's codex.cmd needs a shell; run the binary it wraps instead
            string scope = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm", "node_modules", "@openai", "codex", "node_modules", "@openai");
            try
            {
                foreach (string pkg in Directory.GetDirectories(scope, "codex-win32-*"))
                    foreach (string triple in Directory.GetDirectories(Path.Combine(pkg, "vendor")))
                        foreach (string file in new[] { Path.Combine(triple, "bin", "codex.exe"), Path.Combine(triple, "codex", "codex.exe") })
                            if (File.Exists(file)) return file;
            }
            catch { }
            return null;
        }

        private static string Workdir()
        {
            string dir = Path.Combine(Path.GetTempPath(), "huskynote-codex");
            Directory.CreateDirectory(dir);
            return dir;
        }

        private static ProcessStartInfo StartInfo(string exe, IEnumerable<string> args, bool withInput)
        {
            var psi = new ProcessStartInfo(exe)
            {
                WorkingDirectory = Workdir(),
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = withInput,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            };
            if (withInput) psi.StandardInputEncoding = new UTF8Encoding(false);
            foreach (string arg in args) psi.ArgumentList.Add(arg);
            return psi;
        }

        private static async Task<(int Code, string Out, string Err)> Run(string exe, IEnumerable<string> args, TimeSpan timeout, string? input = null)
        {
            using var process = new Process { StartInfo = StartInfo(exe, args, input != null) };
            try { process.Start(); }
            catch (Exception ex) { return (-1, "", ex.Message); }
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            if (input != null)
            {
                try
                {
                    await process.StandardInput.WriteAsync(input);
                    process.StandardInput.Close();
                }
                catch (IOException) { }
            }
            using var cts = new CancellationTokenSource(timeout);
            try { await process.WaitForExitAsync(cts.Token); }
            catch (OperationCanceledException)
            {
                try { process.Kill(true); } catch { }
                await process.WaitForExitAsync();
            }
            return (process.ExitCode, await stdout, await stderr);
        }

        // ── Status ──────────────────────────────────────────────────────────

        private static List<CodexModel>? _models;
        private static DateTime _modelsAt;

        private static async Task<List<CodexModel>> ListModels(string exe)
        {
            if (_models != null && DateTime.UtcNow - _modelsAt < TimeSpan.FromMinutes(10)) return _models;
            var (code, output, _) = await Run(exe, new[] { "debug", "models" }, CommandTimeout);
            var models = new List<CodexModel>();
            try
            {
                int start = output.IndexOf('{');
                using var doc = JsonDocument.Parse(start >= 0 ? output.Substring(start) : "{}");
                if (doc.RootElement.TryGetProperty("models", out var list) && list.ValueKind == JsonValueKind.Array)
                {
                    models = list.EnumerateArray()
                        .Where(m => m.TryGetProperty("visibility", out var v) && v.GetString() == "list"
                            && m.TryGetProperty("slug", out var s) && ModelId.IsMatch(s.GetString() ?? ""))
                        .OrderBy(m => m.TryGetProperty("priority", out var p) && p.TryGetInt32(out int n) ? n : 99)
                        .Select(m => new CodexModel(
                            m.GetProperty("slug").GetString()!,
                            m.TryGetProperty("display_name", out var d) ? d.GetString() ?? "" : m.GetProperty("slug").GetString()!,
                            m.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : ""))
                        .ToList();
                }
            }
            catch (JsonException) { /* older Codex without a model catalog: Codex picks its default */ }
            if (code == 0 && models.Count > 0)
            {
                _models = models;
                _modelsAt = DateTime.UtcNow;
            }
            return models;
        }

        private static async Task<object> GetStatus()
        {
            string? exe = FindCodex();
            if (exe == null) return new { installed = false, loggedIn = false, models = Array.Empty<CodexModel>(), loginInProgress = false };
            var version = Run(exe, new[] { "--version" }, CommandTimeout);
            var auth = Run(exe, new[] { "login", "status" }, CommandTimeout);
            var models = ListModels(exe);
            await Task.WhenAll(version, auth, models);
            string authText = (auth.Result.Out + auth.Result.Err).Trim();
            bool loggedIn = auth.Result.Code == 0
                && Regex.IsMatch(authText, "logged in", RegexOptions.IgnoreCase)
                && !Regex.IsMatch(authText, "not logged in", RegexOptions.IgnoreCase);
            var versionMatch = Regex.Match(version.Result.Out, @"\d+\.\d+\.\d+\S*");
            LoginState? login;
            string loginError;
            lock (LoginLock) { login = _login; loginError = _loginError; }
            return new
            {
                installed = true,
                version = versionMatch.Success ? versionMatch.Value : null,
                loggedIn,
                authMethod = loggedIn ? (Regex.IsMatch(authText, "api key", RegexOptions.IgnoreCase) ? "apikey" : "chatgpt") : null,
                models = models.Result,
                loginInProgress = login != null,
                loginUrl = login?.Url,
                loginError = string.IsNullOrEmpty(loginError) ? null : loginError,
            };
        }

        // ── Sign in ─────────────────────────────────────────────────────────

        private sealed class LoginState
        {
            public string? Url;
        }

        private static readonly object LoginLock = new();
        private static LoginState? _login;
        private static string _loginError = "";

        private static async Task<object> StartLogin(string exe)
        {
            var state = new LoginState();
            lock (LoginLock)
            {
                if (_login != null) return new { url = _login.Url };
                _loginError = "";
                _login = state;
            }
            var output = new StringBuilder();
            var gotUrl = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            var process = new Process { StartInfo = StartInfo(exe, new[] { "login" }, false), EnableRaisingEvents = true };
            void OnData(object _, DataReceivedEventArgs e)
            {
                if (e.Data == null) return;
                lock (output) output.AppendLine(e.Data);
                var match = Regex.Match(e.Data, @"https://auth\.openai\.com/\S+");
                if (match.Success && state.Url == null)
                {
                    state.Url = match.Value;
                    gotUrl.TrySetResult(true);
                }
            }
            process.OutputDataReceived += OnData;
            process.ErrorDataReceived += OnData;
            process.Exited += (_, _) =>
            {
                int code = -1;
                try { code = process.ExitCode; } catch { }
                string text;
                lock (output) text = output.ToString();
                lock (LoginLock)
                {
                    if (code != 0 && _loginError == "")
                    {
                        _loginError = text.Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0 && !l.Contains("http")).LastOrDefault()
                            ?? "Sign-in did not finish.";
                    }
                    if (_login == state) _login = null;
                }
                gotUrl.TrySetResult(false);
            };
            try { process.Start(); }
            catch (Exception ex)
            {
                lock (LoginLock)
                {
                    _login = null;
                    _loginError = ex.Message;
                }
                throw;
            }
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            _ = Task.Delay(LoginTimeout).ContinueWith(_ =>
            {
                try
                {
                    if (process.HasExited) return;
                    lock (LoginLock) _loginError = "Sign-in timed out. Try again.";
                    process.Kill(true);
                }
                catch { }
            });
            await Task.WhenAny(gotUrl.Task, Task.Delay(4000));
            return new { url = state.Url };
        }

        // ── Generate ────────────────────────────────────────────────────────

        /// <summary>`codex exec` arguments: text in, text out, nothing else</summary>
        private static List<string> ExecArgs(string workdir, string? model)
        {
            var args = new List<string>
            {
                "exec", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules",
                "--sandbox", "read-only", "--color", "never", "--json", "-C", workdir,
            };
            foreach (string feature in DisabledFeatures) { args.Add("--disable"); args.Add(feature); }
            args.AddRange(new[] { "-c", "web_search=\"disabled\"", "-c", "model_reasoning_effort=\"medium\"" });
            if (model != null) { args.Add("-m"); args.Add(model); }
            args.Add("-");
            return args;
        }

        /// <summary>The answer in `codex exec --json` output: the last agent message, or why there is none</summary>
        private static (string Text, string Error) ReadEvents(string jsonl)
        {
            string text = "", error = "", warning = "";
            foreach (string raw in jsonl.Split('\n'))
            {
                string line = raw.Trim();
                if (!line.StartsWith('{')) continue;
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    string type = root.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
                    if (type == "item.completed" && root.TryGetProperty("item", out var item))
                    {
                        string itemType = item.TryGetProperty("type", out var it) ? it.GetString() ?? "" : "";
                        if (itemType == "agent_message" && item.TryGetProperty("text", out var tx)) text = tx.GetString() ?? "";
                        else if (itemType == "error" && item.TryGetProperty("message", out var wm)) warning = wm.GetString() ?? "";
                    }
                    else if (type == "turn.failed")
                    {
                        error = root.TryGetProperty("error", out var e) && e.TryGetProperty("message", out var em)
                            ? em.GetString() ?? "" : "Codex could not finish the request.";
                    }
                    else if (type == "error")
                    {
                        error = root.TryGetProperty("message", out var em) ? em.GetString() ?? "" : "Codex reported an error.";
                    }
                }
                catch (JsonException) { }
            }
            text = text.Trim();
            return (text, error != "" ? error : (text != "" ? "" : warning));
        }

        private static async Task<(int Status, object Body)> Generate(string exe, string prompt, string? model)
        {
            await Runs.WaitAsync();
            try
            {
                var (code, output, errors) = await Run(exe, ExecArgs(Workdir(), model), RunTimeout, prompt);
                var (text, error) = ReadEvents(output);
                if (text != "") return (200, new { text });
                string detail = error != ""
                    ? error
                    : errors.Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).LastOrDefault() ?? $"Codex stopped (exit code {code}).";
                return (502, new { error = detail });
            }
            finally
            {
                Runs.Release();
            }
        }
    }
}
