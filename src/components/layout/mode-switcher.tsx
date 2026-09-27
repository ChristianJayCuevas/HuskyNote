import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace, type ViewType } from '../../context/workspace-context';
import { useSound } from '../../context/sound-context';
import {
  ChevronDown,
  Check,
  Feather,
  Calendar,
  Video,
  LayoutDashboard,
  Layers,
} from 'lucide-react';

interface ModeOption {
  id: ViewType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  hotkey: string;
}

export const ModeSwitcher: React.FC = () => {
  const { activeView, setActiveView } = useWorkspace();
  const { playSwitch, playThock } = useSound();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  const modes: ModeOption[] = [
    {
      id: 'dashboard',
      label: 'Workspace',
      desc: 'Overview of notes, meetings, and documents',
      icon: LayoutDashboard,
      hotkey: `${modKey}+Shift+W`,
    },
    {
      id: 'zen',
      label: 'Husky Notes',
      desc: 'Distraction-free focus with companion',
      icon: Feather,
      hotkey: `${modKey}+Shift+N`,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      desc: 'Planner & upcoming events',
      icon: Calendar,
      hotkey: `${modKey}+Shift+S`,
    },
    {
      id: 'studio',
      label: 'Screen Studio',
      desc: 'Record screen and create guides',
      icon: Video,
      hotkey: `${modKey}+Shift+R`,
    },
  ];

  // Find active mode or fallback to workspace
  const currentMode = modes.find((m) => m.id === activeView) || modes[0];
  const CurrentIcon = currentMode.icon;

  // Cross-platform keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || !e.shiftKey) return;

      const key = e.key.toUpperCase();
      if (key === 'N') {
        e.preventDefault();
        playSwitch(true);
        setActiveView('zen');
        setIsOpen(false);
      } else if (key === 'S') {
        e.preventDefault();
        playSwitch(true);
        setActiveView('schedule');
        setIsOpen(false);
      } else if (key === 'R') {
        e.preventDefault();
        playSwitch(true);
        setActiveView('studio');
        setIsOpen(false);
      } else if (key === 'W') {
        e.preventDefault();
        playSwitch(false);
        setActiveView('dashboard');
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView, playSwitch]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (modeId: ViewType) => {
    playSwitch(modeId !== 'dashboard');
    setActiveView(modeId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative select-none font-sans">
      {/* Dropdown Trigger Button */}
      <button
        onClick={() => {
          playThock();
          setIsOpen((prev) => !prev);
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all duration-150 ${
          isOpen
            ? 'bg-slate-100 dark:bg-zinc-850 border-slate-300 dark:border-zinc-600 text-slate-950 dark:text-white shadow-md dark:shadow-none'
            : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-850 shadow-sm dark:shadow-none'
        }`}
        title={`Current Mode: ${currentMode.label} (Click to switch)`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400 shrink-0" />
        <span className="font-bold text-xs text-slate-950 dark:text-zinc-200 tracking-tight">{currentMode.label}</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-700 dark:text-zinc-400 bg-slate-100 dark:bg-canvas border border-slate-200 dark:border-zinc-800 rounded font-semibold">
          {currentMode.hotkey}
        </kbd>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 dark:text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-slate-800 dark:text-zinc-300' : ''
          }`}
        />
      </button>

      {/* Sleek Floating Menu Dropdown */}
      {isOpen && (
        // Anchored to the trigger's left edge (full width on phones). A translate-x centering
        // class would be overridden by animate-fade-in, whose keyframes set transform.
        <div className="fixed inset-x-4 top-14 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-96 rounded-xl bg-white dark:bg-zinc-900 backdrop-blur-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl dark:shadow-[0_8px_24px_rgba(1,4,9,0.75)] p-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-zinc-800">
          <div className="px-3 py-2 text-[10px] font-mono text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between font-bold">
            <span>Workspace Modes</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">Quick Switch</span>
          </div>

          <div className="py-1.5 space-y-1">
            {modes.map((mode) => {
              const Icon = mode.icon;
              const isActive = activeView === mode.id;

              return (
                <button
                  key={mode.id}
                  onClick={() => handleSelect(mode.id)}
                  onMouseEnter={() => playThock()}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-zinc-850 text-black dark:text-white font-bold shadow-xs'
                      : 'text-slate-900 dark:text-zinc-200 hover:text-black dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                      isActive ? 'bg-slate-200 dark:bg-zinc-800 text-black dark:text-white' : 'bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs ${isActive ? 'font-bold text-black dark:text-white' : 'font-semibold text-slate-900 dark:text-zinc-100'}`}>
                        {mode.label}
                      </span>
                      <kbd className="text-[10px] font-mono text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800 font-semibold shrink-0">
                        {mode.hotkey}
                      </kbd>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-snug whitespace-normal">{mode.desc}</p>
                  </div>

                  {isActive && <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
