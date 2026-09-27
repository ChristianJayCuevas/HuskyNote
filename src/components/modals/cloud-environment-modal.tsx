import React, { useState } from 'react';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import {
  CloudOff,
  Download,
  Copy,
  Check,
  X,
  Laptop,
  Terminal,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { GithubIcon } from '../ui/github-icon';

interface CloudEnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudEnvironmentModal: React.FC<CloudEnvironmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeView, setActiveView, isCloudHost } = useWorkspace();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cloneCommand = 'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh';

  const handleCopy = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    onClose();
    if (isCloudHost) {
      setActiveView('landing');
    }
  };

  const handleGoToLanding = () => {
    onClose();
    setActiveView('landing');
  };

  const handleGoToDownload = () => {
    onClose();
    setActiveView('download');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-xl rounded-2xl bg-zinc-950 border-2 border-white p-6 sm:p-8 shadow-2xl shadow-white/10 space-y-6 text-white">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Close and return to landing page"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Monochrome Cloud Off Icon */}
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-xl bg-white text-black shrink-0">
            <CloudOff className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white text-black">
                Cloud Web Host Detected (Vercel)
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-1">
              Local Desktop App Required
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              HuskyNote is a private, local-first app designed to run exclusively on your physical computer.
            </p>
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2.5 text-xs text-zinc-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Shield className="w-4 h-4 text-zinc-400" />
            <span>Why is the workspace unavailable on Vercel?</span>
          </div>
          <p className="leading-relaxed text-zinc-400">
            Hosted cloud web servers cannot connect to your local Ollama AI daemon (<code className="text-zinc-200 font-mono">localhost:11434</code>),
            cannot store encrypted audio blobs in your local IndexedDB filesystem, and cannot record native multi-tab meetings or screens without exposing private data to third-party cloud infrastructure.
          </p>
        </div>

        {/* Quick Start Terminal Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Clone & Run Locally (Zero Config)</span>
            </span>
            <button
              onClick={handleCopy}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied command' : 'Copy command'}</span>
            </button>
          </div>
          <code className="block text-[11px] text-zinc-200 font-mono bg-black p-3 rounded-lg border border-zinc-800 overflow-x-auto whitespace-pre">
            {cloneCommand}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href="https://github.com/ChristianJayCuevas/HuskyNote"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-black border dark:border-zinc-850 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"
          >
            <GithubIcon className="w-4 h-4" />
            <span>GitHub Repository</span>
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleGoToLanding}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Back to Landing Page</span>
            </button>
            <button
              onClick={handleGoToDownload}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Desktop App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
