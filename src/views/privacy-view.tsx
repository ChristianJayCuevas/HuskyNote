import React from 'react';
import { Shield, Lock, EyeOff, Server, HardDrive } from 'lucide-react';

export const PrivacyView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white p-8 overflow-y-auto max-w-4xl mx-auto w-full select-none font-sans transition-colors duration-500">
      <div className="border-b border-slate-200 dark:border-zinc-850 pb-5 mb-8">
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">Privacy & Local-First Boundaries</h2>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
          Honest transparency regarding your data, permissions, and network activity.
        </p>
      </div>

      <div className="space-y-6 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
        {/* Core Guarantee */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-2.5 text-slate-950 dark:text-zinc-100 font-bold text-sm">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Local Storage by Default</span>
          </div>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            All notes, meeting audio recordings, transcripts, uploaded PDF files, screenshot captures,
            and custom templates reside strictly inside your browser's IndexedDB database.
          </p>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            HuskyNote has no remote cloud databases, no user accounts on external servers, and no
            background synchronization unless you explicitly configure an external endpoint.
          </p>
        </div>

        {/* Local AI Boundary */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-2.5 text-slate-950 dark:text-zinc-100 font-bold text-sm">
            <Server className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>Local AI Execution (Ollama)</span>
          </div>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            When you invoke AI features—such as document summarization, meeting minutes extraction,
            or operation descriptions—the prompt and contextual document excerpts are sent directly
            to your local Ollama port (<code>http://localhost:11434</code>) running on your own computer.
          </p>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            Your document content and meeting transcripts never transit third-party commercial LLM
            APIs unless you explicitly substitute a remote provider.
          </p>
        </div>

        {/* Permissions */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-2.5 text-slate-950 dark:text-zinc-100 font-bold text-sm">
            <Shield className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>Hardware & Browser Permissions</span>
          </div>
          <ul className="space-y-2 text-slate-600 dark:text-zinc-400 leading-relaxed">
            <li>
              <strong className="text-slate-900 dark:text-zinc-200">Microphone:</strong> Invoked exclusively when you click "Start Microphone" in
              the Meeting Secretary. The browser will ask for confirmation, and an active red pulse
              indicator will show during recording.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-zinc-200">Screen Sharing:</strong> Invoked exclusively when you click "Start Screen
              Capture" in the Operation Manual section. You choose which window or screen to share.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-zinc-200">No Silent Recording:</strong> HuskyNote does not and cannot bypass browser
              permission systems to secretly capture desktop audio or screens.
            </li>
          </ul>
        </div>

        {/* No Tracking */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-3 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-2.5 text-slate-950 dark:text-zinc-100 font-bold text-sm">
            <EyeOff className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            <span>Zero Third-Party Tracking</span>
          </div>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            HuskyNote includes no Google Analytics, no tracking pixels, no advertising scripts, and no
            data collectors. Your notes, recordings, and files remain solely your own.
          </p>
        </div>
      </div>
    </div>
  );
};
