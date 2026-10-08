import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/workspace-context';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from '../ui/command-palette';
import { GlobalMascotDock } from '../ui/global-mascot-dock';
import { SpeechStatusIndicator } from '../ui/speech-status-indicator';
import { Toaster } from '../ui/toaster';
import { TooltipProvider } from '../ui/tooltip';
import { UpdateBanner } from '../updates/update-banner';

/**
 * App shell: sidebar (the only <aside>), topbar, update banner and the single <main>.
 * Landing and Download are full width without chrome; Focus mode hides the chrome too.
 */
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeView } = useWorkspace();

  const [showMascot, setShowMascot] = useState<boolean>(() => {
    try {
      return localStorage.getItem('huskynote_mascot_hidden') === 'false';
    } catch {
      return false;
    }
  });

  const updateMascotVisible = (visible: boolean) => {
    setShowMascot(visible);
    try {
      localStorage.setItem('huskynote_mascot_hidden', String(!visible));
    } catch {
      /* storage unavailable */
    }
  };

  // Lets other parts of the UI (e.g. the sidebar help menu) show the companion again
  useEffect(() => {
    const onToggle = (e: Event) => {
      const visible = (e as CustomEvent<boolean>).detail;
      setShowMascot(!!visible);
      try {
        localStorage.setItem('huskynote_mascot_hidden', String(!visible));
      } catch {
        /* storage unavailable */
      }
    };
    window.addEventListener('huskynote:mascot-visible', onToggle);
    return () => window.removeEventListener('huskynote:mascot-visible', onToggle);
  }, []);

  const isFullWidthPage = activeView === 'landing' || activeView === 'download';
  // Focus mode is distraction-free: no sidebar or topbar
  const isFocusMode = activeView === 'zen';
  const showChrome = !isFullWidthPage && !isFocusMode;

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        {showChrome && <Sidebar />}

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {showChrome && <Topbar />}
          <UpdateBanner />
          {/* No bottom padding here: PageContainer already clears the companion button (pb-16), and padding main
              would leave a blank band under the full-height list/detail views. Views with bottom-anchored controls
              (the AI composer) read data-mascot via the group/main variant to make room for it. */}
          <main data-mascot={showMascot && showChrome ? 'true' : undefined} className="group/main relative flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        <CommandPalette />
        {showMascot && <GlobalMascotDock onHide={() => updateMascotVisible(false)} />}
        <SpeechStatusIndicator />
        <Toaster />
      </div>
    </TooltipProvider>
  );
};
