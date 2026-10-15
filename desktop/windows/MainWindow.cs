using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HuskyNote
{
    public class MainWindow : Form
    {
        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        private readonly WebView2 _webView;
        private readonly NotifyIcon _trayIcon;
        private readonly ContextMenuStrip _trayMenu;
        private readonly ToolStripMenuItem _statusMenuItem;
        private readonly System.Windows.Forms.Timer _ollamaTimer;

        // Window layout to restore when leaving full screen
        private FormBorderStyle _borderBeforeFullScreen = FormBorderStyle.Sizable;
        private FormWindowState _stateBeforeFullScreen = FormWindowState.Normal;
        private bool _isFullScreen;
        private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(1.5) };

        private bool _isOllamaOnline = false;
        private bool _isExiting = false;
        private StaticServer? _staticServer;
        private readonly string[] _args;

        public MainWindow(string[] args)
        {
            _args = args;

            // Form properties
            Text = "HuskyNote";
            BackColor = Color.Black;
            ForeColor = Color.White;
            StartPosition = FormStartPosition.CenterScreen;

            var screen = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1440, 900);
            int initialWidth = Math.Min(1360, (int)(screen.Width * 0.92));
            int initialHeight = Math.Min(880, (int)(screen.Height * 0.88));
            Size = new Size(initialWidth, initialHeight);
            MinimumSize = new Size(800, 600);

            // Set Window Icon
            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "favicon.ico");
            if (File.Exists(iconPath))
            {
                Icon = new Icon(iconPath);
            }

            // Enable Immersive Dark Mode for Window Title Bar (Windows 10 / 11)
            try
            {
                int useDarkMode = 1;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
            }
            catch { }

            // Initialize WebView2
            _webView = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = Color.Black
            };
            Controls.Add(_webView);

            // Context Menu & Tray Setup
            _trayMenu = new ContextMenuStrip
            {
                RenderMode = ToolStripRenderMode.System,
                ShowImageMargin = false
            };

            var headerItem = new ToolStripMenuItem("HuskyNote — Your Personal AI Secretary")
            {
                Enabled = false,
                Font = new Font(Font, FontStyle.Bold)
            };
            _trayMenu.Items.Add(headerItem);

            _statusMenuItem = new ToolStripMenuItem("● AI Ready (Ollama)")
            {
                Enabled = false,
                ForeColor = Color.Gray
            };
            _trayMenu.Items.Add(_statusMenuItem);
            _trayMenu.Items.Add(new ToolStripSeparator());

            _trayMenu.Items.Add("Open HuskyNote", null, (s, e) => ShowAndActivate());
            _trayMenu.Items.Add("New Note", null, (s, e) => { ShowAndActivate(); NavigateTo("notes", "new"); });
            _trayMenu.Items.Add("Husky Notes Focus Mode", null, (s, e) => { ShowAndActivate(); NavigateTo("zen"); });
            _trayMenu.Items.Add("Start Meeting / Voice Note", null, (s, e) => { ShowAndActivate(); NavigateTo("meetings", "record"); });
            _trayMenu.Items.Add("Schedule & Calendar", null, (s, e) => { ShowAndActivate(); NavigateTo("schedule"); });
            _trayMenu.Items.Add("Screen Recorder Studio", null, (s, e) => { ShowAndActivate(); NavigateTo("studio"); });
            _trayMenu.Items.Add("Toggle Quick Bar", null, (s, e) => ToggleHud());
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add("Settings...", null, (s, e) => { ShowAndActivate(); NavigateTo("settings"); });
            _trayMenu.Items.Add("About HuskyNote", null, (s, e) => { ShowAndActivate(); NavigateTo("about"); });
            _trayMenu.Items.Add(new ToolStripSeparator());
            _trayMenu.Items.Add("Quit HuskyNote", null, (s, e) => ExitApplication());

            _trayIcon = new NotifyIcon
            {
                Icon = Icon ?? SystemIcons.Application,
                Text = "HuskyNote — Your Personal AI Secretary",
                ContextMenuStrip = _trayMenu,
                Visible = true
            };
            _trayIcon.DoubleClick += (s, e) => ShowAndActivate();

            // Ollama Health Check Timer (matches 8s interval in desktop/main.swift)
            _ollamaTimer = new System.Windows.Forms.Timer { Interval = 8000 };
            _ollamaTimer.Tick += async (s, e) => await CheckOllamaHealthAsync();
            _ollamaTimer.Start();

            // Load Content on startup
            Load += async (s, e) =>
            {
                await InitializeWebViewAsync();
                await CheckOllamaHealthAsync();
            };
        }

        private async Task InitializeWebViewAsync()
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string userDataFolder = Path.Combine(localAppData, "HuskyNote", "WebView2Data");

                // Another data folder, for testing a build or a copy of someone's data without touching
                // the real one (DomoNote data is then left where it is)
                string? customDataFolder = Environment.GetEnvironmentVariable("HUSKYNOTE_USER_DATA_DIR");
                if (!string.IsNullOrWhiteSpace(customDataFolder)) userDataFolder = customDataFolder;

                // Carry over notes and settings stored by pre-rebrand DomoNote builds
                string legacyUserDataFolder = Path.Combine(localAppData, "DomoNote", "WebView2Data");
                if (string.IsNullOrWhiteSpace(customDataFolder) && !Directory.Exists(userDataFolder) && Directory.Exists(legacyUserDataFolder))
                {
                    try
                    {
                        Directory.CreateDirectory(Path.Combine(localAppData, "HuskyNote"));
                        Directory.Move(legacyUserDataFolder, userDataFolder);
                    }
                    catch (Exception ex)
                    {
                        // Keep using the legacy folder rather than starting with an empty workspace
                        System.Diagnostics.Trace.WriteLine($"[Migration Warning] {ex.Message}");
                        userDataFolder = legacyUserDataFolder;
                    }
                }

                var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
                await _webView.EnsureCoreWebView2Async(env);

                // Enable autoplay, clipboard, and developer tools
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                // Portable backups use a normal file, outside WebView2's private data directory.
                // Keep WebView2's download progress/error UI; only choose the destination here.
                _webView.CoreWebView2.DownloadStarting += (sender, args) =>
                {
                    if (!string.Equals(Path.GetExtension(args.ResultFilePath), ".huskybackup", StringComparison.OrdinalIgnoreCase)) return;
                    var deferral = args.GetDeferral();
                    BeginInvoke(new Action(() =>
                    {
                        using (deferral)
                        using (var dialog = new SaveFileDialog
                        {
                            Title = "Save HuskyNote backup",
                            FileName = Path.GetFileName(args.ResultFilePath),
                            Filter = "HuskyNote backup (*.huskybackup)|*.huskybackup",
                            DefaultExt = "huskybackup",
                            AddExtension = true,
                            OverwritePrompt = true
                        })
                        {
                            if (dialog.ShowDialog(this) == DialogResult.OK) args.ResultFilePath = dialog.FileName;
                            else args.Cancel = true;
                        }
                    }));
                };

                // Grant microphone and screen capture permissions automatically
                _webView.CoreWebView2.PermissionRequested += (s, e) =>
                {
                    if (e.PermissionKind == CoreWebView2PermissionKind.Microphone ||
                        e.PermissionKind == CoreWebView2PermissionKind.Camera ||
                        e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead)
                    {
                        e.State = CoreWebView2PermissionState.Allow;
                    }
                };

                // The web app requests full screen on F11; a WebView2 host has to resize its own window
                _webView.CoreWebView2.ContainsFullScreenElementChanged += (s, e) =>
                    SetFullScreen(_webView.CoreWebView2.ContainsFullScreenElement);

                string targetUrl = await DetermineTargetUrlAsync();
                _webView.CoreWebView2.Navigate(targetUrl);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Error initializing HuskyNote Web Interface:\n{ex.Message}\n\nPlease ensure Microsoft Edge WebView2 Runtime is installed.",
                    "HuskyNote Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        /// <summary>
        /// Borderless and maximized while the page is full screen, restoring the
        /// previous border and window state afterwards.
        /// </summary>
        private void SetFullScreen(bool fullScreen)
        {
            if (fullScreen == _isFullScreen) return;
            _isFullScreen = fullScreen;
            if (fullScreen)
            {
                _borderBeforeFullScreen = FormBorderStyle;
                _stateBeforeFullScreen = WindowState;
                FormBorderStyle = FormBorderStyle.None;
                // Re-maximize so the borderless window covers the taskbar too
                WindowState = FormWindowState.Normal;
                WindowState = FormWindowState.Maximized;
            }
            else
            {
                FormBorderStyle = _borderBeforeFullScreen;
                WindowState = _stateBeforeFullScreen;
            }
        }

        private async Task<string> DetermineTargetUrlAsync()
        {
            bool isDevArg = Array.Exists(_args, a => string.Equals(a, "--dev", StringComparison.OrdinalIgnoreCase));

            if (isDevArg)
            {
                int[] devPorts = { 5173, 5174, 5175, 5176 };
                foreach (int port in devPorts)
                {
                    if (await IsPortOpenAsync(port))
                    {
                        return $"http://127.0.0.1:{port}/";
                    }
                }
            }

            // Check bundled web resources (shipped with HuskyNote in ./web or ../dist)
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] possibleWebDirs = {
                Path.Combine(baseDir, "web"),
                Path.Combine(baseDir, "..", "dist"),
                Path.Combine(baseDir, "..", "..", "..", "dist"),
                Path.Combine(baseDir, "dist")
            };

            foreach (var candidate in possibleWebDirs)
            {
                string indexPath = Path.Combine(candidate, "index.html");
                if (File.Exists(indexPath))
                {
                    _staticServer = new StaticServer(candidate, 5892);
                    _staticServer.Start();
                    return _staticServer.BaseUrl;
                }
            }

            // Fallback: check dev ports if static resources not found
            int[] fallbackPorts = { 5173, 5174, 5175, 5176 };
            foreach (int port in fallbackPorts)
            {
                if (await IsPortOpenAsync(port))
                {
                    return $"http://127.0.0.1:{port}/";
                }
            }

            // Default fallback
            return "http://127.0.0.1:5173/";
        }

        private async Task<bool> IsPortOpenAsync(int port)
        {
            try
            {
                using var res = await _http.GetAsync($"http://127.0.0.1:{port}/");
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private async Task CheckOllamaHealthAsync()
        {
            try
            {
                var res = await _http.GetAsync("http://127.0.0.1:11434/api/tags");
                bool online = res.IsSuccessStatusCode;
                if (_isOllamaOnline != online)
                {
                    _isOllamaOnline = online;
                    _statusMenuItem.Text = online ? "● AI Active (Ollama)" : "● AI Ready (Ollama Offline)";
                    _statusMenuItem.ForeColor = online ? Color.ForestGreen : Color.Gray;
                }
            }
            catch
            {
                if (_isOllamaOnline)
                {
                    _isOllamaOnline = false;
                    _statusMenuItem.Text = "● AI Ready (Ollama Offline)";
                    _statusMenuItem.ForeColor = Color.Gray;
                }
            }
        }

        public void ShowAndActivate()
        {
            Show();
            if (WindowState == FormWindowState.Minimized)
            {
                WindowState = FormWindowState.Normal;
            }
            BringToFront();
            Activate();
        }

        public void NavigateTo(string view, string? action = null)
        {
            if (_webView.CoreWebView2 == null) return;
            string actionScript = string.IsNullOrEmpty(action) ? "" : $", action: '{action}'";
            string script = $"window.dispatchEvent(new CustomEvent('huskynote:navigate', {{ detail: {{ view: '{view}'{actionScript} }} }}))";
            _webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        public void ToggleHud()
        {
            if (_webView.CoreWebView2 == null) return;
            _webView.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('huskynote:toggle-hud'))");
        }

        public void ExitApplication()
        {
            _isExiting = true;
            _ollamaTimer.Stop();
            _staticServer?.Dispose();
            _trayIcon.Visible = false;
            Application.Exit();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!_isExiting && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide();
                _trayIcon.ShowBalloonTip(
                    2000,
                    "HuskyNote Running",
                    "HuskyNote is still running in the background. Double-click this icon to reopen.",
                    ToolTipIcon.Info
                );
                return;
            }
            base.OnFormClosing(e);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _ollamaTimer?.Dispose();
                _trayIcon?.Dispose();
                _trayMenu?.Dispose();
                _staticServer?.Dispose();
                _http?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
