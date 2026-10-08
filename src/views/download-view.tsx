import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { HuskyLogo, HuskyMark } from '@/brand';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageContainer, PageHeader } from '../components/ui/page';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import {
  Download,
  Terminal,
  CheckCircle,
  Copy,
  Check,
  Shield,
  ArrowRight,
  ExternalLink,
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

/** Copyable shell command: muted mono block with an optional copy button */
const CommandBlock: React.FC<{ command: string; copied?: boolean; onCopy?: () => void; className?: string }> = ({
  command,
  copied = false,
  onCopy,
  className,
}) => (
  <div className={cn('flex items-start gap-1 rounded-md border bg-muted py-1.5 pl-3', onCopy ? 'pr-1' : 'pr-3', className)}>
    <code className="min-w-0 flex-1 select-all whitespace-pre-wrap break-words py-0.5 font-mono text-xs leading-5 text-foreground">{command}</code>
    {onCopy && (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-my-0.5 shrink-0 text-muted-foreground"
        onClick={onCopy}
        title="Copy command"
        aria-label={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    )}
  </div>
);

interface OsCardProps {
  name: string;
  icon: React.ReactNode;
  requirement: string;
  description: string;
  specs: Array<[label: string, value: string]>;
  features: string[];
  selected: boolean;
  recommended: boolean;
  children: React.ReactNode;
}

/** One platform: header, specs, three features and its download buttons pinned to the bottom */
const OsCard: React.FC<OsCardProps> = ({ name, icon, requirement, description, specs, features, selected, recommended, children }) => (
  <Card
    className={cn(
      'flex h-full flex-col p-5 transition-colors duration-100',
      selected ? 'border-primary/60 shadow-sm' : 'hover:border-input'
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {recommended && <Badge variant="default">Recommended</Badge>}
        <span className="text-xs text-muted-foreground">{requirement}</span>
      </div>
    </div>

    <h3 className="mt-4 text-lg font-semibold text-foreground">{name}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>

    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-muted/60 p-3">
      {specs.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>

    <ul className="mt-4 space-y-1.5 text-sm text-foreground">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>

    <div className="mt-auto space-y-2 pt-6">{children}</div>
  </Card>
);

export const DownloadView: React.FC = () => {
  const { setActiveView, addToast } = useWorkspace();

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
    // ─── Binary Package Downloads (.dmg, .exe, .zip, .AppImage, .tar.gz) ────────
    if (
      filename.endsWith('.exe') ||
      filename.endsWith('.zip') ||
      filename.endsWith('.dmg') ||
      filename.endsWith('.AppImage') ||
      filename.endsWith('.tar.gz')
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
        : filename.endsWith('.tar.gz')
        ? 'Linux portable archive (.tar.gz)'
        : 'Linux AppImage';

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
rem   HuskyNote Desktop - A local-first AI secretary for meetings, documents, and notes.
rem   App Icon: official_huskynote.png
rem   Repository: https://github.com/ChristianJayCuevas/HuskyNote
rem ========================================================
title HuskyNote Desktop Setup
echo.
echo  ========================================================
echo    HuskyNote Desktop - A local-first AI secretary for meetings, documents, and notes.
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
#   HuskyNote Desktop - A local-first AI secretary for meetings, documents, and notes.
#   Target OS: ${osName}
#   App Icon: official_huskynote.png
#   Repository: https://github.com/ChristianJayCuevas/HuskyNote
# ========================================================
set -e

echo "========================================================"
echo "  HuskyNote Desktop - A local-first AI secretary for meetings, documents, and notes."
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

  const detectedLabel =
    detectedOS === 'macos'
      ? isAppleSilicon
        ? 'macOS (Apple Silicon M-Series)'
        : 'macOS (Intel Core)'
      : detectedOS === 'windows'
      ? 'Windows 10 / 11 (64-bit)'
      : 'Linux (x86_64)';

  return (
    <div className="min-h-full">
      {/* Top navigation */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 sm:px-6">
        <Button variant="ghost" size="sm" className="-ml-1 text-muted-foreground" onClick={() => setActiveView('landing')} title="Back to Landing Page">
          <ArrowLeft />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <span className="hidden text-foreground sm:inline-flex">
          <HuskyLogo size="sm" />
        </span>
        <span className="inline-flex sm:hidden">
          <HuskyMark size={20} title="HuskyNote" />
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setIsExtensionModalOpen(true)}>
            <ChromeIcon className="size-3.5" />
            <span>Chrome Extension</span>
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
            <a href="https://github.com/ChristianJayCuevas/HuskyNote" target="_blank" rel="noopener noreferrer">
              <GithubIcon className="size-3.5" />
              <span>GitHub</span>
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveView('dashboard')}>
            <span>Launch Local Workspace</span>
            <ArrowRight />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <PageContainer width="wide">
        <PageHeader
          title="Download HuskyNote Desktop"
          titleClassName="text-3xl font-bold"
          description="Local-first desktop application with offline Ollama AI, screen recording, and secure local storage."
        />

        {/* Auto-detected operating system */}
        <Alert className="mb-8 flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
              {detectedOS === 'macos' && <AppleIcon className="size-5" />}
              {detectedOS === 'windows' && <WindowsIcon className="size-4" />}
              {detectedOS === 'linux' && <LinuxTuxIcon className="size-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Detected System:</span>
                <span className="font-medium text-foreground">{detectedLabel}</span>
                <Badge variant="outline">Auto-Matched</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {detectedOS === 'macos'
                  ? 'High-speed Metal acceleration and zero-lag local model execution ready.'
                  : detectedOS === 'windows'
                  ? 'Installs like any Windows app, with optional GPU-accelerated transcription.'
                  : 'Single-file AppImage, or a portable .tar.gz archive.'}
              </p>
            </div>
          </div>

          <Button
            variant="default"
            className="w-full shrink-0 sm:w-auto"
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
          >
            <Download />
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
          </Button>
        </Alert>

        {/* OS filter */}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={selectedOS}
          onValueChange={(value) => value && setSelectedOS(value as SupportedOS)}
          aria-label="Operating system"
          className="mb-4"
        >
          <ToggleGroupItem value="macos" className="gap-2 px-3">
            <AppleIcon className="size-3.5" />
            <span>macOS</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="windows" className="gap-2 px-3">
            <WindowsIcon className="size-3" />
            <span>Windows</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="linux" className="gap-2 px-3">
            <LinuxTuxIcon className="size-3.5" />
            <span>Linux</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Platform cards, equal height */}
        <div className="mb-10 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
          <OsCard
            name="macOS"
            icon={<AppleIcon className="size-5" />}
            requirement="macOS 12.0+"
            description="Optimized for Apple Silicon Unified Memory and Intel x86_64."
            specs={[
              ['Chip / Arch', 'Apple Silicon & Intel'],
              ['Minimum RAM', '8 GB Unified Memory'],
              ['OS Version', 'Monterey 12.0+'],
              ['Acceleration', 'Metal GPU Native'],
            ]}
            features={['Metal GPU hardware acceleration', 'Screen Capture Studio with audio recording', 'Automated Ollama local model launcher']}
            selected={selectedOS === 'macos'}
            recommended={detectedOS === 'macos'}
          >
            <Button
              variant={selectedOS === 'macos' ? 'default' : 'secondary'}
              className="w-full"
              onClick={() => handleDownload('HuskyNote-macOS-arm64.dmg', 'macOS (Apple Silicon)')}
              title="Download Apple Silicon .dmg installer (M1, M2, M3, M4) · 21 MB"
              aria-label="Download macOS Apple Silicon .dmg"
            >
              <Download aria-hidden="true" />
              <span>Apple Silicon (.dmg)</span>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleDownload('HuskyNote-macOS-x64.dmg', 'macOS (Intel)')}
              title="Download Intel Mac .dmg installer (Core i5, i7, i9) · 21 MB"
              aria-label="Download macOS Intel .dmg"
            >
              <Download aria-hidden="true" />
              <span>Intel Mac (.dmg)</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => handleDownload('HuskyNote-macOS-Universal.dmg', 'macOS (Universal)')}
              title="Download Universal .dmg installer — works on any Mac · 21 MB"
              aria-label="Download Universal macOS .dmg"
            >
              <Download aria-hidden="true" />
              <span>Universal Mac (.dmg)</span>
            </Button>
          </OsCard>

          <OsCard
            name="Windows"
            icon={<WindowsIcon className="size-4" />}
            requirement="Win 10/11 64-bit"
            description="Standard desktop installer and portable archive for Windows 10/11."
            specs={[
              ['Architecture', '64-bit (x64)'],
              ['Minimum RAM', '8 GB System RAM'],
              ['OS Version', 'Win 10 / 11 64-bit'],
              ['Acceleration', 'Optional GPU'],
            ]}
            features={['GPU-accelerated transcription (optional)', 'Windows Tab Audio and Screen Recorder', 'Portable standalone execution mode']}
            selected={selectedOS === 'windows'}
            recommended={detectedOS === 'windows'}
          >
            <Button variant={selectedOS === 'windows' ? 'default' : 'secondary'} className="w-full" onClick={() => handleDownload('HuskyNote-Setup-x64.exe', 'Windows')}>
              <Download />
              <span>Download Installer (.EXE)</span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleDownload('HuskyNote-Windows-Portable.zip', 'Windows Portable')}>
              <Download />
              <span>Download Portable (.ZIP)</span>
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
              <a href="https://github.com/ChristianJayCuevas/HuskyNote/releases" target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                <span>Official GitHub Releases (.EXE)</span>
              </a>
            </Button>
          </OsCard>

          <OsCard
            name="Linux"
            icon={<LinuxTuxIcon className="size-5" />}
            requirement="glibc 2.31+"
            description="Single-file AppImage and portable .tar.gz for 64-bit Linux."
            specs={[
              ['Architecture', 'x86_64'],
              ['Minimum RAM', '8 GB System RAM'],
              ['OS Version', 'glibc 2.31+ Modern'],
              ['Display Server', 'Wayland / X11'],
            ]}
            features={['Single-file AppImage, no install needed', 'PipeWire & PulseAudio capture integration', 'Portable .tar.gz archive']}
            selected={selectedOS === 'linux'}
            recommended={detectedOS === 'linux'}
          >
            <Button variant={selectedOS === 'linux' ? 'default' : 'secondary'} className="w-full" onClick={() => handleDownload('HuskyNote-Linux-x86_64.AppImage', 'Linux AppImage')}>
              <Download />
              <span>Download AppImage (.AppImage)</span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleDownload('HuskyNote-Linux-x64.tar.gz', 'Linux tar.gz')}>
              <Download />
              <span>Download Portable (.tar.gz)</span>
            </Button>
          </OsCard>
        </div>

        {/* macOS Gatekeeper first-launch fix */}
        <Alert variant="warning" className="mb-8">
          <AlertCircle />
          <AlertTitle>macOS Gatekeeper First-Launch Fix (Resolves "App is damaged / cannot be opened")</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="max-w-2xl">
              macOS Gatekeeper automatically quarantines open-source software downloaded via browsers. If macOS reports the app is damaged, run this single terminal command to remove the quarantine flag, or double-click the included <span className="font-medium text-foreground">Open HuskyNote.command</span>:
            </p>
            <CommandBlock
              command="xattr -cr /Applications/HuskyNote.app"
              copied={copiedCmd === 'gatekeeper'}
              onCopy={() => copyCommand('xattr -cr /Applications/HuskyNote.app', 'gatekeeper')}
              className="max-w-md bg-background"
            />
          </AlertDescription>
        </Alert>

        {/* macOS "can't download / app is damaged" help */}
        <section className="mb-8 space-y-4 rounded-lg border p-5" aria-labelledby="mac-help-title">
          <div className="flex flex-wrap items-center gap-2">
            <AppleIcon className="size-4 shrink-0 text-muted-foreground" />
            <h2 id="mac-help-title" className="text-base font-semibold text-foreground">
              macOS: Can't download or open the app?
            </h2>
            <Badge variant="outline">Intel &amp; Apple Silicon</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2 rounded-md bg-muted/50 p-4">
              <h3 className="flex items-center gap-1.5 font-medium text-foreground">
                <AlertCircle className="size-3.5 shrink-0 text-warning" />
                Issue: Browser blocks download
              </h3>
              <p className="leading-6 text-muted-foreground">
                Chrome/Safari may warn <em>"may damage your computer"</em>. This is a Gatekeeper false positive for unsigned open-source apps.
              </p>
              <div className="font-medium text-foreground">Fix:</div>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground marker:text-muted-foreground">
                <li>Click the arrow next to the blocked download</li>
                <li>Select <strong className="font-medium text-foreground">"Keep"</strong> or <strong className="font-medium text-foreground">"Keep Anyway"</strong></li>
                <li>Or use the <strong className="font-medium text-foreground">→ GitHub</strong> button to download directly from GitHub Releases</li>
              </ol>
            </div>
            <div className="space-y-2 rounded-md bg-muted/50 p-4">
              <h3 className="flex items-center gap-1.5 font-medium text-foreground">
                <AlertCircle className="size-3.5 shrink-0 text-warning" />
                Issue: "Apple could not verify HuskyNote" / Not Opened
              </h3>
              <p className="leading-6 text-muted-foreground">
                Standard Apple Gatekeeper check for free open-source software without a paid $99/yr Apple certificate. Quick 5-second fix:
              </p>
              <div className="space-y-2.5">
                <div>
                  <div className="mb-0.5 font-medium text-foreground">Method 1 — System Settings (Easiest):</div>
                  <p className="text-muted-foreground">Click <strong className="font-medium text-foreground">Done</strong> → Open <strong className="font-medium text-foreground">System Settings</strong> → <strong className="font-medium text-foreground">Privacy &amp; Security</strong> → scroll to Security → click <strong className="font-medium text-foreground">Open Anyway</strong>.</p>
                </div>
                <div>
                  <div className="mb-0.5 font-medium text-foreground">Method 2 — Right-Click Bypass:</div>
                  <p className="text-muted-foreground">In Applications, <strong className="font-medium text-foreground">Right-Click (or Control-Click)</strong> HuskyNote.app → select <strong className="font-medium text-foreground">Open</strong> → click <strong className="font-medium text-foreground">Open</strong>.</p>
                </div>
                <div>
                  <div className="mb-1 font-medium text-foreground">Method 3 — Terminal 1-Liner:</div>
                  <CommandBlock command="xattr -cr /Applications/HuskyNote.app" className="bg-background" />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded-md bg-muted/50 p-4 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
              Always-working alternative — Terminal (no binary required, Intel &amp; Silicon):
            </div>
            <CommandBlock command={`git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh`} className="bg-background" />
            <p className="text-xs text-muted-foreground">
              Requires Node.js 18+ from <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">nodejs.org</a>.
            </p>
          </div>
        </section>

        {/* Chrome extension and side panel */}
        <section className="mb-8 flex flex-col items-start justify-between gap-5 rounded-lg border p-5 md:flex-row md:items-center" aria-labelledby="extension-title">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Browser Companion</Badge>
                <Badge variant="outline">100% Standalone Access</Badge>
              </div>
              <h2 id="extension-title" className="mt-2 text-base font-semibold text-foreground">
                HuskyNote Chrome Extension & Side Panel
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Use notes, voice dictation, local Ollama AI summarization, and screen capture right inside your browser without opening the full desktop app.
              </p>
            </div>
          </div>

          <Button variant="default" className="shrink-0" onClick={() => setIsExtensionModalOpen(true)}>
            <Sparkles />
            <span>1-Click Extension Setup</span>
          </Button>
        </section>

        {/* One-line terminal installation */}
        <section className="space-y-4 rounded-lg border p-5" aria-labelledby="terminal-install-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="terminal-install-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Terminal className="size-4 text-muted-foreground" />
              One-Line Automated Terminal Installation
            </h2>
            <span className="text-xs text-muted-foreground">Clone & Run with Native Hardware Access</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <AppleIcon className="size-3.5" /> macOS Terminal
              </div>
              <CommandBlock
                command="git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh"
                copied={copiedCmd === 'mac'}
                onCopy={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh',
                    'mac'
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <WindowsIcon className="size-3" /> Windows PowerShell
              </div>
              <CommandBlock
                command="git clone https://github.com/ChristianJayCuevas/HuskyNote.git; cd HuskyNote; npm install; npm run dev"
                copied={copiedCmd === 'win'}
                onCopy={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git; cd HuskyNote; npm install; npm run dev',
                    'win'
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <LinuxTuxIcon className="size-3.5" /> Linux Bash
              </div>
              <CommandBlock
                command="git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && bash start.sh"
                copied={copiedCmd === 'linux'}
                onCopy={() =>
                  copyCommand(
                    'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && bash start.sh',
                    'linux'
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Shield className="size-4 shrink-0" />
            <span>Open source under the MIT License. Builds aren't code-signed yet, so your system may ask you to confirm the first launch.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setActiveView('privacy')}>
              Privacy Architecture
            </Button>
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setActiveView('about')}>
              About HuskyNote
            </Button>
            <Button variant="ghost" size="xs" className="text-muted-foreground" asChild>
              <a href="https://github.com/ChristianJayCuevas/HuskyNote/releases" target="_blank" rel="noopener noreferrer">
                <span>GitHub Releases</span>
                <ExternalLink />
              </a>
            </Button>
          </div>
        </footer>
      </PageContainer>

      {/* 1-click automated Chrome extension setup */}
      <ChromeExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />
    </div>
  );
};
