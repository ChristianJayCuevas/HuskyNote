using System;
using System.Linq;
using System.Windows.Forms;

namespace HuskyNote.Setup
{
    internal static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            bool isSilent = args.Any(a =>
                string.Equals(a, "/S", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(a, "/silent", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(a, "--quiet", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(a, "-s", StringComparison.OrdinalIgnoreCase)
            );

            if (isSilent)
            {
                try
                {
                    Console.WriteLine("[HuskyNote Setup] Starting silent installation...");
                    InstallerEngine.ExecuteInstall(null, (msg, pct) =>
                    {
                        Console.WriteLine($"[{pct}%] {msg}");
                    });
                    Console.WriteLine("[HuskyNote Setup] Installation complete.");
                    Environment.Exit(0);
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("[HuskyNote Setup Error] " + ex.Message);
                    Environment.Exit(1);
                }
                return;
            }

            ApplicationConfiguration.Initialize();
            Application.Run(new SetupForm());
        }
    }
}
