using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace HuskyNote
{
    public class StaticServer : IDisposable
    {
        private readonly HttpListener _listener;
        private readonly string _rootDirectory;
        private readonly int _port;
        private CancellationTokenSource? _cts;
        private Task? _listenerTask;

        private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".htm", "text/html; charset=utf-8" },
            { ".js", "application/javascript; charset=utf-8" },
            { ".mjs", "application/javascript; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".gif", "image/gif" },
            { ".webp", "image/webp" },
            { ".svg", "image/svg+xml" },
            { ".ico", "image/x-icon" },
            { ".wasm", "application/wasm" },
            { ".txt", "text/plain; charset=utf-8" },
            { ".mp3", "audio/mpeg" },
            { ".wav", "audio/wav" },
            { ".ogg", "audio/ogg" },
            { ".webm", "video/webm" }
        };

        public int Port => _port;
        public string BaseUrl => $"http://127.0.0.1:{_port}/";

        public StaticServer(string rootDirectory, int port = 5892)
        {
            _rootDirectory = Path.GetFullPath(rootDirectory);
            _port = port;
            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://127.0.0.1:{_port}/");
        }

        public void Start()
        {
            try
            {
                _listener.Start();
                _cts = new CancellationTokenSource();
                _listenerTask = Task.Run(() => ListenLoop(_cts.Token));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[StaticServer] Failed to start: {ex.Message}");
            }
        }

        private async Task ListenLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && _listener.IsListening)
            {
                try
                {
                    var context = await _listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequest(context));
                }
                catch (HttpListenerException) when (ct.IsCancellationRequested || !_listener.IsListening)
                {
                    break;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[StaticServer] Context error: {ex.Message}");
                }
            }
        }

        private void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Range");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            try
            {
                string rawPath = req.Url?.AbsolutePath.TrimStart('/') ?? "";
                if (string.IsNullOrEmpty(rawPath))
                {
                    rawPath = "index.html";
                }

                string filePath = Path.Combine(_rootDirectory, rawPath.Replace('/', Path.DirectorySeparatorChar));

                if (Directory.Exists(filePath))
                {
                    filePath = Path.Combine(filePath, "index.html");
                }

                // SPA Fallback: If file doesn't exist, serve index.html
                if (!File.Exists(filePath))
                {
                    filePath = Path.Combine(_rootDirectory, "index.html");
                }

                if (!File.Exists(filePath))
                {
                    res.StatusCode = 404;
                    byte[] notFound = "File Not Found"u8.ToArray();
                    res.ContentLength64 = notFound.Length;
                    res.OutputStream.Write(notFound, 0, notFound.Length);
                    res.Close();
                    return;
                }

                string ext = Path.GetExtension(filePath);
                res.ContentType = MimeTypes.TryGetValue(ext, out var mime) ? mime : "application/octet-stream";

                byte[] bytes = File.ReadAllBytes(filePath);
                res.ContentLength64 = bytes.Length;
                res.StatusCode = 200;

                if (req.HttpMethod != "HEAD")
                {
                    res.OutputStream.Write(bytes, 0, bytes.Length);
                }
                res.Close();
            }
            catch (Exception ex)
            {
                try
                {
                    res.StatusCode = 500;
                    byte[] err = System.Text.Encoding.UTF8.GetBytes(ex.Message);
                    res.ContentLength64 = err.Length;
                    res.OutputStream.Write(err, 0, err.Length);
                    res.Close();
                }
                catch { }
            }
        }

        public void Stop()
        {
            try
            {
                _cts?.Cancel();
                if (_listener.IsListening)
                {
                    _listener.Stop();
                }
            }
            catch { }
        }

        public void Dispose()
        {
            Stop();
            try { _listener.Close(); } catch { }
        }
    }
}
