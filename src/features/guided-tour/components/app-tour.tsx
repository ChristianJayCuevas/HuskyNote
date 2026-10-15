import { useCallback, useEffect, useState } from 'react';
import { useWorkspace, type ViewType } from '@/context/workspace-context';
import { TourAutoStart } from '../hooks/use-tour-auto-start';
import { isWorkspaceEmpty } from '../lib/fresh-workspace';
import { showAppView } from '../lib/show-view';
import type { ShowView } from '../types';
import { TourHost } from './tour-host';

/** Full-screen views without the sidebar and top bar the tour points at */
const FULL_SCREEN_VIEWS: ViewType[] = ['landing', 'download', 'zen'];

/**
 * The tour wired to the app: the one tour host, and the first-run start. The tour starts on its
 * own once per device, only in the local app's main window, on a workspace with nothing in it
 * yet; everyone else starts it from Help & about, the command palette, or Settings > About.
 */
export function AppTour() {
  const { activeView, setActiveView, isCloudHost } = useWorkspace();
  const showView = useCallback<ShowView>(
    (view, options) => showAppView(setActiveView, view, options),
    [setActiveView]
  );

  const [freshWorkspace, setFreshWorkspace] = useState(false);
  useEffect(() => {
    let current = true;
    isWorkspaceEmpty()
      .then((empty) => {
        if (current) setFreshWorkspace(empty);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  const autoStart = freshWorkspace && !isCloudHost && !window.opener && !FULL_SCREEN_VIEWS.includes(activeView);

  return (
    <>
      <TourHost activeView={activeView} showView={showView} />
      <TourAutoStart tourId="huskynote" enabled={autoStart} />
    </>
  );
}
