using System;
using System.Linq;
using System.Windows.Forms;

namespace HuskyNote.Uninstall
{
    internal static class Program
    {
        /// <summary>Exit code when the person cancels (the Windows Installer convention)</summary>
        public const int Cancelled = 1602;

        /// <summary>
        /// uninstall.exe            asks first (Apps &amp; features runs this)
        /// uninstall.exe /S         removes HuskyNote without asking and keeps the user's data
        /// uninstall.exe /S --delete-data   also deletes the data
        /// Exits 0 when HuskyNote was removed, 1602 when cancelled, 1 on an error.
        /// </summary>
        [STAThread]
        static int Main(string[] args)
        {
            bool Has(params string[] flags) => args.Any(a => flags.Any(f => string.Equals(a, f, StringComparison.OrdinalIgnoreCase)));
            bool silent = Has("/S", "/silent", "--quiet", "-s");
            bool deleteData = Has("--delete-data", "/deletedata");
            string? installDir = UninstallEngine.FindInstallDir();

            if (silent)
            {
                try
                {
                    UninstallEngine.Run(installDir, deleteData, message => Console.WriteLine(message));
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("[HuskyNote Uninstall Error] " + ex.Message);
                    return 1;
                }
                finally
                {
                    UninstallEngine.RemoveOwnFolderAfterExit();
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            int exitCode;
            using (var form = new UninstallForm(installDir))
            {
                Application.Run(form);
                exitCode = form.ExitCode;
            }
            UninstallEngine.RemoveOwnFolderAfterExit();
            return exitCode;
        }
    }
}
