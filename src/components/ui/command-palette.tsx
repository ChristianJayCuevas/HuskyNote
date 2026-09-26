import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  FileText,
  Mic,
  FileUp,
  Video,
  Bot,
  Settings,
  Download,
  Shield,
  BookOpen,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useWorkspace } from '../../context/workspace-context';
import { exportWorkspaceToJson } from '../../db';
import { downloadJsonFile } from '../../services/export/json';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveView,
    addToast,
    setIsExtensionModalOpen,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = useMemo(
    () => [
      {
        id: 'new-note',
        title: 'New Note',
        description: 'Create an empty markdown note',
        icon: FileText,
        shortcut: 'Cmd+N',
        run: () => {
          setActiveView('notes');
        },
      },
      {
        id: 'start-meeting',
        title: 'Start Meeting',
        description: 'Begin real-time microphone capture & transcription',
        icon: Mic,
        shortcut: 'Cmd+Shift+M',
        run: () => {
          setActiveView('meetings');
        },
      },
      {
        id: 'upload-doc',
        title: 'Upload Document',
        description: 'Open PDF reader and AI extraction',
        icon: FileUp,
        shortcut: 'Cmd+Shift+U',
        run: () => {
          setActiveView('documents');
        },
      },
      {
        id: 'capture-operation',
        title: 'Capture Operation',
        description: 'Record screen states to generate a manual',
        icon: Video,
        run: () => {
          setActiveView('manuals');
        },
      },
      {
        id: 'ask-ai',
        title: 'AI Workspace',
        description: 'Synthesize across notes, meetings, and documents',
        icon: Bot,
        run: () => {
          setActiveView('ai-workspace');
        },
      },
      {
        id: 'templates',
        title: 'Templates Gallery',
        description: 'Browse built-in SOPs, meeting notes, and logs',
        icon: BookOpen,
        run: () => {
          setActiveView('templates');
        },
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Configure local Ollama and view storage',
        icon: Settings,
        run: () => {
          setActiveView('settings');
        },
      },
      {
        id: 'chrome-extension',
        title: 'Chrome Extension',
        description: '1-click standalone extension & side panel setup',
        icon: Layers,
        shortcut: 'Cmd+Shift+E',
        run: () => {
          setIsExtensionModalOpen(true);
        },
      },
      {
        id: 'export-workspace',
        title: 'Export Workspace',
        description: 'Download JSON archive of all local data',
        icon: Download,
        run: async () => {
          try {
            const jsonStr = await exportWorkspaceToJson();
            const dateStr = new Date().toISOString().split('T')[0];
            downloadJsonFile(`huskynote_backup_${dateStr}.json`, jsonStr);
            addToast('Workspace successfully exported to JSON.', 'success');
          } catch {
            addToast('Failed to export workspace.', 'error');
          }
        },
      },
      {
        id: 'zen-notes',
        title: 'Husky Notes Focus Mode',
        description: 'Distraction-free writing with companion',
        icon: FileText,
        shortcut: 'Cmd+Shift+N',
        run: () => {
          setActiveView('zen');
        },
      },
      {
        id: 'schedule',
        title: 'Automated Schedule',
        description: 'Timeline agenda, reminders, and calendar planner',
        icon: Settings,
        shortcut: 'Cmd+Shift+S',
        run: () => {
          setActiveView('schedule');
        },
      },
      {
        id: 'screen-studio',
        title: 'Screen Recording Studio',
        description: 'Record your screen with webcam',
        icon: Video,
        shortcut: 'Cmd+Shift+R',
        run: () => {
          setActiveView('studio');
        },
      },
      {
        id: 'changelog',
        title: 'App Updates & Info',
        description: 'See recent updates and system details',
        icon: Shield,
        run: () => {
          setActiveView('changelog');
        },
      },
      {
        id: 'privacy',
        title: 'Privacy & Architecture',
        description: 'View local-first boundaries and data ownership',
        icon: Shield,
        run: () => {
          setActiveView('privacy');
        },
      },
      {
        id: 'landing-page',
        title: 'Return to Landing Page',
        description: 'Explore features, architecture story, and product demo',
        icon: Sparkles,
        shortcut: 'Cmd+Shift+L',
        run: () => {
          setActiveView('landing');
        },
      },
    ],
    [setActiveView, addToast]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
        setIsCommandPaletteOpen(false);
      }
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={() => setIsCommandPaletteOpen(false)}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-zinc-850">
          <Search className="w-4 h-4 text-slate-500 dark:text-zinc-400 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none font-medium"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded font-semibold">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400">No matching commands.</div>
          ) : (
            filtered.map((action, index) => {
              const Icon = action.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={action.id}
                  onClick={() => {
                    action.run();
                    setIsCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-zinc-900 text-black dark:text-white'
                      : 'text-slate-800 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-slate-100 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950 dark:text-zinc-100">{action.title}</div>
                      <div className="text-xs text-slate-600 dark:text-zinc-400">{action.description}</div>
                    </div>
                  </div>
                  {action.shortcut && (
                    <kbd className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-950 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-850 font-semibold">
                      {action.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
