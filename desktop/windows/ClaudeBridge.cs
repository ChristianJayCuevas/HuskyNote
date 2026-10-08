using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace HuskyNote
{
    /// <summary>
    /// Lets HuskyNote use the person's Claude subscription through the official Claude Code CLI
    /// on this computer. The page cannot start programs, so the app's local server
    /// answers (the same endpoints as server/claude-bridge.ts in the dev server):
    ///
    ///   GET  /api/claude-subscription/status    is Claude installed and signed in, and its models
    ///   POST /api/claude-subscription/login     run `claude auth login --claudeai` (opens Claude sign-in in the browser)
    ///   POST /api/claude-subscription/generate  { prompt, model? } -> { text }
    ///
    /// Sign-in, tokens and billing stay inside Claude. Claude runs with every tool
    /// turned off (no shell, no code, no web, no files), so a transcript or
    /// document can only be read and answered, never acted on. Only HuskyNote's
    /// own page may call these endpoints.
    /// </summary>
    public static class ClaudeBridge
    {
        private static readonly Regex ModelId = new(@"^[A-Za-z0-9][\w.-]{0,63}$");
        private const long MaxBodyBytes = 8 * 1024 * 1024;
        private static readonly TimeSpan RunTimeout = TimeSpan.FromMinutes(15);
        private static readonly TimeSpan CommandTimeout = TimeSpan.FromSeconds(20);
        private static readonly TimeSpan LoginTimeout = TimeSpan.FromMinutes(10);
        private static readonly SemaphoreSlim Runs = new(3);


        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        };

        private sealed record ClaudeModel(string Id, string Name, string Description);

        public static bool Handles(HttpListenerRequest req) =>
            req.Url?.AbsolutePath.StartsWith("/api/claude-subscription/", StringComparison.Ordinal) == true;

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
                if (path == "/api/claude-subscription/status" && req.HttpMethod == "GET")
                {
                    await Send(res, 200, await GetStatus());
                    return;
                }
                Command? exe = FindClaude();
                if (path == "/api/claude-subscription/login" && req.HttpMethod == "POST")
                {
                    if (exe == null) await Send(res, 404, new { error = "Claude Code is not installed on this computer." });
                    else await Send(res, 200, await StartLogin(exe));
                    return;
                }
                if (path == "/api/claude-subscription/generate" && req.HttpMethod == "POST")
                {
                    if (exe == null)
                    {
                        await Send(res, 404, new { error = "Claude Code is not installed on this computer." });
                        return;
                    }
                    string? body = await ReadBody(req);
                    if (body == null)
                    {
                        await Send(res, 413, new { error = "Request too large." });
                        return;
                    }
                    JsonDocument doc;
                    try { doc = JsonDocument.Parse(body); }
                    catch (JsonException) { await Send(res, 400, new { error = "Invalid request JSON." }); return; }
                    using var requestBody = doc;
                    if (doc.RootElement.ValueKind != JsonValueKind.Object)
                    {
                        await Send(res, 400, new { error = "Invalid request JSON." });
                        return;
                    }
                    string prompt = doc.RootElement.TryGetProperty("prompt", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? "" : "";
                    string? model = doc.RootElement.TryGetProperty("model", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null;
                    if (m.ValueKind != JsonValueKind.Undefined && m.ValueKind != JsonValueKind.String)
                    {
                        await Send(res, 400, new { error = "Invalid model." });
                        return;
                    }
                    if (string.IsNullOrWhiteSpace(prompt))
                    {
                        await Send(res, 400, new { error = "Nothing to send." });
                        return;
                    }
                    if (model != null && !ModelId.IsMatch(model))
                    {
                        await Send(res, 400, new { error = "Invalid model." });
                        return;
                    }
                    var (status, result) = await Generate(exe, prompt, model != null && ModelId.IsMatch(model) ? model : null);
                    await Send(res, status, result);
                    return;
                }
                await Send(res, 404, new { error = "Unknown Claude request." });
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

        private sealed record Command(string Exe, string[] Prefix);

        private static Command? FindClaude()
        {
            var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "")
                .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
                .Select(d => d.Trim().Trim('"')).ToList();
            dirs.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "bin"));
            foreach (string dir in dirs)
            {
                try { string file = Path.Combine(dir, "claude.exe"); if (File.Exists(file)) return new(file, Array.Empty<string>()); }
                catch { }
            }
            dirs.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm"));
            string? node = dirs.Select(d => Path.Combine(d, "node.exe")).FirstOrDefault(File.Exists);
            if (node == null) return null;
            foreach (string dir in dirs)
            {
                string cli = Path.Combine(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
                if (File.Exists(cli)) return new(node, new[] { cli });
            }
            return null;
        }

        private static string Workdir()
        {
            string dir = Path.Combine(Path.GetTempPath(), "huskynote-claude-subscription");
            Directory.CreateDirectory(dir);
            return dir;
        }

        private static ProcessStartInfo StartInfo(Command exe, IEnumerable<string> args, bool withInput)
        {
            var psi = new ProcessStartInfo(exe.Exe)
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
            foreach (string key in psi.Environment.Keys.ToArray())
                if (Regex.IsMatch(key, @"^ANTHROPIC_|^CLAUDE_CODE_USE_|^(CLAUDECODE|CLAUDE_CODE_SIMPLE|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_API_KEY|CLAUDE_CODE_BASE_URL|CLAUDE_CODE_SAFE_MODE|CLAUDE_CODE_BARE)", RegexOptions.IgnoreCase))
                    psi.Environment.Remove(key);
            psi.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1";
            psi.Environment["CLAUDE_CODE_SAFE_MODE"] = "1";
            foreach (string arg in exe.Prefix.Concat(args)) psi.ArgumentList.Add(arg);
            return psi;
        }

        private static async Task<(int Code, string Out, string Err)> Run(Command exe, IEnumerable<string> args, TimeSpan timeout, string? input = null)
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

        private static readonly ClaudeModel[] Models =
        {
            new("default", "Plan default", "Claude Code chooses the default model for your plan."),
            new("sonnet", "Claude Sonnet", "Balanced speed and capability. Availability depends on your plan."),
            new("opus", "Claude Opus", "For complex requests. Availability depends on your plan."),
            new("haiku", "Claude Haiku", "For quick requests. Availability depends on your plan."),
        };

        private static (bool LoggedIn, string? AuthMethod) ReadAuth(string output, int code)
        {
            try
            {
                using var doc = JsonDocument.Parse(output.Trim());
                var root = doc.RootElement;
                bool loggedIn = code == 0 && root.TryGetProperty("loggedIn", out var l) && l.ValueKind == JsonValueKind.True;
                string? method = loggedIn ? (root.TryGetProperty("authMethod", out var m) && m.GetString() == "claude.ai" ? "subscription" : "apikey") : null;
                return (loggedIn, method);
            }
            catch (JsonException) { return (false, null); }
        }

        private static async Task<object> GetStatus()
        {
            Command? exe = FindClaude();
            if (exe == null) return new { installed = false, loggedIn = false, models = Array.Empty<ClaudeModel>(), loginInProgress = false };
            var version = Run(exe, new[] { "--version" }, CommandTimeout);
            var auth = Run(exe, new[] { "--setting-sources", "", "auth", "status", "--json" }, CommandTimeout);
            await Task.WhenAll(version, auth);
            var (loggedIn, authMethod) = ReadAuth(auth.Result.Out, auth.Result.Code);
            var versionMatch = Regex.Match(version.Result.Out, @"\d+\.\d+\.\d+\S*");
            LoginState? login;
            string loginError;
            lock (LoginLock) { login = _login; loginError = _loginError; }
            return new
            {
                installed = true, version = versionMatch.Success ? versionMatch.Value : null,
                loggedIn, authMethod, models = Models, loginInProgress = login != null,
                loginUrl = login?.Url, loginError = string.IsNullOrEmpty(loginError) ? null : loginError,
            };
        }

        private sealed class LoginState
        {
            public string? Url;
        }

        private static readonly object LoginLock = new();
        private static LoginState? _login;
        private static string _loginError = "";

        private static async Task<object> StartLogin(Command exe)
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
            var process = new Process { StartInfo = StartInfo(exe, new[] { "--setting-sources", "", "auth", "login", "--claudeai" }, false), EnableRaisingEvents = true };
            void OnData(object _, DataReceivedEventArgs e)
            {
                if (e.Data == null) return;
                lock (output) output.AppendLine(e.Data);
                var match = Regex.Match(e.Data, @"https://(?:claude\.ai|console\.anthropic\.com|platform\.claude\.com)/[^\s\x1b]+");
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
                        _loginError = "Claude Code sign-in did not finish. Try again, or run claude auth login in a terminal.";
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

        private static List<string> ExecArgs(string workdir, string? model)
        {
            var args = new List<string>
            {
                "--print", "--output-format", "json", "--tools", "", "--disallowedTools", "*",
                "--strict-mcp-config", "--mcp-config", "{\"mcpServers\":{}}", "--disable-slash-commands",
                "--setting-sources", "", "--settings", "{\"disableAllHooks\":true}",
                "--no-chrome", "--no-session-persistence", "--permission-mode", "dontAsk",
            };
            if (model != null && model != "default" && ModelId.IsMatch(model)) { args.Add("--model"); args.Add(model); }
            return args;
        }

        private static (string Text, string Error) ReadEvents(string output)
        {
            try
            {
                using var doc = JsonDocument.Parse(output.Trim());
                var root = doc.RootElement;
                if (!root.TryGetProperty("type", out var t) || t.GetString() != "result") return ("", "Claude Code returned an unexpected response.");
                string result = root.TryGetProperty("result", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() ?? "" : "";
                if ((root.TryGetProperty("is_error", out var e) && e.ValueKind == JsonValueKind.True)
                    || !root.TryGetProperty("subtype", out var s) || s.GetString() != "success")
                {
                    string errors = root.TryGetProperty("errors", out var errorsList) && errorsList.ValueKind == JsonValueKind.Array
                        ? string.Join("\n", errorsList.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString())) : "";
                    return ("", errors != "" ? errors : result != "" ? result : "Claude Code could not finish the request.");
                }
                return (result.Trim(), "");
            }
            catch (JsonException) { return ("", "Claude Code did not return a valid response."); }
        }

        private static async Task<(int Status, object Body)> Generate(Command exe, string prompt, string? model)
        {
            await Runs.WaitAsync();
            try
            {
                var auth = await Run(exe, new[] { "--setting-sources", "", "auth", "status", "--json" }, CommandTimeout);
                if (ReadAuth(auth.Out, auth.Code).AuthMethod != "subscription")
                    return (401, new { error = "Sign in with your Claude subscription in Settings before sending requests." });
                var (code, output, errors) = await Run(exe, ExecArgs(Workdir(), model), RunTimeout, prompt);
                var (text, error) = ReadEvents(output);
                if (code == 0 && text != "" && error == "") return (200, new { text });
                string detail = error != ""
                    ? error
                    : errors.Split('\n').Select(l => l.Trim()).Where(l => l.Length > 0).LastOrDefault() ?? $"Claude stopped (exit code {code}).";
                return (502, new { error = detail });
            }
            finally
            {
                Runs.Release();
            }
        }
    }
}
