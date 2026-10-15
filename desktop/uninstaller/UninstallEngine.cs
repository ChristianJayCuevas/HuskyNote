using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using HuskyNote.Install;
using Microsoft.Win32;

namespace HuskyNote.Uninstall
{
    public static class UninstallEngine
    {
        /// <summary>
        /// The HuskyNote install to remove: the folder this uninstaller runs from when HuskyNote is
        /// there (the normal case), otherwise the one registered in Apps &amp; features. Null when
        /// neither holds HuskyNote, so an uninstaller copied elsewhere never deletes a random folder.
        /// </summary>
        public static string? FindInstallDir()
        {
            string here = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar);
            if (File.Exists(Path.Combine(here, InstallLayout.AppExeName))) return here;

            using var key = Registry.CurrentUser.OpenSubKey(InstallLayout.UninstallKeyPath);
            string? registered = key?.GetValue("InstallLocation") as string;
            if (!string.IsNullOrWhiteSpace(registered) && File.Exists(Path.Combine(registered!, InstallLayout.AppExeName)))
            {
                return Path.GetFullPath(registered!).TrimEnd(Path.DirectorySeparatorChar);
            }
            return null;
        }

        /// <summary>
        /// Closes HuskyNote and removes its shortcuts, its Apps &amp; features entry and its program
        /// files. The user's data (InstallLayout.DataFolder) is deleted only when <paramref name="deleteData"/>.
        /// </summary>
        public static void Run(string? installDir, bool deleteData, Action<string>? progress = null)
        {
            progress?.Invoke("Closing HuskyNote...");
            CloseApp();

            progress?.Invoke("Removing shortcuts...");
            Retry(() => { if (File.Exists(InstallLayout.DesktopShortcut)) File.Delete(InstallLayout.DesktopShortcut); });
            Retry(() => { if (Directory.Exists(InstallLayout.StartMenuFolder)) Directory.Delete(InstallLayout.StartMenuFolder, true); });

            progress?.Invoke("Removing HuskyNote from Apps & features...");
            Registry.CurrentUser.DeleteSubKeyTree(InstallLayout.UninstallKeyPath, false);

            if (installDir != null && Directory.Exists(installDir))
            {
                progress?.Invoke("Removing program files...");
                RemoveProgramFiles(installDir);
            }

            if (deleteData)
            {
                progress?.Invoke("Deleting your HuskyNote data...");
                DeleteData(InstallLayout.DataFolder);
            }
        }

        private static void CloseApp()
        {
            foreach (var proc in Process.GetProcessesByName(InstallLayout.AppProcessName))
            {
                try
                {
                    proc.Kill();
                    proc.WaitForExit(5000);
                }
                catch (Exception ex)
                {
                    Trace.WriteLine($"[Close Warning] {ex.Message}");
                }
            }
        }

        /// <summary>The install folder still holding this uninstaller, removed by <see cref="RemoveOwnFolderAfterExit"/>.</summary>
        private static string? _ownFolder;

        /// <summary>
        /// Call last, right before the process exits: a hidden command removes the install folder (with
        /// this program in it) a moment later. Started any earlier, it could run while a message is
        /// still on screen and find this program's file in use.
        /// </summary>
        public static void RemoveOwnFolderAfterExit()
        {
            if (_ownFolder == null) return;
            Process.Start(new ProcessStartInfo("cmd.exe", $"/d /c ping -n 3 127.0.0.1 >nul & rmdir /s /q \"{_ownFolder}\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = Path.GetTempPath(),
            });
            _ownFolder = null;
        }

        /// <summary>
        /// Deletes everything in the install folder. This program can't delete its own file while it
        /// runs, so when it sits inside the folder, the folder is left for <see cref="RemoveOwnFolderAfterExit"/>.
        /// </summary>
        private static void RemoveProgramFiles(string installDir)
        {
            string self = Path.GetFullPath(Process.GetCurrentProcess().MainModule!.FileName);
            bool selfInside = string.Equals(Path.GetDirectoryName(self), installDir, StringComparison.OrdinalIgnoreCase);

            foreach (string dir in Directory.GetDirectories(installDir))
            {
                Retry(() => Directory.Delete(dir, true));
            }
            foreach (string file in Directory.GetFiles(installDir))
            {
                if (string.Equals(file, self, StringComparison.OrdinalIgnoreCase)) continue;
                Retry(() =>
                {
                    File.SetAttributes(file, FileAttributes.Normal);
                    File.Delete(file);
                });
            }

            if (selfInside)
            {
                _ownFolder = installDir;
            }
            else
            {
                Retry(() => Directory.Delete(installDir, true));
            }
        }

        /// <summary>Deletes the data folder, refusing anything that is clearly not one (a drive or a profile folder).</summary>
        private static void DeleteData(string dataFolder)
        {
            string full = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar);
            string?[] protectedFolders =
            {
                Path.GetPathRoot(full),
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            };
            foreach (string? folder in protectedFolders)
            {
                if (!string.IsNullOrEmpty(folder) && string.Equals(full, folder!.TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"Refusing to delete {full}: it is not a HuskyNote data folder.");
                }
            }
            // WebView2's helper processes can hold the profile for a few seconds after HuskyNote closes
            if (Directory.Exists(full)) Retry(() => Directory.Delete(full, true), attempts: 20);
        }

        private static void Retry(Action action, int attempts = 10)
        {
            for (int i = 1; ; i++)
            {
                try
                {
                    action();
                    return;
                }
                catch (Exception ex) when ((ex is IOException || ex is UnauthorizedAccessException) && i < attempts)
                {
                    Thread.Sleep(500);
                }
            }
        }
    }
}
