import React from 'react';
import { useWorkspace } from '../../context/workspace-context';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '../ui/command-palette';
import { GlobalMascotDock } from '../ui/global-mascot-dock';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeView, toasts, removeToast } = useWorkspace();

  const isFullWidthPage = activeView === 'landing' || activeView === 'download';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 antialiased font-sans transition-colors duration-200">
      {!isFullWidthPage && <Sidebar />}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {!isFullWidthPage && <Topbar />}
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>

      <CommandPalette />
      <GlobalMascotDock />

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
            info: <Info className="w-4 h-4 text-zinc-500 dark:text-zinc-300 shrink-0" />,
          };

          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl text-xs text-slate-800 dark:text-zinc-200 animate-fade-in max-w-sm"
            >
              {icons[toast.type]}
              <span className="flex-1 leading-normal">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 p-0.5 rounded transition-colors"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
