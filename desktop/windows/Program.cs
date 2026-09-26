using System;
using System.Threading;
using System.Windows.Forms;

namespace HuskyNote
{
    internal static class Program
    {
        private static Mutex? _mutex;

        [STAThread]
        static void Main(string[] args)
        {
            const string mutexName = "Global\\HuskyNote_Desktop_SingleInstance";
            _mutex = new Mutex(true, mutexName, out bool createdNew);

            if (!createdNew)
            {
                // Another instance is already running
                MessageBox.Show(
                    "HuskyNote is already running. Check your system tray (notification area).",
                    "HuskyNote",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            ApplicationConfiguration.Initialize();
            Application.Run(new MainWindow(args));

            _mutex.ReleaseMutex();
        }
    }
}
