import React, { useEffect } from 'react';
import { useWorkspace } from './context/workspace-context';
import { initializeDatabase } from './db';
import { AppLayout } from './components/layout/app-layout';
import { GlobalSearchModal } from './components/search/global-search-modal';
import { LandingPage } from './views/landing-page';
import { DashboardView } from './views/dashboard-view';
import { NotesView } from './views/notes-view';
import { ZenFocusView } from './views/zen-focus-view';
import { MeetingsView } from './views/meetings-view';
import { ScheduleView } from './views/schedule-view';
import { DocumentsView } from './views/documents-view';
import { ManualsView } from './views/manuals-view';
import { StudioView } from './views/studio-view';
import { AIWorkspaceView } from './components/ai-workspace/ai-workspace-view';
import { TemplateGallery } from './components/templates/template-gallery';
import { SettingsView } from './views/settings-view';
import { AboutView } from './views/about-view';
import { ChangelogView } from './views/changelog-view';
import { PrivacyView } from './views/privacy-view';
import { DownloadView } from './views/download-view';
import { CloudEnvironmentModal } from './components/modals/cloud-environment-modal';
import { ChromeExtensionModal } from './components/modals/chrome-extension-modal';
import { handleGoogleAuthCallback } from './services/calendar/google-calendar';

export const App: React.FC = () => {
  const {
    activeView,
    setActiveView,
    isCloudModalOpen,
    setIsCloudModalOpen,
    isExtensionModalOpen,
    setIsExtensionModalOpen,
  } = useWorkspace();

  // Initialize Dexie IndexedDB and seeds on app boot, or intercept OAuth popup
  useEffect(() => {
    if (handleGoogleAuthCallback()) {
      return;
    }

    initializeDatabase().catch((err) => {
      console.warn('[HuskyNote] DB initialization warning:', err);
    });

    const handleNavigate = (e: any) => {
      const view = e.detail?.view;
      if (view) {
        setActiveView(view);
      }
      if (e.detail?.action === 'new') {
        window.dispatchEvent(new CustomEvent('huskynote:new-note'));
      } else if (e.detail?.action === 'record') {
        window.dispatchEvent(new CustomEvent('huskynote:start-meeting'));
      }
    };

    window.addEventListener('huskynote:navigate', handleNavigate);
    return () => window.removeEventListener('huskynote:navigate', handleNavigate);
  }, [setActiveView]);

  const renderActiveView = () => {
    switch (activeView) {
      case 'landing':
        return <LandingPage />;
      case 'download':
        return <DownloadView />;
      case 'dashboard':
        return <DashboardView />;
      case 'notes':
        return <NotesView />;
      case 'zen':
        return <ZenFocusView />;
      case 'meetings':
        return <MeetingsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'documents':
        return <DocumentsView />;
      case 'manuals':
        return <ManualsView />;
      case 'studio':
        return <StudioView />;
      case 'ai-workspace':
        return <AIWorkspaceView />;
      case 'templates':
        return <TemplateGallery />;
      case 'settings':
        return <SettingsView />;
      case 'about':
        return <AboutView />;
      case 'changelog':
        return <ChangelogView />;
      case 'privacy':
        return <PrivacyView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <AppLayout>
      {renderActiveView()}
      <GlobalSearchModal />
      <CloudEnvironmentModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />
      <ChromeExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />
    </AppLayout>
  );
};

export default App;
