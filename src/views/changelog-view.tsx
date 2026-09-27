import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { GitCommit, Shield, Database, Cpu, CheckCircle, Terminal, Layers } from 'lucide-react';

const RELEASES = [
  {
    version: 'v0.5.0',
    date: '2026-09-27',
    title: 'GPU Transcription, GitHub-Style Dark Mode & Topbar Fixes',
    highlights: [
      'Parakeet TDT v3 now runs on the GPU on computers that support it. A configuration error made it fall back to the slower CPU version every time; on an RTX 4060, phrases now transcribe about 8 times faster.',
      'The first phrase of a recording no longer waits several seconds while the GPU warms up.',
      'Parakeet starts without an internet connection once downloaded, because its speech runtime now ships with the app instead of loading from a CDN.',
      'Microphone audio is filtered properly when it is converted for transcription, so hiss and high-pitched noise no longer fold into the speech range.',
      'Settings shows which speech models are downloaded on this device and how large they are, lets you remove them, and says whether the GPU can be used, including when the browser has graphics acceleration turned off and how to turn it on.',
      "Dark mode uses GitHub's dark palette: #0d1117 pages, a #010409 sidebar and topbar, and #30363d borders. Light mode is unchanged.",
      'Light mode now works on the Notes version history, Manuals, Documents, AI Workspace, Screen Recorder, Templates, and Husky Notes pages, which still showed dark panels and light text.',
      'In dark mode, the Manuals, Documents, AI Workspace, and Husky Notes pages use the same background as the rest of the app instead of pure black.',
      'Zoomed PDF pages are no longer cut off on the left side.',
      'Cards and calendar cells in dark mode no longer have white outlines, and about 340 dark-mode borders and hover states that never displayed now work.',
      'Removed the "Thock" sound button from the topbar. Cmd/Ctrl + M still mutes sound effects.',
      'The pull-cord theme switch no longer blocks clicks on the buttons underneath it.',
      'The workspace switcher stays in the same place on every page, its menu opens directly under it, and it matches the other topbar buttons in dark mode.',
      'The Settings header now scrolls with the page instead of staying pinned to the top.',
    ],
  },
  {
    version: 'v0.4.0',
    date: '2026-09-26',
    title: 'HuskyNote Rebrand, On-Device Transcription & Claude',
    highlights: [
      'Rebranded from DomoNote to HuskyNote with a new husky logo, mascot, and app icons. Notes and meetings saved by DomoNote carry over on first launch.',
      'Meetings are transcribed on this device with Whisper, including shared tab audio mixed with your microphone. It also works in the desktop apps, where browser speech recognition is unavailable.',
      'Choose a transcription engine in Settings: Parakeet (default, fastest, 25 European languages), Moonshine (lightweight, English), or Whisper (multilingual). Languages an engine does not support switch to Whisper automatically.',
      'Claude is available as an AI provider with your own Anthropic API key (Opus 5, Sonnet 5, or Haiku 4.5). The key stays on this device and is left out of workspace backups.',
      'Rebuilt macOS disk images for Universal, Apple Silicon, and Intel Macs.',
      'Removed the glow that followed the cursor across every page.',
    ],
  },
  {
    version: 'v0.3.0',
    date: '2026-09-25',
    title: 'Multilingual Meetings, Speaker Names & Windows App',
    highlights: [
      'Live transcription and AI translation across languages, with automatic spoken-language detection and summaries in the language you choose.',
      'Speaker names are picked up automatically from Google Meet and other meeting apps, including a participant scanner that works without the Chrome extension.',
      'An always-on-top floating meeting controller that stays visible over Google Meet and fullscreen windows.',
      'Native Windows desktop app with a standalone installer.',
      'Dark and light themes with the pull-cord switch and a circular transition, and the interface in English, Chinese, Japanese, and French.',
      'One-click Chrome extension setup, uploads for PowerPoint, Word, and text files, and document deletion.',
      'A responsive landing page with a mobile menu, automated build pipelines, and reliable installer downloads.',
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-09-13',
    title: 'Interactive Audio ("Thock"), Workspace Modes & Husky Mascot',
    highlights: [
      'Web Audio API mechanical switch audio synthesis with custom low-frequency thock, click, pop, and chime.',
      'Workspace Modes: Husky Notes Focus Sanctuary, Automated Schedule & Calendar, Full Screen Studio Recorder.',
      'Animated Husky mascot companion taking notes in Husky Notes mode.',
      'Embedded screen recording walkthrough demo player in About section.',
      'Collapsible desktop sidebar (256px <-> 64px) with persistent hardware status pill.',
      'Screen capture flight recorder with keyframe step extraction.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-09-13',
    title: 'Initial Production Release — HuskyNote Core Architecture',
    highlights: [
      'Local-first client-side architecture using Dexie IndexedDB.',
      'Meeting Secretary with real browser MediaRecorder speech recognition and clickable timeline milestones.',
      'Document Intelligence powered by PDF.js with coordinate-anchored annotations and Turn into Steps.',
      'Direct local integration with Ollama models on port 11434 with 100% private execution.',
      'Automated single-click Ollama setup script (setup-ollama.sh and start.sh).',
      'Client-side PDF and Markdown export engines.',
    ],
  },
];

export const ChangelogView: React.FC = () => {
  const [stats, setStats] = useState({
    notes: 0,
    meetings: 0,
    documents: 0,
    manuals: 0,
  });

  useEffect(() => {
    async function loadStats() {
      const [n, m, d, man] = await Promise.all([
        db.notes.count(),
        db.meetings.count(),
        db.documents.count(),
        db.manuals.count(),
      ]);
      setStats({ notes: n, meetings: m, documents: d, manuals: man });
    }
    loadStats();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-canvas text-slate-900 dark:text-white p-8 overflow-y-auto max-w-5xl mx-auto w-full select-none font-sans transition-colors duration-500">
      <div className="border-b border-slate-200 dark:border-zinc-850 pb-5 mb-8">
        <div className="flex items-center gap-2 text-slate-950 dark:text-white">
          <GitCommit className="w-5 h-5 text-slate-700 dark:text-zinc-400" />
          <h1 className="text-2xl font-bold tracking-tight">Changelog & System Diagnostics</h1>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
          Complete chronological ledger of architectural changes and client-side database diagnostics.
        </p>
      </div>

      {/* Local Storage Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-xs dark:shadow-none transition-colors duration-500">
          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase font-semibold">Notes Stored</span>
          <div className="text-2xl font-black text-slate-950 dark:text-white mt-1 font-mono">{stats.notes}</div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">Dexie db.notes</span>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-xs dark:shadow-none transition-colors duration-500">
          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase font-semibold">Meetings Captured</span>
          <div className="text-2xl font-black text-slate-950 dark:text-white mt-1 font-mono">{stats.meetings}</div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">Dexie db.meetings</span>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-xs dark:shadow-none transition-colors duration-500">
          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase font-semibold">PDF Documents</span>
          <div className="text-2xl font-black text-slate-950 dark:text-white mt-1 font-mono">{stats.documents}</div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">Dexie db.documents</span>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-xs dark:shadow-none transition-colors duration-500">
          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase font-semibold">SOP Manuals</span>
          <div className="text-2xl font-black text-slate-950 dark:text-white mt-1 font-mono">{stats.manuals}</div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600">Dexie db.manuals</span>
        </div>
      </div>

      {/* Release Ledger */}
      <div className="space-y-8">
        {RELEASES.map((rel) => (
          <div
            key={rel.version}
            className="p-6 rounded-2xl border border-slate-200 dark:border-zinc-850 bg-white dark:bg-zinc-950 space-y-4 shadow-xs dark:shadow-xl transition-colors duration-500"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white dark:bg-zinc-900 dark:text-white border border-slate-800 dark:border-zinc-800 text-xs font-mono font-bold">
                  {rel.version}
                </span>
                <span className="text-sm font-bold text-slate-950 dark:text-zinc-200">{rel.title}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 font-medium">{rel.date}</span>
            </div>

            <div className="space-y-2">
              {rel.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-zinc-500 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
