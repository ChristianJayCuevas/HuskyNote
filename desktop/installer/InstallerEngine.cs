using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using Microsoft.Win32;

namespace HuskyNote.Setup
{
    public static class InstallerEngine
    {
        public static string DefaultInstallDir => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "HuskyNote"
        );

        public static void ExecuteInstall(string? targetDir, Action<string, int>? progress = null)
        {
            string installDir = string.IsNullOrWhiteSpace(targetDir) ? DefaultInstallDir : targetDir;

            progress?.Invoke("Removing previous DomoNote installation if present...", 5);
            RemoveLegacyDomoNoteInstall();

            progress?.Invoke($"Preparing installation directory: {installDir}", 10);
            Directory.CreateDirectory(installDir);

            progress?.Invoke("Extracting application bundle...", 25);
            ExtractBundle(installDir);

            progress?.Invoke("Creating Desktop shortcut with official icon...", 60);
            CreateDesktopShortcut(installDir);

            progress?.Invoke("Creating Start Menu shortcut...", 75);
            CreateStartMenuShortcut(installDir);

            progress?.Invoke("Creating uninstaller and registering in Windows Settings...", 85);
            CreateUninstaller(installDir);
            RegisterWindowsUninstall(installDir);

            progress?.Invoke("Checking local Ollama service...", 95);
            CheckOllamaStatus();

            progress?.Invoke("Installation completed successfully!", 100);
        }

        /// <summary>
        /// Removes a pre-rebrand DomoNote install (program files, shortcuts, uninstall entry).
        /// User data in %LOCALAPPDATA%\DomoNote\WebView2Data is kept; HuskyNote migrates it on first launch.
        /// </summary>
        private static void RemoveLegacyDomoNoteInstall()
        {
            foreach (var proc in Process.GetProcessesByName("DomoNote"))
            {
                try { proc.Kill(); proc.WaitForExit(3000); } catch { }
            }

            string legacyInstallDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "DomoNote"
            );
            string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "DomoNote.lnk");
            string startMenuFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "DomoNote");

            try { if (File.Exists(desktopLnk)) File.Delete(desktopLnk); } catch (Exception ex) { Trace.WriteLine($"[Legacy Cleanup Warning] {ex.Message}"); }
            try { if (Directory.Exists(startMenuFolder)) Directory.Delete(startMenuFolder, true); } catch (Exception ex) { Trace.WriteLine($"[Legacy Cleanup Warning] {ex.Message}"); }
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\DomoNote", false); } catch (Exception ex) { Trace.WriteLine($"[Legacy Cleanup Warning] {ex.Message}"); }
            try { if (Directory.Exists(legacyInstallDir)) Directory.Delete(legacyInstallDir, true); } catch (Exception ex) { Trace.WriteLine($"[Legacy Cleanup Warning] {ex.Message}"); }
        }

        private static void ExtractBundle(string destDir)
        {
            var asm = Assembly.GetExecutingAssembly();
            string? resourceName = asm.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("bundle.zip", StringComparison.OrdinalIgnoreCase));

            if (resourceName != null)
            {
                using var stream = asm.GetManifestResourceStream(resourceName);
                if (stream != null)
                {
                    using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
                    archive.ExtractToDirectory(destDir, overwriteFiles: true);
                    return;
                }
            }

            // Fallback: Check adjacent bundle.zip
            string adjacentBundle = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bundle.zip");
            if (File.Exists(adjacentBundle))
            {
                ZipFile.ExtractToDirectory(adjacentBundle, destDir, overwriteFiles: true);
                return;
            }

            throw new InvalidOperationException("Embedded resource 'bundle.zip' was not found in the installer binary.");
        }

        private static void CreateDesktopShortcut(string installDir)
        {
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string shortcutPath = Path.Combine(desktopDir, "HuskyNote.lnk");
            string targetExe = Path.Combine(installDir, "HuskyNote.exe");
            string iconLocation = Path.Combine(installDir, "favicon.ico");

            CreateShortcut(shortcutPath, targetExe, iconLocation, "HuskyNote — Your Personal AI Secretary");
        }

        private static void CreateStartMenuShortcut(string installDir)
        {
            string startMenuDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                "Programs", "HuskyNote"
            );
            Directory.CreateDirectory(startMenuDir);

            string shortcutPath = Path.Combine(startMenuDir, "HuskyNote.lnk");
            string targetExe = Path.Combine(installDir, "HuskyNote.exe");
            string iconLocation = Path.Combine(installDir, "favicon.ico");

            CreateShortcut(shortcutPath, targetExe, iconLocation, "HuskyNote — Your Personal AI Secretary");
        }

        private static void CreateShortcut(string shortcutPath, string targetPath, string iconPath, string description)
        {
            try
            {
                Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType)!;
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                    shortcut.Description = description;
                    if (File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath;
                    }
                    shortcut.Save();
                }
            }
            catch (Exception ex)
            {
                Trace.WriteLine($"[Shortcut Warning] {ex.Message}");
            }
        }

        private static void CreateUninstaller(string installDir)
        {
            string uninstallBat = Path.Combine(installDir, "uninstall.bat");
            string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "HuskyNote.lnk");
            string startMenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "HuskyNote", "HuskyNote.lnk");
            string startMenuFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "HuskyNote");

            string uninstallContent = $@"@echo off
title HuskyNote Uninstaller
echo ========================================================
echo   Uninstalling HuskyNote...
echo ========================================================
taskkill /f /im HuskyNote.exe >nul 2>nul
del /f /q ""{desktopLnk}"" 2>nul
del /f /q ""{startMenuLnk}"" 2>nul
rmdir /s /q ""{startMenuFolder}"" 2>nul
reg delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\HuskyNote"" /f >nul 2>nul
echo HuskyNote shortcuts and registry entries removed.
echo Removing installation directory...
cd /d ""%USERPROFILE%""
rmdir /s /q ""{installDir}"" 2>nul
echo HuskyNote uninstallation complete.
";
            File.WriteAllText(uninstallBat, uninstallContent);
        }

        private static void RegisterWindowsUninstall(string installDir)
        {
            try
            {
                using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\HuskyNote");
                key.SetValue("DisplayName", "HuskyNote");
                key.SetValue("DisplayVersion", "1.0.0");
                key.SetValue("Publisher", "ChristianJayCuevas");
                key.SetValue("InstallLocation", installDir);
                key.SetValue("DisplayIcon", Path.Combine(installDir, "favicon.ico"));
                key.SetValue("UninstallString", $"\"{Path.Combine(installDir, "uninstall.bat")}\"");
                key.SetValue("URLInfoAbout", "https://github.com/ChristianJayCuevas/HuskyNote");
                key.SetValue("HelpLink", "https://github.com/ChristianJayCuevas/HuskyNote");
            }
            catch (Exception ex)
            {
                Trace.WriteLine($"[Registry Warning] {ex.Message}");
            }
        }

        public static bool CheckOllamaStatus()
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1.5) };
                var res = client.GetAsync("http://127.0.0.1:11434/api/tags").GetAwaiter().GetResult();
                return res.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public static void LaunchInstalledApp(string installDir)
        {
            string exePath = Path.Combine(installDir, "HuskyNote.exe");
            if (File.Exists(exePath))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = installDir,
                    UseShellExecute = true
                });
            }
        }
    }
}
