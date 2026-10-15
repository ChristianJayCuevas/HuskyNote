using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using HuskyNote.Install;

namespace HuskyNote.Uninstall
{
    /// <summary>Asks before removing HuskyNote, and offers (unticked) to delete the user's data too.</summary>
    public class UninstallForm : Form
    {
        [DllImport("dwmapi.dll", PreserveSig = true)]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

        private readonly string? _installDir;
        private readonly Label _statusLabel;
        private readonly CheckBox _deleteDataCheckBox;
        private readonly Button _uninstallButton;
        private readonly Button _cancelButton;

        /// <summary>0 when HuskyNote was removed, Program.Cancelled when cancelled, 1 on an error</summary>
        public int ExitCode { get; private set; } = Program.Cancelled;

        public UninstallForm(string? installDir)
        {
            _installDir = installDir;
            string dataFolder = InstallLayout.DataFolder;

            Text = "Uninstall HuskyNote";
            BackColor = Color.FromArgb(20, 20, 24);
            ForeColor = Color.White;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            Size = new Size(540, 330);

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            try
            {
                int useDarkMode = 1;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
            }
            catch { }

            var headerPanel = new Panel { Dock = DockStyle.Top, Height = 64, BackColor = Color.FromArgb(12, 12, 16) };
            Controls.Add(headerPanel);
            headerPanel.Controls.Add(new Label
            {
                Text = "Uninstall HuskyNote",
                Font = new Font("Segoe UI", 13, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(20, 18),
                AutoSize = true,
            });

            _statusLabel = new Label
            {
                Text = "This removes HuskyNote from this computer and closes it if it is running."
                    + Environment.NewLine + Environment.NewLine
                    + "Your notes, meetings, recordings and settings stay on this computer, so installing HuskyNote again brings them back.",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(210, 210, 220),
                Location = new Point(20, 80),
                Size = new Size(485, 80),
            };
            Controls.Add(_statusLabel);

            _deleteDataCheckBox = new CheckBox
            {
                Text = "Also delete my notes, meetings, recordings and settings",
                Checked = false,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f),
                Location = new Point(20, 168),
                AutoSize = true,
            };
            Controls.Add(_deleteDataCheckBox);

            Controls.Add(new Label
            {
                Text = dataFolder,
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(150, 150, 165),
                Location = new Point(38, 192),
                Size = new Size(467, 20),
                AutoEllipsis = true,
            });

            _uninstallButton = new Button
            {
                Text = "Uninstall",
                Location = new Point(305, 240),
                Size = new Size(100, 32),
                BackColor = Color.White,
                ForeColor = Color.Black,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
            };
            _uninstallButton.FlatAppearance.BorderSize = 0;
            _uninstallButton.Click += async (s, e) => await UninstallAsync();
            Controls.Add(_uninstallButton);

            _cancelButton = new Button
            {
                Text = "Cancel",
                Location = new Point(413, 240),
                Size = new Size(95, 32),
                BackColor = Color.FromArgb(40, 40, 48),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9),
                FlatStyle = FlatStyle.Flat,
                DialogResult = DialogResult.Cancel,
            };
            _cancelButton.FlatAppearance.BorderSize = 0;
            _cancelButton.Click += (s, e) => Close();
            Controls.Add(_cancelButton);
            CancelButton = _cancelButton;
        }

        private async Task UninstallAsync()
        {
            bool deleteData = _deleteDataCheckBox.Checked;
            if (deleteData)
            {
                var answer = MessageBox.Show(
                    this,
                    "Delete all your HuskyNote notes, meetings, recordings and settings from this computer?"
                        + Environment.NewLine + Environment.NewLine
                        + "This can't be undone. To keep a copy, cancel and save a backup in HuskyNote first (Settings → Storage).",
                    "Delete your HuskyNote data?",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2);
                if (answer != DialogResult.Yes) return;
            }

            _uninstallButton.Enabled = false;
            _cancelButton.Enabled = false;
            _deleteDataCheckBox.Enabled = false;

            try
            {
                await Task.Run(() => UninstallEngine.Run(_installDir, deleteData, message =>
                    BeginInvoke(new Action(() => _statusLabel.Text = message))));
                ExitCode = 0;
                MessageBox.Show(
                    this,
                    deleteData
                        ? "HuskyNote was uninstalled and your data was deleted."
                        : "HuskyNote was uninstalled. Your notes, meetings and settings are still in "
                            + Path.GetFullPath(InstallLayout.DataFolder) + ".",
                    "HuskyNote uninstalled",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                ExitCode = 1;
                _statusLabel.Text = "Uninstall didn't finish: " + ex.Message;
                _statusLabel.ForeColor = Color.Salmon;
                _cancelButton.Text = "Close";
                _cancelButton.Enabled = true;
            }
        }
    }
}
