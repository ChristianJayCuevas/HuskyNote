import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Copy,
  Check,
  ExternalLink,
  Download,
  Terminal,
  Sparkles,
  Play,
  ArrowRight,
  Mic,
  Bot,
  FileText,
  Camera,
  FolderOpen,
  Loader2,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ChromeIcon } from '../ui/chrome-icon';

interface ChromeExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChromeExtensionModal: React.FC<ChromeExtensionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutoInstalling, setIsAutoInstalling] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);
  const [autoInstallStatus, setAutoInstallStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Check if extension is installed & responding via window messaging or meta tag
    const checkExtension = () => {
      const isExtensionActive =
        !!(window as any).__huskynote_extension_installed ||
        document.getElementById('huskynote-extension-marker') !== null;

      if (isExtensionActive) {
        setIsConnected(true);
      } else {
        // Send a ping message in case content script is active
        window.postMessage({ type: 'HUSKYNOTE_PING' }, '*');
      }
    };

    checkExtension();
    const interval = setInterval(checkExtension, 1200);

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'HUSKYNOTE_PONG' || e.data?.source === 'huskynote-extension') {
        setIsConnected(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const chromeLaunchCommand = `open -a "Google Chrome" --args --load-extension="$(pwd)/browser-extension"`;

  const copyLaunchCommand = () => {
    navigator.clipboard.writeText(chromeLaunchCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const copyExtensionPath = (pathText = '/Users/arronkianparejas/huskynote/browser-extension') => {
    navigator.clipboard.writeText(pathText);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  // 1-Click Automated Setup: Triggers native macOS automation via local dev server
  const handleAutoInstall = async () => {
    setIsAutoInstalling(true);
    setAutoInstallStatus(null);
    try {
      const res = await fetch('/api/chrome-extension/auto-install', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setAutoInstallStatus(
          '✨ Extensions tab opened and folder revealed in Finder! Simply drag the "browser-extension" folder into Chrome (or click "Load unpacked" and paste the path from your clipboard).'
        );
      } else {
        setAutoInstallStatus('Folder path copied! Open chrome://extensions to load.');
      }
    } catch {
      // Fallback if API route is unreachable: copy path to clipboard
      copyExtensionPath();
      setAutoInstallStatus('Path copied to clipboard! Navigate to chrome://extensions and select "Load unpacked".');
    } finally {
      setIsAutoInstalling(false);
    }
  };

  // Direct Launch: Runs Chrome with extension pre-loaded
  const handleLaunchBrowser = async () => {
    setIsLaunchingBrowser(true);
    try {
      await fetch('/api/chrome-extension/launch-browser', {
        method: 'POST',
      });
      setAutoInstallStatus('🚀 Chrome launched with HuskyNote extension pre-loaded!');
    } catch {
      copyLaunchCommand();
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  // Opens chrome://extensions via AppleScript on local server (bypasses browser security restrictions)
  const handleOpenExtensionsPage = async () => {
    try {
      await fetch('/api/chrome-extension/open-extensions-page', {
        method: 'POST',
      });
    } catch {
      navigator.clipboard.writeText('chrome://extensions');
    }
  };

  // Reveals folder in Finder
  const handleRevealFolder = async () => {
    try {
      await fetch('/api/chrome-extension/reveal-folder', {
        method: 'POST',
      });
    } catch {
      copyExtensionPath();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl shadow-white/10 space-y-6 text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Close modal"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 shrink-0 shadow-lg flex items-center justify-center">
            <ChromeIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-emerald-400" />
                <span>1-Click Automated Setup</span>
              </span>
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                {isConnected ? 'Extension Connected' : 'Not Loaded Yet'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              HuskyNote Chrome Extension & Side Panel
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Transcribe Google Meet & Zoom calls, record tab audio, take notes, and summarize webpages directly in your browser.
            </p>
          </div>
        </div>

        {/* ── Option 1: 1-Click Automated Setup ── */}
        <div className="p-5 rounded-xl bg-gradient-to-b from-zinc-900/90 to-black border border-emerald-500/30 space-y-4 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Fully Automated 1-Click Setup
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              Instant
            </span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Click below to instantly open <code className="text-emerald-300 font-mono">chrome://extensions</code> in Chrome and reveal the extension folder in Finder with the folder path copied to your clipboard.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAutoInstall}
              disabled={isAutoInstalling}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
            >
              {isAutoInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Configuring Chrome...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>⚡ 1-Click Auto Setup</span>
                </>
              )}
            </button>

            <button
              onClick={handleLaunchBrowser}
              disabled={isLaunchingBrowser}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-xs font-semibold border border-zinc-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Launch a dedicated Chrome instance with extension pre-loaded"
            >
              {isLaunchingBrowser ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Launch Chrome with Extension</span>
            </button>

            <button
              onClick={handleOpenExtensionsPage}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Extensions Page</span>
            </button>
          </div>

          {/* Feedback & Status Message */}
          {autoInstallStatus && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 leading-relaxed flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-emerald-300">{autoInstallStatus}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 2-Step Drag & Drop Visual Guide ── */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border dark:border-zinc-850 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-200">How It Works (10 Seconds):</span>
            <button
              onClick={handleRevealFolder}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Reveal in Finder</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-black border border-zinc-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center font-mono">1</span>
                <span>Enable Developer Mode</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                In the top-right corner of the Extensions tab, switch the toggle to <strong className="text-white">ON</strong>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black border border-zinc-800 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center font-mono">2</span>
                <span>Drag & Drop Folder</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Drag the highlighted <code className="text-zinc-200">browser-extension</code> folder from Finder into Chrome, or click <strong className="text-white">Load unpacked</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* ── Downloads & Manual Fallback ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t dark:border-zinc-850">
          <div className="flex items-center gap-2">
            {/* Direct ZIP download with proper headers */}
            <a
              href="/api/chrome-extension/download-zip"
              download="HuskyNote-Chrome-Extension.zip"
              className="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm"
              title="Download zipped extension"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </a>

            {/* Direct script download with proper headers */}
            <a
              href="/api/chrome-extension/download-script"
              download="Setup-HuskyNote-Extension.command"
              className="px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm"
              title="Download executable launcher script"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Download .command Script</span>
            </a>

            <button
              onClick={() => copyExtensionPath()}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-mono transition-colors flex items-center gap-1.5"
              title="Copy absolute folder path"
            >
              {copiedPath ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPath ? 'Path Copied!' : 'Copy Path'}</span>
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={onClose} className="border-zinc-800 text-zinc-300">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
