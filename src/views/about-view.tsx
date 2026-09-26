import React from 'react';
import { ExternalLink, Sparkles, Star } from 'lucide-react';
import { GithubIcon } from '../components/ui/github-icon';
import { HuskyMascot } from '../components/ui/husky-mascot';
import { TiltCard } from '../components/ui/tilt-card';
import { useGitHubStars } from '../services/github/stars';
import logoImg from '../assets/official_huskynote.png';

export const AboutView: React.FC = () => {
  const { starCount } = useGitHubStars();
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white p-8 overflow-y-auto max-w-5xl mx-auto w-full select-none font-sans transition-colors duration-500">
      {/* Brand Header */}
      <div className="border-b border-slate-200 dark:border-zinc-850 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={logoImg} alt="HuskyNote" className="w-12 h-12 rounded-xl object-contain shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">About HuskyNote</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              Your Personal AI Secretary for meetings, notes, and documents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/ChristianJayCuevas/HuskyNote"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors font-medium shadow-xs group"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>GitHub</span>
            <span className="flex items-center gap-1 font-mono text-[11px] text-amber-500">
              <Star className="w-3 h-3 fill-amber-500" />
              <span>{starCount !== null ? starCount.toLocaleString() : 'Star'}</span>
            </span>
            <ExternalLink className="w-3 h-3 text-slate-500 dark:text-zinc-500" />
          </a>
        </div>
      </div>

      <div className="space-y-10 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">


        {/* Mascot Showcase Section */}
        <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-8 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 font-medium">
              <Sparkles className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
              <span>Focus Companion</span>
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              Meet HuskyNote's Husky Companion
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Designed in a clean, minimal black-and-white style. The husky sits quietly taking notes in
              your Husky Notes workspace, reacting as you type and keeping track of your session without distractions.
            </p>
            <div className="text-xs text-slate-500 dark:text-zinc-500">
              Your distraction-free companion. Open Husky Notes with Cmd/Ctrl + Shift + N.
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center">
            <HuskyMascot size="lg" />
          </div>
        </section>

        {/* Concept & Purpose */}
        <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl p-6 space-y-4 shadow-xs dark:shadow-none transition-colors duration-500">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight uppercase tracking-wider">
            What is HuskyNote?
          </h3>
          <p className="leading-relaxed text-slate-800 dark:text-zinc-300">
            HuskyNote is an open-source, local-first workspace designed to capture, organize, and synthesize
            what happens across your meetings, documents, and notes.
          </p>
          <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
            Instead of storing your information on third-party cloud servers, HuskyNote operates
            entirely inside your browser and local machine. It combines a distraction-free markdown notes editor,
            an automated meeting secretary, a multi-format document reader (PDF, DOCX, PPTX, TXT), and a step-by-step
            guide generator.
          </p>
        </section>

        {/* Open Source Credits */}
        <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl p-6 space-y-4 shadow-xs dark:shadow-none transition-colors duration-500">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight uppercase tracking-wider">
            Open Source Credits
          </h3>
          <TiltCard maxTilt={5} scale={1.02} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800">
            <a
              href="https://github.com/darknecrocities/DomoNote"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-slate-950 dark:text-zinc-100 text-sm hover:underline"
            >
              DomoNote by darknecrocities
              <ExternalLink className="w-3 h-3" />
            </a>
            <p className="text-slate-600 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
              HuskyNote is built on DomoNote, used under the MIT License. The original copyright notice is retained in the LICENSE file.
            </p>
          </TiltCard>
        </section>

        {/* Technology Foundation */}
        <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl p-6 space-y-3 shadow-xs dark:shadow-none transition-colors duration-500">
          <h3 className="text-sm font-bold text-slate-950 dark:text-white tracking-tight uppercase tracking-wider">
            Technology Foundation
          </h3>
          <ul className="space-y-2 text-slate-600 dark:text-zinc-400 text-xs">
            <li>• Frontend: React 18, TypeScript 5, Vite 6, Tailwind CSS</li>
            <li>• Audio: Web Audio API sound synthesizer</li>
            <li>• Local Storage: IndexedDB via Dexie</li>
            <li>• Local Intelligence: Ollama REST API (streaming generate and chat)</li>
            <li>• Document Ingestion: PDF.js, Mammoth (.docx), JSZip (.pptx)</li>
            <li>• Audio Processing: Web Audio API and MediaRecorder</li>
            <li>• Screen Recording: Standard Navigator MediaDevices DisplayMedia</li>
            <li>• Deployment: Static client-side Single Page Application</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
