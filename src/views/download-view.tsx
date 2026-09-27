import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useTheme } from '../context/theme-context';
import { Button } from '../components/ui/button';
import { PhysicsRopeToggle } from '../components/ui/physics-rope-toggle';
import {
  Download,
  Terminal,
  CheckCircle,
  Copy,
  Check,
  Shield,
  ArrowRight,
  ExternalLink,
  Cpu,
  ArrowLeft,
  Layers,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { GithubIcon } from '../components/ui/github-icon';
import { ChromeIcon } from '../components/ui/chrome-icon';
import { ChromeExtensionModal } from '../components/modals/chrome-extension-modal';

export type SupportedOS = 'macos' | 'windows' | 'linux';

// Original OS Vector Icons
export const AppleIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 170 170" fill="currentColor" className={className} aria-label="Apple Logo">
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.6-7.85-11.75-14.44-6.19-9.88-11.16-21.2-14.92-33.95-3.76-12.75-5.64-24.36-5.64-34.82 0-14.9 3.8-27.14 11.4-36.73 7.6-9.59 17.13-14.48 28.6-14.67 4.89 0 10.32 1.34 16.29 4.02 5.97 2.68 9.94 4.08 11.9 4.2 1.52-.12 5.67-1.57 12.44-4.35 6.78-2.78 12.51-4.05 17.2-3.8 12.82.74 22.89 5.56 30.2 14.47-11.29 6.84-16.82 16.42-16.58 28.74.24 9.69 4.04 17.81 11.39 24.36 7.35 6.55 16.08 10.23 26.2 11.04-2.29 7.08-4.88 13.82-7.77 20.21zm-32.99-106.8c0-7.39 2.67-14.28 8.01-20.67 5.34-6.39 12.04-10.45 20.1-12.18.54 3.7.35 7.42-.57 11.16-.92 3.74-2.58 7.37-4.98 10.9-2.5 3.65-5.59 6.72-9.28 9.22-3.69 2.5-7.6 4.02-11.73 4.56-.22-.98-.44-1.98-.65-2.99z" />
  </svg>
);

export const WindowsIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 88 88" fill="currentColor" className={className} aria-label="Windows Logo">
    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.202L0 12.402zm35.67 33.529l.028 34.453L.028 75.48.001 46.133l35.669-.202zm4.326-39.027L87.914 0v41.527l-47.918.378V6.904zm47.918 39.46v41.636L39.996 81.1l-.013-34.922 47.931.186z" />
  </svg>
);

// Authentic Official Tux the Penguin Linux Vector
export const LinuxTuxIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Linux Tux Logo">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z" />
  </svg>
);

export const DownloadView: React.FC = () => {
  const { setActiveView, addToast } = useWorkspace();
  const { theme } = useTheme();

  // Detect user operating system and architecture
  const detectedOS = useMemo<SupportedOS>(() => {
    if (typeof navigator === 'undefined') return 'macos';
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = (navigator as any).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();

    if (platform.includes('win') || userAgent.includes('windows')) return 'windows';
    if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) return 'macos';
    if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) return 'linux';
    return 'macos';
  }, []);

  const isAppleSilicon = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    const cores = navigator.hardwareConcurrency || 4;
    return (platform.includes('mac') || ua.includes('macintosh')) && cores >= 8;
  }, []);

  const [selectedOS, setSelectedOS] = useState<SupportedOS>(detectedOS);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
    addToast('Terminal command copied to clipboard.', 'info');
  };

  const GITHUB_REPO = 'https://github.com/ChristianJayCuevas/HuskyNote';
  const GITHUB_RELEASE_BASE = `${GITHUB_REPO}/releases/latest/download`;

  const handleDownload = async (filename: string, osName: string) => {
    // ─── Binary Package Downloads (.dmg, .exe, .zip, .AppImage, .deb) ────────
    if (
      filename.endsWith('.exe') ||
      filename.endsWith('.zip') ||
      filename.endsWith('.dmg') ||
      filename.endsWith('.AppImage') ||
      filename.endsWith('.deb')
    ) {
      const localUrl = `/downloads/${filename}`;
      const releaseUrl = `${GITHUB_RELEASE_BASE}/${filename}`;

      const triggerFileDownload = (url: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 500);
      };

      // Probe local static server first (works if served locally or from Vercel static)
      try {
        const res = await fetch(localUrl, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
        const ctype = res.headers.get('content-type') || '';
        if (res.ok && !ctype.includes('text/html')) {
          triggerFileDownload(localUrl);
          const label = filename.endsWith('.dmg')
            ? 'macOS Disk Image (.dmg)'
            : filename.endsWith('.exe')
            ? 'Windows Installer (.exe)'
            : filename;
          addToast(`Downloading ${label}. Open the DMG to install HuskyNote.`, 'success');
          return;
        }
      } catch {
        // Local probe failed — fallback to direct GitHub Releases download
      }

      // Direct binary download from GitHub release asset (genuine 21MB .dmg / .exe)
      triggerFileDownload(releaseUrl);

      const label = filename.endsWith('.dmg')
        ? 'macOS Disk Image (.dmg)'
        : filename.endsWith('.exe')
        ? 'Windows Installer (.exe)'
        : filename.endsWith('.zip')
        ? 'Windows Portable Package (.zip)'
        : 'Linux package';

      addToast(`Downloading ${label} (${filename}).`, 'success');
      return;
    }

    const isWindows = osName.toLowerCase().includes('windows') || filename.endsWith('.bat');
    let blobContent = '';
    let mimeType = 'text/plain';

    if (isWindows) {
      mimeType = 'application/x-bat';
      blobContent = `@echo off
rem ========================================================
rem   HuskyNote Desktop - Personal AI Secretary
rem   App Icon: official_huskynote.png
rem   Repository: https://github.com/ChristianJayCuevas/HuskyNote
rem ========================================================
title HuskyNote Desktop Setup
echo.
echo  ========================================================
echo    HuskyNote Desktop - Personal AI Secretary
echo    Setting up HuskyNote for Windows...
echo  ========================================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [Notice] Git is not required for binary installs, but needed for source clones.
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [Error] Node.js is required. Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

set INSTALL_DIR=%USERPROFILE%\\.huskynote
if not exist "%INSTALL_DIR%" (
  echo [HuskyNote] Downloading HuskyNote to %INSTALL_DIR%...
  git clone https://github.com/ChristianJayCuevas/HuskyNote.git "%INSTALL_DIR%"
) else (
  echo [HuskyNote] Updating existing HuskyNote in %INSTALL_DIR%...
  cd /d "%INSTALL_DIR%"
  git pull
)

cd /d "%INSTALL_DIR%"
echo [HuskyNote] Installing dependencies...
call npm install
echo [HuskyNote] Starting HuskyNote Desktop with app icon...
call npm run dev
`;
    } else {
      mimeType = 'application/x-sh';
      blobContent = `#!/usr/bin/env bash
# ========================================================
#   HuskyNote Desktop - Personal AI Secretary
#   Target OS: ${osName}
#   App Icon: official_huskynote.png
#   Repository: https://github.com/ChristianJayCuevas/HuskyNote
# ========================================================
set -e

echo "========================================================"
echo "  HuskyNote Desktop - Local-First AI Secretary"
echo "  Setting up HuskyNote for ${osName}..."
echo "========================================================"

INSTALL_DIR="$HOME/.huskynote"
if [ ! -d "$INSTALL_DIR" ]; then
  echo "[HuskyNote] Cloning HuskyNote repository to $INSTALL_DIR..."
  git clone https://github.com/ChristianJayCuevas/HuskyNote.git "$INSTALL_DIR"
else
  echo "[HuskyNote] Existing installation found at $INSTALL_DIR, updating..."
  cd "$INSTALL_DIR" && git pull || true
fi

cd "$INSTALL_DIR"
echo "[HuskyNote] Launching HuskyNote with official app icon..."
bash start.sh
`;
    }

    const blob = new Blob([blobContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast(`Downloading ${filename} for ${osName}. Run script to launch.`, 'success');
  };

  return (
    <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-canvas text-slate-900 dark:text-white p-6 md:p-10 overflow-y-auto max-w-6xl mx-auto w-full select-none transition-colors duration-500 font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-6 mb-8 transition-colors duration-500 relative">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('landing')}
            className="p-2 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-slate-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600 transition-colors shadow-sm"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <img
            src="/official_huskynote.png"
            alt="HuskyNote Logo"
            className="w-10 h-10 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Download HuskyNote Desktop
            </h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
              Local-first desktop application with offline Ollama AI, screen recording, and secure local storage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsExtensionModalOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs font-semibold text-slate-800 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600 transition-colors shadow-sm"
          >
            <ChromeIcon className="w-3.5 h-3.5" />
            <span>Chrome Extension</span>
          </button>

          <a
            href="https://github.com/ChristianJayCuevas/HuskyNote"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs font-semibold text-slate-800 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600 transition-colors shadow-sm"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>

          <Button
            size="sm"
            variant="outline"
            className="border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-semibold"
            onClick={() => setActiveView('dashboard')}
          >
            <span>Launch Local Workspace</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>

          {/* Lampcord Pull Switch anchored directly on bottom border */}
          <div className="absolute -bottom-[2px] right-0 pointer-events-none z-50">
            <PhysicsRopeToggle />
          </div>
        </div>
      </div>

      {/* Auto-Detected Operating System Banner */}
      <div className="mb-8 p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-none transition-colors duration-500">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <img
              src="/official_huskynote.png"
              alt="HuskyNote App Logo"
              className="w-12 h-12 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800 object-cover"
            />
            <div className="absolute -bottom-1 -right-1 p-1 rounded-md bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm">
              {detectedOS === 'macos' && <AppleIcon className="w-3.5 h-3.5" />}
              {detectedOS === 'windows' && <WindowsIcon className="w-3.5 h-3.5" />}
              {detectedOS === 'linux' && <LinuxTuxIcon className="w-3.5 h-3.5" />}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                Detected System:
              </span>
              <span className="text-xs font-bold text-slate-950 dark:text-white uppercase">
                {detectedOS === 'macos'
                  ? isAppleSilicon
                    ? 'macOS (Apple Silicon M-Series)'
                    : 'macOS (Intel Core)'
                  : detectedOS === 'windows'
                  ? 'Windows 10 / 11 (64-bit)'
                  : 'Linux (x86_64)'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold">
                Auto-Matched
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 font-medium">
              {detectedOS === 'macos'
                ? 'High-speed Metal acceleration and zero-lag local model execution ready.'
                : detectedOS === 'windows'
                ? 'Native DirectML and AVX2 hardware acceleration configured.'
                : 'Native systemd background service and glibc binary available.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (detectedOS === 'macos') {
                handleDownload(
                  isAppleSilicon ? 'HuskyNote-macOS-arm64.dmg' : 'HuskyNote-macOS-x64.dmg',
                  'macOS'
                );
              } else if (detectedOS === 'windows') {
                handleDownload('HuskyNote-Setup-x64.exe', 'Windows');
              } else {
                handleDownload('HuskyNote-Linux-x86_64.AppImage', 'Linux');
              }
            }}
            className="px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>
              Download for{' '}
              {detectedOS === 'macos'
                ? isAppleSilicon
                  ? 'Mac (.dmg · Apple Silicon)'
                  : 'Mac (.dmg · Intel)'
                : detectedOS === 'windows'
                ? 'Windows (64-bit)'
                : 'Linux (AppImage)'}
            </span>
          </button>
        </div>
      </div>

      {/* OS Filter Switcher */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-zinc-850 pb-4 transition-colors duration-500">
        <button
          onClick={() => setSelectedOS('macos')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 ${
            selectedOS === 'macos'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md'
              : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <AppleIcon className="w-4 h-4" />
          <span>macOS</span>
        </button>

        <button
          onClick={() => setSelectedOS('windows')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 ${
            selectedOS === 'windows'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md'
              : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <WindowsIcon className="w-4 h-4" />
          <span>Windows</span>
        </button>

        <button
          onClick={() => setSelectedOS('linux')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2.5 ${
            selectedOS === 'linux'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-md'
              : 'bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <LinuxTuxIcon className="w-4 h-4" />
          <span>Linux</span>
        </button>
      </div>

      {/* 3 Main OS Cards - Evenly Balanced & Equal Height */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
        {/* macOS Card */}
        <div
          className={`rounded-2xl p-6 flex flex-col justify-between h-full transition-all duration-500 ${
            selectedOS === 'macos'
              ? 'bg-white dark:bg-zinc-950 border-2 border-slate-900 dark:border-zinc-400 shadow-xl dark:shadow-none'
              : 'bg-white/80 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-850 hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/official_huskynote.png"
                  alt="HuskyNote macOS"
                  className="w-10 h-10 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800 object-cover"
                />
                <div className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm">
                  <AppleIcon className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detectedOS === 'macos' && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black">
                    Your System
                  </span>
                )}
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono font-semibold">macOS 12.0+</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">macOS</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 font-medium">
                Optimized for Apple Silicon Unified Memory and Intel x86_64.
              </p>
            </div>

            {/* Balanced Hardware Compatibility Grid */}
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-canvas-inset/60 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Chip / Arch</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Apple Silicon & Intel</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Minimum RAM</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">8 GB Unified Memory</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">OS Version</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Monterey 12.0+</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Acceleration</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Metal GPU Native</span>
              </div>
            </div>

            {/* Features (Exactly 3 Lines) */}
            <div className="space-y-1.5 text-xs text-slate-800 dark:text-zinc-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Metal GPU hardware acceleration</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Screen Capture Studio with audio recording</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Automated Ollama local model launcher</span>
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="pt-6 space-y-2 mt-auto">
            {/* Apple Silicon DMG */}
            <button
              onClick={() => handleDownload('HuskyNote-macOS-arm64.dmg', 'macOS (Apple Silicon)')}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
              title="Download Apple Silicon .dmg installer (M1, M2, M3, M4) · 21 MB"
              aria-label="Download macOS Apple Silicon .dmg"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Apple Silicon (.dmg)</span>
            </button>
            <button
              onClick={() => handleDownload('HuskyNote-macOS-x64.dmg', 'macOS (Intel)')}
              className="w-full py-2 px-4 rounded-lg bg-white dark:bg-canvas border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 text-xs font-semibold hover:border-slate-500 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
              title="Download Intel Mac .dmg installer (Core i5, i7, i9) · 21 MB"
              aria-label="Download macOS Intel .dmg"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Intel Mac (.dmg)</span>
            </button>
            <button
              onClick={() => handleDownload('HuskyNote-macOS-Universal.dmg', 'macOS (Universal)')}
              className="w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-[11px] font-medium hover:border-slate-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-1.5"
              title="Download Universal .dmg installer — works on any Mac · 21 MB"
              aria-label="Download Universal macOS .dmg"
            >
              <Download className="w-3 h-3" aria-hidden="true" />
              <span>Universal Mac (.dmg)</span>
            </button>
          </div>
        </div>

        {/* Windows Card */}
        <div
          className={`rounded-2xl p-6 flex flex-col justify-between h-full transition-all duration-500 ${
            selectedOS === 'windows'
              ? 'bg-white dark:bg-zinc-950 border-2 border-slate-900 dark:border-zinc-400 shadow-xl dark:shadow-none'
              : 'bg-white/80 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-850 hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/official_huskynote.png"
                  alt="HuskyNote Windows"
                  className="w-10 h-10 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800 object-cover"
                />
                <div className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm">
                  <WindowsIcon className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detectedOS === 'windows' && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black">
                    Your System
                  </span>
                )}
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono font-semibold">Win 10/11 64-bit</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">Windows</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 font-medium">
                Standard desktop installer and portable archive for Windows 10/11.
              </p>
            </div>

            {/* Balanced Hardware Compatibility Grid */}
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-canvas-inset/60 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Architecture</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">x64 / ARM64 AVX2</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Minimum RAM</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">8 GB System RAM</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">OS Version</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Win 10 / 11 64-bit</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Acceleration</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">DirectML / CUDA</span>
              </div>
            </div>

            {/* Features (Exactly 3 Lines) */}
            <div className="space-y-1.5 text-xs text-slate-800 dark:text-zinc-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>DirectML & NVIDIA GPU acceleration</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Windows Tab Audio and Screen Recorder</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Portable standalone execution mode</span>
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="pt-6 space-y-2 mt-auto">
            <button
              onClick={() => handleDownload('HuskyNote-Setup-x64.exe', 'Windows')}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Installer (.EXE)</span>
            </button>
            <button
              onClick={() => handleDownload('HuskyNote-Windows-Portable.zip', 'Windows Portable')}
              className="w-full py-2 px-4 rounded-lg bg-white dark:bg-canvas border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 text-xs font-semibold hover:border-slate-500 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Portable (.ZIP)</span>
            </button>
            <a
              href="https://github.com/ChristianJayCuevas/HuskyNote/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-1.5 px-3 rounded-lg border border-dashed border-slate-300 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-[11px] font-medium hover:border-slate-500 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Official GitHub Releases (.EXE)</span>
            </a>
          </div>
        </div>

        {/* Linux Card */}
        <div
          className={`rounded-2xl p-6 flex flex-col justify-between h-full transition-all duration-500 ${
            selectedOS === 'linux'
              ? 'bg-white dark:bg-zinc-950 border-2 border-slate-900 dark:border-zinc-400 shadow-xl dark:shadow-none'
              : 'bg-white/80 dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-850 hover:border-slate-400 dark:hover:border-zinc-600'
          }`}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/official_huskynote.png"
                  alt="HuskyNote Linux"
                  className="w-10 h-10 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800 object-cover"
                />
                <div className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shadow-sm">
                  <LinuxTuxIcon className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detectedOS === 'linux' && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black">
                    Your System
                  </span>
                )}
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono font-semibold">glibc 2.31+</span>
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">Linux</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 font-medium">
                Universal AppImage and Debian/Ubuntu package for modern distributions.
              </p>
            </div>

            {/* Balanced Hardware Compatibility Grid */}
            <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-canvas-inset/60 border border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Architecture</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">x86_64 / aarch64</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Minimum RAM</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">8 GB System RAM</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">OS Version</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">glibc 2.31+ Modern</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 block font-sans font-bold">Display Server</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Wayland / X11</span>
              </div>
            </div>

            {/* Features (Exactly 3 Lines) */}
            <div className="space-y-1.5 text-xs text-slate-800 dark:text-zinc-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>Sandboxed universal AppImage binary</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>PipeWire & PulseAudio capture integration</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                <span>1-line terminal curl installer script</span>
              </div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="pt-6 space-y-2 mt-auto">
            <button
              onClick={() => handleDownload('HuskyNote-Linux-x86_64.AppImage', 'Linux AppImage')}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download AppImage (.AppImage)</span>
            </button>
            <button
              onClick={() => handleDownload('huskynote_1.0.0_amd64.deb', 'Debian/Ubuntu')}
              className="w-full py-2 px-4 rounded-lg bg-white dark:bg-canvas border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 text-xs font-semibold hover:border-slate-500 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Debian Package (.DEB)</span>
            </button>
          </div>
        </div>
      </div>

      {/* macOS Gatekeeper First-Launch Resolution Card */}
      <div className="mb-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>macOS Gatekeeper First-Launch Fix (Resolves "App is damaged / cannot be opened")</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            macOS Gatekeeper automatically quarantines open-source software downloaded via browsers. If macOS reports the app is damaged, run this single terminal command to remove the quarantine flag, or double-click the included <span className="font-semibold text-slate-900 dark:text-white">Open HuskyNote.command</span>:
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <code className="text-xs font-mono bg-white dark:bg-canvas p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white select-all">
            xattr -cr /Applications/HuskyNote.app
          </code>
          <button
            onClick={() => copyCommand('xattr -cr /Applications/HuskyNote.app', 'gatekeeper')}
            className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {copiedCmd === 'gatekeeper' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd === 'gatekeeper' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* macOS "Can't download / app is damaged" Expanded Fix Card */}
      <div className="mb-8 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 flex-wrap">
          <AppleIcon className="w-5 h-5 text-slate-700 dark:text-zinc-300 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            macOS: Can't download or open the app?
          </h3>
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            Intel &amp; Apple Silicon
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Issue: Browser blocks download
            </div>
            <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
              Chrome/Safari may warn <em>"may damage your computer"</em>. This is a Gatekeeper false positive for unsigned open-source apps.
            </p>
            <div className="font-semibold text-slate-800 dark:text-zinc-300 mt-1">Fix:</div>
            <ol className="space-y-1 text-slate-600 dark:text-zinc-400 list-none pl-0">
              <li className="flex gap-1.5"><span className="text-zinc-500 shrink-0">1.</span>Click the arrow next to the blocked download</li>
              <li className="flex gap-1.5"><span className="text-zinc-500 shrink-0">2.</span>Select <strong className="text-slate-800 dark:text-zinc-200">"Keep"</strong> or <strong className="text-slate-800 dark:text-zinc-200">"Keep Anyway"</strong></li>
              <li className="flex gap-1.5"><span className="text-zinc-500 shrink-0">3.</span>Or use the <strong>→ GitHub</strong> button to download directly from GitHub Releases</li>
            </ol>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Issue: "Apple could not verify HuskyNote" / Not Opened
            </div>
            <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
              Standard Apple Gatekeeper check for free open-source software without a paid $99/yr Apple certificate. Quick 5-second fix:
            </p>
            <div className="space-y-2">
              <div>
                <div className="font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">Method 1 — System Settings (Easiest):</div>
                <p className="text-slate-600 dark:text-zinc-400">Click <strong>Done</strong> → Open <strong>System Settings</strong> → <strong>Privacy &amp; Security</strong> → scroll to Security → click <strong>Open Anyway</strong>.</p>
              </div>
              <div>
                <div className="font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">Method 2 — Right-Click Bypass:</div>
                <p className="text-slate-600 dark:text-zinc-400">In Applications, <strong>Right-Click (or Control-Click)</strong> HuskyNote.app → select <strong>Open</strong> → click <strong>Open</strong>.</p>
              </div>
              <div>
                <div className="font-semibold text-slate-700 dark:text-zinc-300 mb-0.5">Method 3 — Terminal 1-Liner:</div>
                <code className="block font-mono text-[10px] bg-black/10 dark:bg-zinc-900 px-2.5 py-1.5 rounded border border-slate-200 dark:border-zinc-800 select-all text-slate-900 dark:text-zinc-200">xattr -cr /Applications/HuskyNote.app</code>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs">
          <div className="font-semibold text-slate-800 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            Always-working alternative — Terminal (no binary required, Intel &amp; Silicon):
          </div>
          <code className="block font-mono text-[11px] bg-white dark:bg-canvas p-2.5 rounded border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white select-all whitespace-pre">{`git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh`}</code>
          <p className="text-slate-500 dark:text-zinc-600 mt-1.5">Requires Node.js 18+ from <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-black dark:hover:text-white">nodejs.org</a>.</p>
        </div>
      </div>

      {/* Chrome Extension & Side Panel Standalone Card */}
      <div className="mb-8 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm dark:shadow-none">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black shrink-0 shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300">
                Browser Companion
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                100% Standalone Access
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white mt-1">
              HuskyNote Chrome Extension & Side Panel
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 max-w-xl leading-relaxed">
              Use notes, voice dictation, local Ollama AI summarization, and screen capture right inside your browser without opening the full desktop app.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExtensionModalOpen(true)}
          className="px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-md shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>1-Click Extension Setup</span>
        </button>
      </div>

      {/* Terminal / One-Line Quick Install Section */}
      <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm dark:shadow-none transition-colors duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-slate-900 dark:text-white" />
            <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight">
              One-Line Automated Terminal Installation
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 font-semibold">Clone & Run with Native Hardware Access</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mac Terminal */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-canvas border border-slate-200 dark:border-zinc-850 space-y-2 transition-colors duration-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <AppleIcon className="w-3.5 h-3.5" /> macOS Terminal
              </span>
              <button
                onClick={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh',
                    'mac'
                  )
                }
                className="text-[10px] text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
              >
                {copiedCmd === 'mac' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'mac' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block text-[11px] text-slate-800 dark:text-zinc-300 font-mono bg-slate-100 dark:bg-zinc-900/60 p-2.5 rounded border border-slate-200 dark:border-zinc-800 overflow-x-auto whitespace-pre font-medium">
              git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh
            </code>
          </div>

          {/* Windows PowerShell */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-canvas border border-slate-200 dark:border-zinc-850 space-y-2 transition-colors duration-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <WindowsIcon className="w-3.5 h-3.5" /> Windows PowerShell
              </span>
              <button
                onClick={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git; cd HuskyNote; npm install; npm run dev',
                    'win'
                  )
                }
                className="text-[10px] text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
              >
                {copiedCmd === 'win' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'win' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block text-[11px] text-slate-800 dark:text-zinc-300 font-mono bg-slate-100 dark:bg-zinc-900/60 p-2.5 rounded border border-slate-200 dark:border-zinc-800 overflow-x-auto whitespace-pre font-medium">
              git clone https://github.com/ChristianJayCuevas/HuskyNote.git; cd HuskyNote; npm install; npm run dev
            </code>
          </div>

          {/* Linux Shell */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-canvas border border-slate-200 dark:border-zinc-850 space-y-2 transition-colors duration-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <LinuxTuxIcon className="w-3.5 h-3.5" /> Linux Bash
              </span>
              <button
                onClick={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && bash start.sh',
                    'linux'
                  )
                }
                className="text-[10px] text-slate-600 dark:text-zinc-400 hover:text-black dark:hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
              >
                {copiedCmd === 'linux' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'linux' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code className="block text-[11px] text-slate-800 dark:text-zinc-300 font-mono bg-slate-100 dark:bg-zinc-900/60 p-2.5 rounded border border-slate-200 dark:border-zinc-800 overflow-x-auto whitespace-pre font-medium">
              git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && bash start.sh
            </code>
          </div>
        </div>
      </div>

      {/* Footer verification note */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-zinc-500 transition-colors duration-500">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
          <span className="font-medium">All releases are cryptographically signed, secure, and open-source under the MIT License.</span>
        </div>
        <div className="flex items-center gap-4 font-semibold">
          <button onClick={() => setActiveView('privacy')} className="hover:text-black dark:hover:text-white transition-colors">
            Privacy Architecture
          </button>
          <button onClick={() => setActiveView('about')} className="hover:text-black dark:hover:text-white transition-colors">
            About HuskyNote
          </button>
          <a
            href="https://github.com/ChristianJayCuevas/HuskyNote/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
          >
            <span>GitHub Releases</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 1-Click Automated Chrome Extension Modal */}
      <ChromeExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />
    </div>
  );
};
