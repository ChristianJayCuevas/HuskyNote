import React, { useState, useEffect } from 'react';
import { db } from '../db';
import releases from '../data/changelog.json';
import { GitCommit, Shield, Database, Cpu, CheckCircle, Terminal, Layers } from 'lucide-react';

// Also the source of the GitHub release notes (scripts/release-notes.mjs)
const RELEASES: { version: string; date: string; title: string; highlights: string[] }[] = releases;

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
