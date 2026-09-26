import React, { useState } from 'react';
import { Mic, FileUp, FileText, Video, Bot } from 'lucide-react';
import { TiltCard } from '../ui/tilt-card';

export const FeatureMap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'documents' | 'notes' | 'operations' | 'ai'>('meetings');

  const tabs: Array<{ id: 'meetings' | 'documents' | 'notes' | 'operations' | 'ai'; label: string; icon: any }> = [
    { id: 'meetings', label: 'Meetings', icon: Mic },
    { id: 'documents', label: 'Documents', icon: FileUp },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'operations', label: 'Screen Recorder', icon: Video },
    { id: 'ai', label: 'Local AI', icon: Bot },
  ];

  return (
    <section className="py-10 sm:py-20 border-t border-slate-200 dark:border-zinc-850 text-left select-none">
      <div className="mb-8 sm:mb-10">
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          Workspace Features
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight mt-1">
          Everything you need in one place.
        </h2>
      </div>

      {/* Horizontal Interactive Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-850 pb-3 mb-6 sm:mb-8 overflow-x-auto scrollbar-none w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-slate-900 dark:bg-zinc-800 text-white font-bold border border-slate-900 dark:border-zinc-700 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Content Display */}
      <TiltCard
        maxTilt={3}
        scale={1.01}
        className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-8 shadow-sm dark:shadow-2xl min-h-[380px] flex flex-col justify-between transition-colors duration-500"
      >
        {activeTab === 'meetings' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <span className="text-xs font-bold text-slate-950 dark:text-white">Meeting Notes & Voice Capture</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ready to Record</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Record microphone and meeting audio directly in your browser. Spoken words appear in real time with clickable timestamps and extracted takeaways.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2 text-slate-700 dark:text-zinc-300">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500 mb-1">
                <span>Timeline Bookmark</span>
                <span>00:14:05</span>
              </div>
              <div>03:41 Architecture — Team agreed on IndexedDB local storage</div>
              <div>08:20 Deployment — Migration scheduled for Friday evening</div>
              <div>14:05 Decision — Canary rollout verified</div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <span className="text-xs font-bold text-slate-950 dark:text-white">Document Reader & Analysis</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">PDF, DOCX, PPTX, TXT</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Read PDFs and documents on a clean reading desk. Highlight sections to trigger instant explanations, summaries, or turn dense sections into step guides.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2 text-slate-700 dark:text-zinc-300">
              <div className="flex items-center gap-2 text-slate-950 dark:text-white">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center">
                  01
                </span>
                <span className="font-semibold">Step 1: Open administrative configuration panel</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-zinc-400 pl-7">
                Source: Page 3 • Excerpt verified against original document text
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <span className="text-xs font-bold text-slate-950 dark:text-white">Notes & Version History</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Autosaved</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Clean markdown editor with live preview, tag taxonomies, debounced autosave, and full version history comparisons.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2 text-slate-700 dark:text-zinc-300">
              <div className="text-slate-950 dark:text-white font-semibold"># Project Specification</div>
              <p className="text-slate-600 dark:text-zinc-400 text-xs">
                - Automatic checkpoints saved every 60 seconds of editing.
              </p>
              <p className="text-slate-600 dark:text-zinc-400 text-xs">
                - One-click Markdown and PDF export.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <span className="text-xs font-bold text-slate-950 dark:text-white">Screen Recorder & Step Manuals</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Screen Capture</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Record your screen during complex computer tasks. HuskyNote extracts screenshots, captures steps, and builds standard operating manuals.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2 text-slate-700 dark:text-zinc-300">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs">
                <span className="font-semibold text-slate-800 dark:text-zinc-300">Server Deployment Guide</span>
                <span>Complete</span>
              </div>
              <div className="text-slate-950 dark:text-white font-medium">Step 1: Verify Kubernetes node health</div>
              <div className="text-slate-950 dark:text-white font-medium">Step 2: Deploy canary pod manifest with 10% weight</div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <span className="text-xs font-bold text-slate-950 dark:text-white">Local AI Assistant</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Runs 100% Offline</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Ask questions grounded in your notes, meetings, and documents. Runs directly on your machine via Ollama without sending data to outside servers.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-900/60 text-xs space-y-2 text-slate-700 dark:text-zinc-300">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <span>Attached Context:</span>
                <span className="bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700 font-medium">
                  [Architecture.pdf]
                </span>
                <span className="bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700 font-medium">
                  [Product Sync]
                </span>
              </div>
              <p className="text-slate-800 dark:text-zinc-300 pt-1">
                "Based on the attached Architecture specification and Meeting notes, deployment is scheduled for Friday at 18:00 UTC."
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-zinc-850 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
          <span>Local browser storage</span>
          <span>No cloud tracking</span>
        </div>
      </TiltCard>
    </section>
  );
};
