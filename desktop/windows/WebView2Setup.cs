using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace HuskyNote
{
    /// <summary>
    /// HuskyNote's window is a WebView2 control, which needs Microsoft's WebView2 Runtime. Windows 11
    /// and most Windows 10 computers have it; on one that doesn't, offer to install it before the
    /// window opens instead of showing a blank window.
    /// </summary>
    internal static class WebView2Setup
    {
        /// <summary>Microsoft's Evergreen Bootstrapper: a small download that installs the current runtime</summary>
        private const string BootstrapperUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
        private const string DownloadPage = "https://developer.microsoft.com/microsoft-edge/webview2/";
        private const string Title = "HuskyNote needs WebView2";

        /// <summary>The installed runtime's version, or null when there is none.</summary>
        public static string? InstalledVersion()
        {
            try
            {
                return CoreWebView2Environment.GetAvailableBrowserVersionString();
            }
            catch (WebView2RuntimeNotFoundException)
            {
                return null;
            }
        }

        /// <summary>True when the runtime is there, or the person just installed it; false to quit.</summary>
        public static bool EnsureRuntime()
        {
            if (InstalledVersion() != null) return true;

            var answer = MessageBox.Show(
                Lines(
                    "HuskyNote needs the Microsoft Edge WebView2 Runtime, a free Microsoft component that shows the app's window. Most Windows 10 and 11 computers already have it, but this one doesn't.",
                    "Install it now? It downloads from Microsoft and takes about a minute."),
                Title,
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Information);
            if (answer != DialogResult.Yes)
            {
                OpenDownloadPage();
                return false;
            }

            try
            {
                string setup = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
                using (var client = new HttpClient { Timeout = TimeSpan.FromMinutes(2) })
                using (var download = client.GetStreamAsync(BootstrapperUrl).GetAwaiter().GetResult())
                using (var file = File.Create(setup))
                {
                    download.CopyTo(file);
                }
                // Shows Microsoft's own installer, which asks for permission if it needs it
                using var installer = Process.Start(new ProcessStartInfo(setup) { UseShellExecute = true });
                installer?.WaitForExit();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    Lines(
                        $"HuskyNote couldn't download the WebView2 Runtime ({ex.Message}).",
                        "Check your internet connection, or install it from Microsoft's page, which opens next. Then start HuskyNote again."),
                    Title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                OpenDownloadPage();
                return false;
            }

            if (InstalledVersion() != null) return true;
            MessageBox.Show(
                "The WebView2 Runtime isn't installed yet. If its setup is still finishing, wait a moment and start HuskyNote again.",
                Title,
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return false;
        }

        private static string Lines(params string[] paragraphs) =>
            string.Join(Environment.NewLine + Environment.NewLine, paragraphs);

        private static void OpenDownloadPage()
        {
            try
            {
                Process.Start(new ProcessStartInfo(DownloadPage) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Trace.WriteLine($"[WebView2] Could not open the download page: {ex.Message}");
            }
        }
    }
}
