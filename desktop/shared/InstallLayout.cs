using System;
using System.IO;

namespace HuskyNote.Install
{
    /// <summary>
    /// Where a per-user HuskyNote install puts things. Shared by the installer and the uninstaller
    /// (linked into both projects) so they always agree.
    /// </summary>
    public static class InstallLayout
    {
        public const string AppProcessName = "HuskyNote";
        public const string AppExeName = "HuskyNote.exe";
        public const string UninstallerExeName = "uninstall.exe";
        public const string UninstallKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\HuskyNote";

        private static string LocalAppData => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        public static string DefaultInstallDir => Path.Combine(LocalAppData, "Programs", "HuskyNote");

        public static string DesktopShortcut =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "HuskyNote.lnk");

        public static string StartMenuFolder =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "HuskyNote");

        /// <summary>
        /// The user's notes, meetings, recordings and settings (the app's WebView2 profile lives inside).
        /// HUSKYNOTE_USER_DATA_DIR, which points the app at another folder for testing, points here too.
        /// </summary>
        public static string DataFolder
        {
            get
            {
                string? custom = Environment.GetEnvironmentVariable("HUSKYNOTE_USER_DATA_DIR");
                return string.IsNullOrWhiteSpace(custom) ? Path.Combine(LocalAppData, "HuskyNote") : custom!;
            }
        }
    }
}
