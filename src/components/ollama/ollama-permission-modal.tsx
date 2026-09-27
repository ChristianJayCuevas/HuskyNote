/**
 * OllamaPermissionModal — Local AI Setup & Recovery Flow
 * =======================================================
 * Shows when a user attempts an AI-dependent action but Ollama is offline.
 *
 * DETECTION STRATEGY:
 * The modal distinguishes between two states:
 *  1. "Ollama not installed"  — No process is listening on port 11434
 *  2. "Ollama offline / CORS" — Process exists but the companion can't reach it
 *
 * INSTALL FLOW (1-Click):
 * ┌─────────────────────────────────────────────────────────┐
 * │  Step 1 → Try local companion start (POST /ollama/start) │
 * │  Step 2 → If companion missing, download OS installer    │
 * │           macOS: Ollama-darwin.zip                       │
 * │           Windows: OllamaSetup.exe                       │
 * │           Linux:  install.sh curl script                 │
 * │  Step 3 → Poll localhost:11434 until service is up       │
 * └─────────────────────────────────────────────────────────┘
 *
 * MODEL SELECTION:
 * - After Ollama connects, shows available models.
 * - If no models, shows recommended 1-click pull options.
 *
 * PROPS:
 * - isOpen      Whether the modal is visible
 * - onClose     Called when user dismisses without completing setup
 * - onSuccess   Called when Ollama connects successfully
 * - actionName  Human-readable name of the blocked AI action
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import {
  Cpu,
  Download,
  CheckCircle,
  Loader2,
  X,
  Shield,
  ExternalLink,
  Power,
  Sparkles,
  Terminal,
  AlertTriangle,
  ChevronDown,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { AppleIcon, WindowsIcon, LinuxTuxIcon } from '../../views/download-view';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface OllamaPermissionModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Dismiss handler (sets isOpen to false in parent) */
  onClose: () => void;
  /** Called when Ollama becomes reachable and a model is selected */
  onSuccess?: () => void;
  /** Name of the AI action that triggered this modal (e.g. "transcript polish") */
  actionName?: string;
}

/**
 * Recommended starter models — curated for local hardware performance.
 * These are shown when Ollama is connected but has no models pulled yet.
 */
const RECOMMENDED_MODELS = [
  { name: 'llama3.2:3b', label: 'Llama 3.2 · 3B', desc: 'Fast, 2GB RAM', badge: 'Recommended' },
  { name: 'gemma2:2b', label: 'Gemma 2 · 2B', desc: 'Compact, 1.5GB', badge: 'Lightweight' },
  { name: 'qwen2.5:3b', label: 'Qwen 2.5 · 3B', desc: 'Multilingual', badge: 'Best for translations' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const OllamaPermissionModal: React.FC<OllamaPermissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionName = 'AI generation',
}) => {
  const { isConnected, models, startOllamaService, checkConnection, pullModel, selectedModel, setSelectedModel } = useAI();
  const { addToast } = useWorkspace();

  // ── State ─────────────────────────────────────────────────────────────────

  /** Whether the automated install/start sequence is in progress */
  const [installing, setInstalling] = useState(false);
  /** Progress message shown in the install progress card */
  const [stepStatus, setStepStatus] = useState<string>('');
  /** Current step index (1–3) for the progress bar */
  const [stepNumber, setStepNumber] = useState<number>(1);
  /** Whether a model pull operation is active */
  const [pulling, setPulling] = useState(false);
  /** Pull progress percentage (0–100) */
  const [pullProgress, setPullProgress] = useState<number>(0);
  /** Model name currently being pulled */
  const [pullingModel, setPullingModel] = useState<string>('');

  // ── OS Detection ──────────────────────────────────────────────────────────

  /**
   * Detect the user's operating system from navigator hints.
   * Falls back to 'macos' since HuskyNote targets Mac-first.
   */
  const detectedOS = React.useMemo<'macos' | 'windows' | 'linux'>(() => {
    if (typeof navigator === 'undefined') return 'macos';
    const ua = navigator.userAgent.toLowerCase();
    const plat =
      (navigator as any).userAgentData?.platform?.toLowerCase() ||
      navigator.platform.toLowerCase();
    if (plat.includes('win') || ua.includes('windows')) return 'windows';
    if (plat.includes('mac') || ua.includes('macintosh')) return 'macos';
    return 'linux';
  }, []);

  /** True when running on Apple Silicon (heuristic: Mac + ≥8 CPU cores) */
  const isAppleSilicon = React.useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    const plat = navigator.platform.toLowerCase();
    return (plat.includes('mac') || ua.includes('macintosh')) && (navigator.hardwareConcurrency || 4) >= 8;
  }, []);

  // ── Connection Polling (while installing) ─────────────────────────────────

  /**
   * Poll for Ollama availability while the install flow is active.
   * Clears itself once connected or after a reasonable timeout.
   */
  useEffect(() => {
    if (!installing) return;

    const interval = setInterval(async () => {
      const ok = await checkConnection();
      if (ok) {
        clearInterval(interval);
        setStepNumber(3);
        setStepStatus('Ollama connected! AI features are ready.');
        setTimeout(() => {
          setInstalling(false);
          addToast('Local Ollama AI engine is ready. Continuing...', 'success');
          onClose();
          onSuccess?.();
        }, 1500);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [installing, checkConnection, onClose, onSuccess, addToast]);

  // ── Auto-success when already connected ──────────────────────────────────

  useEffect(() => {
    if (isOpen && isConnected && models.length > 0 && !installing) {
      // Already fully connected with models — no action needed
      // Don't auto-close; let user explicitly proceed
    }
  }, [isOpen, isConnected, models, installing]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * handleGrantPermissionAndInstall
   * Primary CTA handler that runs the full automated setup sequence:
   * 1. Tries the local companion service start endpoint
   * 2. If unavailable, downloads the appropriate OS installer
   * 3. Begins polling for the Ollama service to come online
   */
  const handleGrantPermissionAndInstall = async () => {
    setInstalling(true);
    setStepNumber(1);
    setStepStatus('Contacting local companion service...');

    try {
      // Step 1: Try local companion (if user runs start.sh / local-companion)
      const res = await startOllamaService();
      if (res.success) {
        setStepNumber(2);
        setStepStatus('Ollama service started. Initializing model runtime...');
        return; // Polling useEffect will handle the rest
      }
    } catch {
      // Companion unavailable — fall through to direct download
    }

    // Step 2: Download the appropriate Ollama installer for this OS
    setStepNumber(2);
    setStepStatus(`Triggering official Ollama installer download for ${detectedOS}...`);

    let downloadUrl = 'https://ollama.com/download';
    if (detectedOS === 'macos') {
      // Both Intel and Apple Silicon use the same universal .zip
      downloadUrl = 'https://ollama.com/download/Ollama-darwin.zip';
    } else if (detectedOS === 'windows') {
      downloadUrl = 'https://ollama.com/download/OllamaSetup.exe';
    }
    // Linux: guide user to the curl install command (no binary to download here)

    if (detectedOS !== 'linux') {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setStepStatus(
      detectedOS === 'linux'
        ? 'Run the install command below in your terminal, then come back here.'
        : 'Installer downloading — run it, then return here. Watching for Ollama to start...'
    );

    // Step 3 is handled by the polling useEffect
  };

  /**
   * handlePullModel
   * Pulls (downloads) a specific model from the Ollama registry.
   * Shows live progress via the onProgress callback.
   *
   * @param modelName - Ollama model tag (e.g. "llama3.2:3b")
   */
  const handlePullModel = async (modelName: string) => {
    if (pulling) return;
    setPulling(true);
    setPullingModel(modelName);
    setPullProgress(0);
    addToast(`Pulling model ${modelName}... this may take a few minutes.`, 'info');

    const result = await pullModel(modelName, (progress) => {
      if (progress.total && progress.completed) {
        setPullProgress(Math.round((progress.completed / progress.total) * 100));
      }
    });

    setPulling(false);
    setPullProgress(0);
    setPullingModel('');

    if (result.success) {
      addToast(`Model ${modelName} ready!`, 'success');
      await setSelectedModel(modelName);
    } else {
      addToast(`Failed to pull ${modelName}: ${result.message}`, 'error');
    }
  };

  /** Re-check Ollama status manually */
  const handleRecheck = async () => {
    setStepStatus('Rechecking Ollama connection...');
    const ok = await checkConnection();
    if (ok) {
      addToast('Ollama is now connected!', 'success');
      onClose();
      onSuccess?.();
    } else {
      addToast('Ollama still not reachable. Make sure it is running.', 'warning');
    }
  };

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // Render — "Already Connected" state (no models)
  // ─────────────────────────────────────────────────────────────────────────

  if (isConnected && models.length === 0 && !installing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ollama-modal-title"
      >
        <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border-2 border-white p-6 sm:p-7 shadow-2xl shadow-white/10 space-y-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-white text-black shrink-0">
              <Cpu className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  Ollama Connected
                </span>
              </div>
              <h2 id="ollama-modal-title" className="text-xl font-bold tracking-tight text-white mt-1">
                Pick an AI Model
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Ollama is running but has no models. Download one to enable {actionName}.
              </p>
            </div>
          </div>

          {/* Recommended model cards */}
          <div className="space-y-2" role="list" aria-label="Recommended AI models">
            {RECOMMENDED_MODELS.map((m) => (
              <div
                key={m.name}
                role="listitem"
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-white/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{m.label}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-zinc-400">
                      {m.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{m.desc}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pulling && pullingModel !== m.name}
                  onClick={() => handlePullModel(m.name)}
                  className="text-xs font-mono shrink-0 ml-3"
                  aria-label={`Pull model ${m.label}`}
                >
                  {pulling && pullingModel === m.name ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" aria-hidden="true" />
                      <span>{pullProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" aria-hidden="true" />
                      <span>Pull</span>
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* Pull progress bar */}
          {pulling && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Pulling {pullingModel}...</span>
                <span className="font-mono">{pullProgress}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={pullProgress} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="bg-white h-full rounded-full transition-all duration-300"
                  style={{ width: `${pullProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
          >
            Continue without model selection
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — "Already Connected with models" state
  // ─────────────────────────────────────────────────────────────────────────

  if (isConnected && models.length > 0 && !installing) {
    // Signal success immediately and close
    onSuccess?.();
    onClose();
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — Main "Not Connected" state
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ollama-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border-2 border-white p-6 sm:p-7 shadow-2xl shadow-white/10 space-y-6 text-white">

        {/* Close button (hidden during install to prevent orphaned state) */}
        {!installing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {/* ── Modal Header ── */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white text-black shrink-0">
            <Cpu className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-white text-black">
                Local AI Required
              </span>
              {/* OS indicator */}
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                {detectedOS === 'macos' && <AppleIcon className="w-3.5 h-3.5" />}
                {detectedOS === 'windows' && <WindowsIcon className="w-3.5 h-3.5" />}
                {detectedOS === 'linux' && <LinuxTuxIcon className="w-3.5 h-3.5" />}
                <span className="capitalize">{detectedOS}</span>
                {detectedOS === 'macos' && (
                  <span className="text-[10px] text-zinc-600">
                    {isAppleSilicon ? '(Apple Silicon)' : '(Intel)'}
                  </span>
                )}
              </span>
            </div>
            <h2 id="ollama-modal-title" className="text-xl font-bold tracking-tight text-white mt-1">
              Connect Local AI (Ollama)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Required for {actionName}, private meeting summaries, and document Q&A.
            </p>
          </div>
        </div>

        {/* ── Privacy Guarantee ── */}
        <div
          className="p-4 rounded-xl bg-black border dark:border-zinc-850 space-y-2 text-xs text-zinc-300"
          role="note"
          aria-label="Privacy guarantee"
        >
          <div className="flex items-center gap-2 font-semibold text-white">
            <Shield className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            <span>100% Offline & Private AI Guarantee</span>
          </div>
          <p className="leading-relaxed text-zinc-400">
            HuskyNote never sends your voice recordings, notes, or uploaded PDFs to third-party
            cloud servers. All AI operations run directly on your hardware using the open-source
            Ollama engine — no API key, no subscription, no data leaving your machine.
          </p>
        </div>

        {/* ── Installation Progress / Permission Box ── */}
        {installing ? (
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/20 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Step {stepNumber} of 3: Installing & Verifying</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">localhost:11434</span>
            </div>

            {/* Progress bar */}
            <div
              className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={stepNumber === 1 ? 33 : stepNumber === 2 ? 66 : 100}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: stepNumber === 1 ? '35%' : stepNumber === 2 ? '70%' : '100%' }}
              />
            </div>

            <p className="text-xs text-zinc-300 font-mono leading-relaxed">{stepStatus}</p>

            {/* Manual recheck button if step 2 is waiting */}
            {stepNumber === 2 && (
              <button
                onClick={handleRecheck}
                className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors"
                aria-label="Manually check if Ollama is now running"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                I've installed it — check again
              </button>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-zinc-900/40 border dark:border-zinc-850 space-y-2">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>What happens when you click below</span>
            </div>
            <ol className="text-xs text-zinc-400 leading-relaxed space-y-1 list-none pl-0">
              <li className="flex items-start gap-1.5">
                <span className="text-zinc-600 font-mono shrink-0">1.</span>
                HuskyNote checks if Ollama is already running on your machine
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-zinc-600 font-mono shrink-0">2.</span>
                If not found, the official Ollama installer for{' '}
                <strong className="text-white capitalize">{detectedOS}</strong> is downloaded
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-zinc-600 font-mono shrink-0">3.</span>
                Once Ollama is running, your blocked action continues automatically
              </li>
            </ol>
          </div>
        )}

        {/* ── Terminal Fallback ── */}
        {/*
          For power users who prefer the terminal, or for Linux users who
          must use the curl installer. Shown in a copyable code block.
        */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-zinc-400" aria-hidden="true" />
            <span>Or install manually in your terminal:</span>
          </div>
          <code
            className="block text-[10px] text-zinc-300 font-mono bg-black p-2.5 rounded border dark:border-zinc-850 overflow-x-auto whitespace-pre select-all"
            aria-label="Terminal install command"
          >
            {detectedOS === 'macos'
              ? 'curl -fsSL https://ollama.com/install.sh | sh\n# or: brew install ollama'
              : detectedOS === 'windows'
              ? '# Download OllamaSetup.exe from https://ollama.com/download\n# Then run: ollama serve'
              : 'curl -fsSL https://ollama.com/install.sh | sh'}
          </code>
          {detectedOS === 'macos' && (
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              After install, run <code className="font-mono">ollama serve</code> in Terminal, or
              launch the Ollama app from your Applications folder.{' '}
              {isAppleSilicon
                ? 'Apple Silicon (M1/M2/M3/M4) is fully supported.'
                : 'Intel Macs are fully supported.'}
            </p>
          )}
        </div>

        {/* ── macOS Gatekeeper Note ── */}
        {detectedOS === 'macos' && !installing && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-400/80 leading-relaxed">
            <AlertTriangle className="w-3 h-3 inline mr-1" aria-hidden="true" />
            <strong className="text-amber-400">macOS Gatekeeper:</strong> If macOS blocks Ollama after
            download, run{' '}
            <code className="font-mono bg-black/40 px-1 rounded">
              xattr -cr /Applications/Ollama.app
            </code>{' '}
            in Terminal to remove the quarantine flag.
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="pt-1 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
            aria-label="Continue using HuskyNote without AI features"
          >
            Continue Without AI
          </button>

          <Button
            size="sm"
            variant="primary"
            id="ollama-grant-btn"
            className="bg-white text-black hover:bg-zinc-200 font-bold px-5"
            onClick={handleGrantPermissionAndInstall}
            disabled={installing}
            aria-label={
              installing
                ? 'Checking Ollama connection...'
                : `Install Ollama for ${detectedOS} and start AI features`
            }
          >
            {installing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>Checking Ollama...</span>
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Install & Start Ollama</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
