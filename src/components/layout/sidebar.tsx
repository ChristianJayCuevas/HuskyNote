import React, { useState, useEffect } from 'react';
import {
  Home,
  FileText,
  Mic,
  FileUp,
  Video,
  Bot,
  BookOpen,
  Settings,
  Shield,
  Info,
  Power,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Feather,
  Calendar,
  GitCommit,
  X,
  Download,
  Sparkles,
  Layers,
  Star,
} from 'lucide-react';
import { GithubIcon } from '../ui/github-icon';
import { ChromeIcon } from '../ui/chrome-icon';
import { useWorkspace, type ViewType } from '../../context/workspace-context';
import { useLanguage } from '../../context/language-context';
import { useAI } from '../../context/ai-context';
import { useGitHubStars } from '../../services/github/stars';
import logoImg from '../../assets/official_huskynote.png';
import { ProfileSwitcher } from './profile-switcher';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setIsExtensionModalOpen,
  } = useWorkspace();
  const { t } = useLanguage();
  const { isConnected, isChecking, selectedModel, checkConnection, startOllamaService, provider } = useAI();
  const isClaude = provider === 'claude';
  const aiActiveLabel = isClaude ? 'Claude Active' : 'Local AI Active';
  const aiOfflineLabel = isClaude ? 'Claude not connected' : 'Local AI offline';
  const { starCount } = useGitHubStars();

  // Collapsible state persisted to localStorage for desktop
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('huskynote_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('huskynote_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Global Cmd+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: t('nav.home'), icon: Home },
    { id: 'notes', label: t('nav.notes'), icon: FileText },
    { id: 'zen', label: t('nav.zen'), icon: Feather },
    { id: 'meetings', label: t('nav.meetings'), icon: Mic },
    { id: 'schedule', label: t('nav.schedule'), icon: Calendar },
    { id: 'documents', label: t('nav.documents'), icon: FileUp },
    { id: 'manuals', label: t('nav.manuals'), icon: Video },
    { id: 'studio', label: t('nav.studio'), icon: Video },
    { id: 'ai-workspace', label: t('nav.aiWorkspace'), icon: Bot },
    { id: 'templates', label: t('nav.templates'), icon: BookOpen },
  ];

  const secondaryItems: Array<{ id: ViewType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'download', label: t('nav.download'), icon: Download },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
    { id: 'about', label: t('nav.about'), icon: Info },
    { id: 'changelog', label: t('nav.changelog'), icon: GitCommit },
    { id: 'privacy', label: t('nav.privacy'), icon: Shield },
  ];

  const handleNavClick = (viewId: ViewType) => {
    setActiveView(viewId);
    setIsMobileSidebarOpen(false);
  };

  const renderNavContent = (collapsed: boolean) => (
    <>
      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto scrollbar-none">
        {!collapsed && (
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-mono tracking-widest text-slate-800 dark:text-zinc-400 uppercase font-bold">
            Workspace
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative w-full flex items-center ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                isActive
                  ? 'bg-slate-950 text-white dark:bg-zinc-850 dark:text-white font-semibold shadow-sm border border-slate-900 dark:border-zinc-800 backdrop-blur-md'
                  : 'text-slate-900 dark:text-zinc-200 font-semibold hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 border border-transparent'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-400 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] dark:shadow-none" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive
                    ? 'text-emerald-400 dark:text-white'
                    : 'text-slate-700 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-zinc-100'
                }`}
              />
              {!collapsed && (
                <span className={`ml-3 truncate tracking-tight text-[13px] ${
                  isActive ? 'font-semibold text-white' : 'font-semibold'
                }`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-2" />
        {!collapsed && (
          <div className="px-3 pt-2 pb-1.5 text-[10px] font-mono tracking-widest text-slate-800 dark:text-zinc-400 uppercase font-bold">
            System
          </div>
        )}
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              title={collapsed ? item.label : undefined}
              className={`group relative w-full flex items-center ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                isActive
                  ? 'bg-slate-950 text-white dark:bg-zinc-850 dark:text-white font-semibold shadow-sm border border-slate-900 dark:border-zinc-800 backdrop-blur-md'
                  : 'text-slate-900 dark:text-zinc-200 font-semibold hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 border border-transparent'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-400 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] dark:shadow-none" />
              )}

              <Icon
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive
                    ? 'text-emerald-400 dark:text-white'
                    : 'text-slate-700 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-zinc-100'
                }`}
              />
              {!collapsed && (
                <span className={`ml-3 truncate tracking-tight text-[13px] ${
                  isActive ? 'font-semibold text-white' : 'font-semibold'
                }`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        {/* Chrome Extension 1-Click Integration in Sidebar */}
        <button
          onClick={() => {
            setIsExtensionModalOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          title={collapsed ? 'Chrome Extension' : undefined}
          className={`group relative w-full flex items-center ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          } rounded-xl text-xs font-medium transition-all duration-150 active:scale-[0.98] text-slate-900 dark:text-zinc-200 font-semibold hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 border border-transparent`}
        >
          <ChromeIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
          {!collapsed && (
            <div className="ml-3 flex-1 flex items-center justify-between min-w-0">
              <span className="truncate tracking-tight text-[13px] font-semibold">
                Chrome Extension
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 font-bold">
                1-Click
              </span>
            </div>
          )}
        </button>
      </nav>

      {/* Local AI Status Hardware Card */}
      <div className="p-2.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-canvas transition-colors">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-red-500 animate-pulse'
              }`}
              title={isConnected ? `${aiActiveLabel} (${selectedModel || 'Ready'})` : aiOfflineLabel}
            />
            <button
              onClick={() => checkConnection()}
              className="p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
              title="Refresh connection"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isConnected ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-red-500 animate-pulse'
                  }`}
                />
                <span className="text-xs font-bold text-slate-950 dark:text-zinc-200 truncate">
                  {isConnected ? aiActiveLabel : 'AI Offline'}
                </span>
              </div>
              <button
                onClick={() => checkConnection()}
                title="Refresh connection"
                className="p-1 rounded text-slate-500 dark:text-zinc-500 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-700 dark:text-zinc-400 font-semibold truncate mb-2">
              {isConnected ? selectedModel || 'Ready' : aiOfflineLabel}
            </div>

            {!isConnected && (
              <button
                onClick={() => (isClaude ? setActiveView('settings') : startOllamaService())}
                className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-slate-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-[10px] font-semibold transition-colors shadow-sm"
              >
                <Power className="w-3 h-3 text-emerald-400" />
                <span>{isClaude ? 'Set Up Claude' : 'Start Local AI'}</span>
              </button>
            )}
          </div>
        )}

        {/* Footer Meta */}
        {!collapsed && (
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] font-mono text-slate-600 dark:text-zinc-500 font-semibold">
            <span>{t('nav.localWorkspace')}</span>
            <a
              href="https://github.com/ChristianJayCuevas/HuskyNote"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-black dark:hover:text-zinc-300 transition-colors"
              title="Star HuskyNote on GitHub"
            >
              <GithubIcon className="w-3 h-3" />
              <span>GitHub</span>
              {starCount !== null && (
                <span className="flex items-center gap-0.5 text-[9px] font-mono text-amber-500">
                  <Star className="w-2.5 h-2.5 fill-amber-500" />
                  <span>{starCount.toLocaleString()}</span>
                </span>
              )}
            </a>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside
        className={`hidden md:flex flex-col h-screen select-none shrink-0 transition-all duration-300 ease-in-out z-30 ${
          isCollapsed ? 'w-16' : 'w-60 lg:w-64'
        } bg-white dark:bg-canvas-inset border-r border-slate-200 dark:border-zinc-800`}
      >
        {/* macOS Titlebar & Traffic Light Clearance Area */}
        <div className="h-8 w-full shrink-0 flex items-center px-4 select-none [app-region:drag] [-webkit-app-region:drag]" />

        {/* Brand Header — logo hidden when collapsed, only toggle button shown */}
        <div className={`pb-3 border-b border-slate-200 dark:border-zinc-800 flex items-center ${
          isCollapsed ? 'justify-center px-2' : 'px-3.5 justify-between'
        }`}>
          {/* Logo + name: only visible when expanded */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setActiveView('landing')}
              className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-85 transition-opacity min-w-0 group"
              title="HuskyNote — Return to Landing Page"
              aria-label="Return to Landing Page"
            >
              <img
                src={logoImg}
                alt="HuskyNote"
                className="w-8 h-8 rounded-xl object-contain shrink-0 shadow-md border border-slate-200 dark:border-zinc-800 group-hover:scale-105 transition-transform"
              />
              <div className="truncate">
                <div className="font-bold text-sm text-slate-950 dark:text-white tracking-tight leading-none truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  HuskyNote
                </div>
                <div className="text-[10px] font-mono text-slate-800 dark:text-zinc-300 font-bold mt-1 tracking-tight truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                  <span>Personal Secretary</span>
                </div>
              </div>
            </button>
          )}

          {/* Collapse / Expand toggle — always visible */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
            title={isCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Profile switcher: each profile is a separate workspace for a job or project */}
        <div className={`py-2.5 border-b border-slate-200 dark:border-zinc-800 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          <ProfileSwitcher collapsed={isCollapsed} />
        </div>

        {renderNavContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer Overlay & Sidebar (visible on mobile when open) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex select-none">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
          />

          {/* Drawer Body */}
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-canvas-inset border-r border-slate-200 dark:border-zinc-850 flex flex-col h-full z-10 shadow-2xl animate-fade-in">
            <div className="p-3.5 border-b border-slate-200 dark:border-zinc-850 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setActiveView('landing');
                  setIsMobileSidebarOpen(false);
                }}
                className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-85 transition-opacity"
                title="HuskyNote — Return to Landing Page"
                aria-label="Return to Landing Page"
              >
                <img src={logoImg} alt="HuskyNote" className="w-7 h-7 rounded-lg object-contain shrink-0 shadow-xs" />
                <div>
                  <div className="font-bold text-xs text-slate-950 dark:text-white tracking-tight">HuskyNote</div>
                  <div className="text-[10px] font-mono text-slate-800 dark:text-zinc-300 font-bold mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                    <span>Personal Secretary</span>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                title="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-zinc-800">
              <ProfileSwitcher />
            </div>

            {renderNavContent(false)}
          </div>
        </div>
      )}
    </>
  );
};
