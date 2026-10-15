import type { ViewType } from '@/context/workspace-context';
import { SETTINGS_TAB_STORAGE_KEY } from '@/views/settings-tabs';
import type { ShowViewOptions } from '../types';

function setSearchParam(name: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(window.history.state, '', url.toString());
}

/**
 * Opens a view for a tour step the same way the command palette does, so it works whether the
 * view is already open (it hears the event) or mounts next (it reads the saved tab or URL).
 */
export function showAppView(
  setActiveView: (view: ViewType) => void,
  view: ViewType,
  options: ShowViewOptions = {}
): void {
  const { settingsTab, meetingSetup } = options;
  if (settingsTab) {
    window.dispatchEvent(new CustomEvent('huskynote:settings-tab', { detail: settingsTab }));
    try {
      localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, settingsTab);
    } catch {
      /* ?tab= below still applies */
    }
  }
  if (meetingSetup) setSearchParam('action', 'meeting');
  setActiveView(view);
  if (settingsTab) setSearchParam('tab', settingsTab);
  if (meetingSetup) window.dispatchEvent(new CustomEvent('huskynote:start-meeting'));
}
