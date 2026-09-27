import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWorkspace } from '../context/workspace-context';
import { useAI } from '../context/ai-context';
import type { Note, Meeting, DocumentEntity, Manual } from '../types';
import { Button } from '../components/ui/button';
import { Card, TiltCard } from '../components/ui/card';
import {
  FileText,
  Mic,
  FileUp,
  Video,
  Bot,
  Plus,
  ArrowRight,
  BookOpen,
  Layers,
} from 'lucide-react';
import { WorkspaceAnalyticsCard } from '../components/dashboard/workspace-analytics-card';
import { ChromeIcon } from '../components/ui/chrome-icon';

export const DashboardView: React.FC = () => {
  const {
    setActiveView,
    setActiveNoteId,
    setActiveMeetingId,
    setActiveDocumentId,
    setActiveManualId,
    setIsExtensionModalOpen,
  } = useWorkspace();
  const { isConnected, selectedModel } = useAI();

  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().limit(5).toArray(), []) || [];
  const meetings = useLiveQuery(() => db.meetings.orderBy('startTime').reverse().limit(4).toArray(), []) || [];
  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().limit(4).toArray(), []) || [];
  const manuals = useLiveQuery(() => db.manuals.orderBy('updatedAt').reverse().limit(4).toArray(), []) || [];

  const handleCreateNewNote = async () => {
    const id = `note-${Date.now()}`;
    const newNote: Note = {
      id,
      title: 'Untitled Note',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [],
    };
    await db.notes.put(newNote);
    setActiveNoteId(id);
    setActiveView('notes');
  };

  const totalItems = notes.length + meetings.length + documents.length + manuals.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-canvas text-slate-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 overflow-y-auto select-none font-sans transition-colors duration-500">
      {/* Header Profile / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">Your Workspace</h2>
          <p className="text-xs sm:text-sm text-slate-800 dark:text-zinc-300 mt-1 font-medium">
            Everything is saved privately on your device. Fast, offline, and secure.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExtensionModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 bg-white dark:bg-canvas border border-slate-300 dark:border-zinc-850 text-slate-800 dark:text-zinc-200 hover:text-black dark:hover:text-white"
            title="Automated 1-Click Chrome Extension Integration"
          >
            <ChromeIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Chrome Extension</span>
          </Button>
          <Button size="sm" variant="primary" onClick={handleCreateNewNote}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setActiveView('meetings')}>
            <Mic className="w-3.5 h-3.5" />
            <span>Start Meeting</span>
          </Button>
        </div>
      </div>

      {/* Analytical Workspace Overview & Telemetry Card */}
      <WorkspaceAnalyticsCard />

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <TiltCard maxTilt={6} scale={1.02} className="rounded-xl">
          <button
            onClick={handleCreateNewNote}
            className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 hover:border-slate-500 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all text-left flex flex-col justify-between min-h-[7.2rem] shadow-xs hover:shadow-md active:scale-[0.98]"
          >
            <FileText className="w-5 h-5 text-slate-950 dark:text-zinc-200" />
            <div className="mt-2">
              <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">New Note</div>
              <span className="text-[11px] text-slate-800 dark:text-zinc-300 font-semibold">Write thoughts & notes</span>
            </div>
          </button>
        </TiltCard>

        <TiltCard maxTilt={6} scale={1.02} className="rounded-xl">
          <button
            onClick={() => setActiveView('meetings')}
            className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 hover:border-slate-500 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all text-left flex flex-col justify-between min-h-[7.2rem] shadow-xs hover:shadow-md active:scale-[0.98]"
          >
            <Mic className="w-5 h-5 text-slate-950 dark:text-zinc-200" />
            <div className="mt-2">
              <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Start Meeting</div>
              <span className="text-[11px] text-slate-800 dark:text-zinc-300 font-semibold">Record audio & notes</span>
            </div>
          </button>
        </TiltCard>

        <TiltCard maxTilt={6} scale={1.02} className="rounded-xl">
          <button
            onClick={() => setActiveView('documents')}
            className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 hover:border-slate-500 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all text-left flex flex-col justify-between min-h-[7.2rem] shadow-xs hover:shadow-md active:scale-[0.98]"
          >
            <FileUp className="w-5 h-5 text-slate-950 dark:text-zinc-200" />
            <div className="mt-2">
              <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Upload Document</div>
              <span className="text-[11px] text-slate-800 dark:text-zinc-300 font-semibold">Read & search files</span>
            </div>
          </button>
        </TiltCard>

        <TiltCard maxTilt={6} scale={1.02} className="rounded-xl">
          <button
            onClick={() => setActiveView('manuals')}
            className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 hover:border-slate-500 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all text-left flex flex-col justify-between min-h-[7.2rem] shadow-xs hover:shadow-md active:scale-[0.98]"
          >
            <Video className="w-5 h-5 text-slate-950 dark:text-zinc-200" />
            <div className="mt-2">
              <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Create Guide</div>
              <span className="text-[11px] text-slate-800 dark:text-zinc-300 font-semibold">Step-by-step manual</span>
            </div>
          </button>
        </TiltCard>

        <TiltCard maxTilt={6} scale={1.02} className="rounded-xl">
          <button
            onClick={() => setActiveView('ai-workspace')}
            className="w-full p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 hover:border-slate-500 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all text-left flex flex-col justify-between min-h-[7.2rem] shadow-xs hover:shadow-md active:scale-[0.98]"
          >
            <Bot className="w-5 h-5 text-slate-950 dark:text-zinc-200" />
            <div className="mt-2">
              <div className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white">Ask AI</div>
              <span className="text-[11px] text-slate-800 dark:text-zinc-300 font-semibold">Chat with your notes</span>
            </div>
          </button>
        </TiltCard>
      </div>

      {/* Main Content Area: Real Stored Activity */}
      {totalItems === 0 ? (
        <div className="py-14 sm:py-16 text-center border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950/70 p-6 sm:p-10 max-w-xl mx-auto shadow-sm dark:shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-600 dark:text-zinc-400 mx-auto mb-4 shadow-sm">
            <BookOpen className="w-7 h-7 text-slate-900 dark:text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight mb-1.5">Your Workspace is Clean</h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mb-6 leading-relaxed max-w-md mx-auto">
            Ready to get started? Create your first note, start a recorded meeting session, or upload a document to begin organizing your work locally.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Button variant="primary" size="sm" onClick={handleCreateNewNote}>
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Note</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveView('meetings')}>
              <Mic className="w-3.5 h-3.5" />
              <span>Start Meeting</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveView('documents')}>
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Notes */}
          <TiltCard maxTilt={4} scale={1.01} className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-850 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-colors duration-500">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-850 mb-3">
                <span className="text-xs font-bold text-slate-950 dark:text-zinc-200 uppercase tracking-wider">
                  Recent Notes ({notes.length})
                </span>
                <button
                  onClick={() => setActiveView('notes')}
                  className="text-xs font-bold text-slate-900 hover:text-black dark:text-zinc-300 dark:hover:text-white transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {notes.map((n: Note) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setActiveNoteId(n.id);
                      setActiveView('notes');
                    }}
                    className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/40 border border-slate-300 dark:border-zinc-850 hover:bg-slate-200/80 dark:hover:bg-zinc-900 hover:border-slate-400 dark:hover:border-zinc-700 cursor-pointer transition-colors text-xs flex items-center justify-between"
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold text-slate-950 dark:text-zinc-100 truncate">
                        {n.title || 'Untitled Note'}
                      </div>
                      <span className="text-[11px] text-slate-800 dark:text-zinc-400 font-semibold">
                        {new Date(n.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </TiltCard>

          {/* Recent Meetings */}
          <TiltCard maxTilt={4} scale={1.01} className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-850 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-colors duration-500">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-850 mb-3">
                <span className="text-xs font-bold text-slate-950 dark:text-zinc-200 uppercase tracking-wider">
                  Recorded Meetings ({meetings.length})
                </span>
                <button
                  onClick={() => setActiveView('meetings')}
                  className="text-xs font-bold text-slate-900 hover:text-black dark:text-zinc-300 dark:hover:text-white transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {meetings.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-800 dark:text-zinc-400 font-semibold">No meetings recorded yet.</div>
                ) : (
                  meetings.map((m: Meeting) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setActiveMeetingId(m.id);
                        setActiveView('meetings');
                      }}
                      className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/40 border border-slate-300 dark:border-zinc-850 hover:bg-slate-200/80 dark:hover:bg-zinc-900 hover:border-slate-400 dark:hover:border-zinc-700 cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-950 dark:text-zinc-100 truncate">{m.title}</div>
                        <span className="text-[11px] text-slate-800 dark:text-zinc-400 font-semibold">
                          {m.transcript.length} spoken lines
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </TiltCard>

          {/* Recent Documents */}
          <TiltCard maxTilt={4} scale={1.01} className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-850 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-colors duration-500">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-850 mb-3">
                <span className="text-xs font-bold text-slate-950 dark:text-zinc-200 uppercase tracking-wider">
                  Documents ({documents.length})
                </span>
                <button
                  onClick={() => setActiveView('documents')}
                  className="text-xs font-bold text-slate-900 hover:text-black dark:text-zinc-300 dark:hover:text-white transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-800 dark:text-zinc-400 font-semibold">No documents uploaded yet.</div>
                ) : (
                  documents.map((d: DocumentEntity) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        setActiveDocumentId(d.id);
                        setActiveView('documents');
                      }}
                      className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/40 border border-slate-300 dark:border-zinc-850 hover:bg-slate-200/80 dark:hover:bg-zinc-900 hover:border-slate-400 dark:hover:border-zinc-700 cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-950 dark:text-zinc-100 truncate">{d.title}</div>
                        <span className="text-[11px] text-slate-800 dark:text-zinc-400 font-semibold">{d.pageCount} pages</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </TiltCard>

          {/* Operation Manuals */}
          <TiltCard maxTilt={4} scale={1.01} className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-850 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-colors duration-500">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-850 mb-3">
                <span className="text-xs font-bold text-slate-950 dark:text-zinc-200 uppercase tracking-wider">
                  Step Guides ({manuals.length})
                </span>
                <button
                  onClick={() => setActiveView('manuals')}
                  className="text-xs font-bold text-slate-900 hover:text-black dark:text-zinc-300 dark:hover:text-white transition-colors"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {manuals.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-800 dark:text-zinc-400 font-semibold">No guides created yet.</div>
                ) : (
                  manuals.map((man: Manual) => (
                    <div
                      key={man.id}
                      onClick={() => {
                        setActiveManualId(man.id);
                        setActiveView('manuals');
                      }}
                      className="p-3 rounded-lg bg-slate-100/90 dark:bg-zinc-900/40 border border-slate-300 dark:border-zinc-850 hover:bg-slate-200/80 dark:hover:bg-zinc-900 hover:border-slate-400 dark:hover:border-zinc-700 cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-950 dark:text-zinc-100 truncate">{man.title}</div>
                        <span className="text-[11px] text-slate-800 dark:text-zinc-400 font-semibold">{man.steps.length} steps</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-400 shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </TiltCard>
        </div>
      )}
    </div>
  );
};
