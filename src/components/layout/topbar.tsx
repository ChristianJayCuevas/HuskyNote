import React from 'react';
import { Search, Plus, Mic, FileUp, Menu, Layers } from 'lucide-react';
import { useWorkspace } from '../../context/workspace-context';
import { useLanguage } from '../../context/language-context';
import { Button } from '../ui/button';
import { ModeSwitcher } from './mode-switcher';
import { ThemeToggle } from '../ui/theme-toggle';
import { PhysicsRopeToggle } from '../ui/physics-rope-toggle';
import { LanguageSwitcher } from '../ui/language-switcher';
import { GlobalMicRecorder } from './global-mic-recorder';
import { ScreenHudLauncher } from '../hud/screen-hud-launcher';
import { ChromeIcon } from '../ui/chrome-icon';
import logoImg from '../../assets/official_huskynote.png';

export const Topbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    setIsCommandPaletteOpen,
    setIsMobileSidebarOpen,
    setIsExtensionModalOpen,
  } = useWorkspace();
  const { t } = useLanguage();

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return t('nav.overview');
      case 'notes':
        return t('nav.notes');
      case 'zen':
        return t('nav.zen');
      case 'meetings':
        return t('nav.meetings');
      case 'schedule':
        return t('nav.schedule');
      case 'documents':
        return t('nav.documents');
      case 'manuals':
        return t('nav.manuals');
      case 'studio':
        return t('nav.studio');
      case 'ai-workspace':
        return t('nav.aiWorkspace');
      case 'templates':
        return t('nav.templates');
      case 'settings':
        return t('nav.settings');
      case 'about':
        return t('nav.about');
      case 'changelog':
        return t('nav.changelog');
      case 'privacy':
        return t('nav.privacy');
      default:
        return 'HuskyNote';
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-zinc-800 px-3 sm:px-4 lg:px-6 flex items-center justify-between bg-white/85 dark:bg-canvas-inset/90 backdrop-blur-md shrink-0 gap-2 z-30 transition-colors duration-200 relative [app-region:drag] [-webkit-app-region:drag]">
      {/* Left: Mobile Menu Trigger + App Icon / View Title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 [app-region:no-drag] [-webkit-app-region:no-drag]">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveView('landing')}
          className="md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors flex items-center shrink-0"
          title="HuskyNote — Return to Landing Page"
          aria-label="Return to Landing Page"
        >
          <img src={logoImg} alt="HuskyNote" className="w-6 h-6 rounded-md object-contain" />
        </button>

        {/* Fixed width on desktop keeps the mode switcher in the same spot on every view */}
        <h1
          className="text-sm font-bold text-slate-950 dark:text-white tracking-tight truncate max-w-[120px] sm:max-w-[160px] md:max-w-none md:w-36"
          title={getTitle()}
        >
          {getTitle()}
        </h1>

        {/* Mode Switcher Dropdown */}
        <div className="flex items-center shrink-0 z-30">
          <ModeSwitcher />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 h-full [app-region:no-drag] [-webkit-app-region:no-drag]">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Global Audio & Microphone Recording / Voice Dictation */}
        <GlobalMicRecorder />

        {/* Floating Desktop Screen HUD Toggle */}
        <ScreenHudLauncher />

        {/* Tactile Theme Toggle (Light / Dark) for compact mobile */}
        <div className="sm:hidden">
          <ThemeToggle />
        </div>

        {/* Chrome Extension 1-Click Integration */}
        <button
          onClick={() => setIsExtensionModalOpen(true)}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-canvas border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-700 transition-all text-xs font-semibold shadow-xs group"
          title="HuskyNote Chrome Extension (1-Click Automated Setup)"
          aria-label="Open Chrome Extension setup"
        >
          <ChromeIcon className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" />
          <span className="hidden xl:inline">Chrome Extension</span>
        </button>

        {/* Search / Command Palette Trigger */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900/90 border border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-600 transition-colors text-xs shadow-sm"
          title={`${t('common.search')} (Cmd+K)`}
        >
          <Search className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-zinc-400" />
          <span className="hidden 2xl:inline text-slate-700 dark:text-zinc-400 font-medium">{t('common.search')}</span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-zinc-400 bg-white dark:bg-canvas border border-slate-300 dark:border-zinc-800 rounded font-semibold">
            Cmd+K
          </kbd>
        </button>

        {/* Quick Contextual Actions */}
        {activeView === 'notes' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('huskynote:new-note'));
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Note</span>
          </Button>
        )}

        {activeView === 'meetings' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('huskynote:start-meeting'));
            }}
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Session</span>
          </Button>
        )}

        {activeView === 'documents' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('huskynote:upload-pdf'));
            }}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        )}

        {/* Subtle Divider */}
        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5 hidden sm:block" />

        {/* Physics Lampcord Toggle Hanging Seamlessly Under Topbar */}
        <div className="hidden sm:flex relative items-center justify-center w-8 h-full self-stretch">
          <div className="absolute top-full -mt-[2px] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <PhysicsRopeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
