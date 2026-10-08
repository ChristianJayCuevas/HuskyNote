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
  FolderOpen,
  Loader2,
  Zap,
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChromeIcon } from '../ui/chrome-icon';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

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

  // Quick setup: Triggers native macOS automation via local dev server
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
          'Extensions tab opened and folder revealed in Finder! Simply drag the "browser-extension" folder into Chrome (or click "Load unpacked" and paste the path from your clipboard).'
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
      setAutoInstallStatus('Chrome launched with HuskyNote extension pre-loaded!');
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" hideClose aria-describedby="chrome-extension-description">
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 text-muted-foreground"
            title="Close modal"
            aria-label="Close"
          >
            <X />
          </Button>
        </DialogClose>

        {/* Header */}
        <DialogHeader className="flex-row items-start gap-4 space-y-0">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted">
            <ChromeIcon className="size-7" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">
                <Zap aria-hidden="true" />
                <span>Quick setup</span>
              </Badge>
              <Badge variant={isConnected ? 'success' : 'secondary'} dot>
                {isConnected ? 'Extension Connected' : 'Not installed yet'}
              </Badge>
            </div>
            <DialogTitle className="text-lg">HuskyNote Chrome Extension</DialogTitle>
            <DialogDescription id="chrome-extension-description">
              Transcribe Google Meet & Zoom calls, record tab audio, take notes, and summarize webpages directly in your browser.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* The whole dialog scrolls (DialogContent), so small screens are not squeezed between header and footer */}
        <div className="space-y-4">
          {/* Option 1: quick setup */}
          <section className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                One-click setup
              </h3>
              <Badge variant="outline">Instant</Badge>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              Click below to instantly open <code className="rounded-sm bg-muted-foreground/10 px-1 py-0.5 font-mono text-xs text-foreground">chrome://extensions</code> in Chrome and reveal the extension folder in Finder with the folder path copied to your clipboard.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default" size="sm" onClick={handleAutoInstall} disabled={isAutoInstalling}>
                {isAutoInstalling ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Configuring Chrome...</span>
                  </>
                ) : (
                  <>
                    <Zap />
                    <span>1-Click Auto Setup</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLaunchBrowser}
                disabled={isLaunchingBrowser}
                title="Launch a dedicated Chrome instance with extension pre-loaded"
              >
                {isLaunchingBrowser ? <Loader2 className="animate-spin" /> : <Play />}
                <span>Launch Chrome with Extension</span>
              </Button>

              <Button variant="ghost" size="sm" onClick={handleOpenExtensionsPage}>
                <ExternalLink />
                <span>Open Extensions Page</span>
              </Button>
            </div>

            {/* Feedback and status */}
            {autoInstallStatus && (
              <Alert variant="success" role="status">
                <CheckCircle />
                <AlertDescription className="text-foreground">{autoInstallStatus}</AlertDescription>
              </Alert>
            )}
          </section>

          {/* Two-step guide */}
          <section className="space-y-3 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">How it works:</h3>
              <Button variant="ghost" size="xs" className="-mr-1 text-muted-foreground" onClick={handleRevealFolder}>
                <FolderOpen />
                <span>Reveal in Finder</span>
              </Button>
            </div>

            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium tabular-nums text-foreground shadow-xs ring-1 ring-border">1</span>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">Enable Developer Mode</div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    In the top-right corner of the Extensions tab, switch the Developer mode toggle on.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium tabular-nums text-foreground shadow-xs ring-1 ring-border">2</span>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">Drag & Drop Folder</div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Drag the highlighted <code className="font-mono text-foreground">browser-extension</code> folder from Finder into Chrome, or click <strong className="font-medium text-foreground">Load unpacked</strong>.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        {/* Downloads and manual fallback */}
        <DialogFooter className="flex-col items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct ZIP download with proper headers */}
            <Button variant="outline" size="sm" asChild>
              <a href="/api/chrome-extension/download-zip" download="HuskyNote-Chrome-Extension.zip" title="Download zipped extension">
                <Download />
                <span>Download ZIP</span>
              </a>
            </Button>

            {/* Direct script download with proper headers */}
            <Button variant="outline" size="sm" asChild>
              <a href="/api/chrome-extension/download-script" download="Setup-HuskyNote-Extension.command" title="Download executable launcher script">
                <Terminal />
                <span>Download Mac script</span>
              </a>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => copyExtensionPath()} title="Copy absolute folder path">
              {copiedPath ? <Check className="text-success" /> : <Copy />}
              <span>{copiedPath ? 'Path Copied!' : 'Copy Path'}</span>
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={onClose} className="self-end sm:self-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
