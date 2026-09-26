import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Check } from 'lucide-react';

export const HeroLiveWorkspace: React.FC = () => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((prev) => (prev + 1) % 5);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-8 shadow-2xl overflow-hidden font-sans text-left">
      {/* Top Window Chrome */}
      <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span className="font-medium">Architecture Spec.pdf</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Page 4 of 18</span>
          <span>•</span>
          <span className="text-emerald-400">Local AI Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[300px]">
        {/* Left: Document Reading Page */}
        <div className="md:col-span-7 bg-white text-zinc-900 rounded-xl p-4 sm:p-6 paper-desk-shadow relative flex flex-col justify-between select-none">
          <div className="space-y-3">
            <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">
              Section 2.4 — Privacy & Local Storage
            </div>
            <h4 className="text-base font-bold text-black tracking-tight">
              Local Storage by Default
            </h4>
            <p className="text-xs text-zinc-600 leading-relaxed">
              All extracted document text, audio transcripts, and screen captures are retained strictly
              inside your browser's local storage.
            </p>

            {/* Simulated Highlighted Paragraph */}
            <div className="relative p-2 rounded text-xs text-black font-medium">
              <div
                className={`absolute inset-0 bg-yellow-300/40 rounded transition-all duration-700 ${
                  stage >= 1 ? 'w-full' : 'w-0'
                }`}
              />
              <span className="relative z-10">
                "No communication with remote services is permitted. All processing runs locally on your computer."
              </span>

              {/* Numbered Badge */}
              {stage >= 4 && (
                <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shadow animate-fade-in">
                  01
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Your notes and knowledge base remain accessible even without an internet connection.
            </p>
          </div>

          <div className="pt-4 border-t border-zinc-200 text-xs text-zinc-500 flex justify-between">
            <span>Document Excerpt</span>
            <span>Page 4</span>
          </div>

          {/* Contextual Floating Toolbar */}
          {stage === 1 && (
            <div className="absolute top-28 left-4 sm:left-12 z-20 flex items-center gap-1 bg-zinc-950 border border-zinc-700 text-white rounded-lg p-1 shadow-2xl text-xs animate-fade-in font-sans">
              <span className="px-2 py-1 bg-zinc-800 text-white rounded font-medium">
                Explain
              </span>
              <span className="px-2 py-1 text-zinc-400 hover:text-white">Summarize</span>
              <span className="px-2 py-1 text-zinc-400 hover:text-white">Highlight</span>
            </div>
          )}
        </div>

        {/* Right: Sliding AI Context & Note Panel */}
        <div className="md:col-span-5 flex flex-col justify-between bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 sm:p-5 text-xs text-zinc-300">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-semibold text-xs text-white">Local AI Assistant</span>
              </div>
              <span className="text-xs text-zinc-400">Ollama</span>
            </div>

            {stage >= 2 ? (
              <div className="space-y-3 animate-fade-in">
                <div className="text-xs text-zinc-400 font-semibold uppercase">
                  Selected Excerpt (Page 4)
                </div>
                <div className="p-3 rounded bg-zinc-950/80 border border-zinc-850 text-xs text-zinc-400 italic">
                  "No communication with remote language services is permitted..."
                </div>

                <div className="text-xs text-zinc-400 font-semibold uppercase">Analysis</div>
                <p className="text-zinc-200 leading-relaxed text-xs">
                  This guarantees absolute privacy. HuskyNote runs entirely on your local computer processor.
                </p>

                {stage >= 4 && (
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs text-emerald-400 animate-fade-in">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>Note Created from Analysis</span>
                    </span>
                    <span className="text-zinc-400 text-xs">Saved to Notes</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center text-zinc-500 text-xs">
                <span>Highlight any text to run AI actions</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-xs text-zinc-400">
            <span>Step {stage + 1} of 5</span>
            <span className="text-zinc-300">Document to note workflow</span>
          </div>
        </div>
      </div>
    </div>
  );
};
