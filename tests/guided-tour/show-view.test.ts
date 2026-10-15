// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showAppView } from '../../src/features/guided-tour/lib/show-view';
import { SETTINGS_TAB_STORAGE_KEY } from '../../src/views/settings-tabs';

describe('showAppView: the tour opening a view the way the rest of the app does', () => {
  const events: string[] = [];
  const record = (event: Event) => events.push(`${event.type}:${(event as CustomEvent).detail ?? ''}`);

  beforeEach(() => {
    events.length = 0;
    localStorage.clear();
    window.history.replaceState(null, '', '/?view=dashboard');
    window.addEventListener('huskynote:settings-tab', record);
    window.addEventListener('huskynote:start-meeting', record);
  });
  afterEach(() => {
    window.removeEventListener('huskynote:settings-tab', record);
    window.removeEventListener('huskynote:start-meeting', record);
  });

  it('switches to a plain view and touches nothing else', () => {
    const setActiveView = vi.fn();
    showAppView(setActiveView, 'notes');
    expect(setActiveView).toHaveBeenCalledWith('notes');
    expect(events).toEqual([]);
    expect(window.location.search).toBe('?view=dashboard');
  });

  it('opens a Settings tab whether or not Settings is already open', () => {
    const setActiveView = vi.fn((view: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set('view', view);
      window.history.pushState({ view }, '', url.toString());
    });
    showAppView(setActiveView, 'settings', { settingsTab: 'transcription' });
    expect(setActiveView).toHaveBeenCalledWith('settings');
    // An open Settings view hears the event; one that mounts next reads the saved tab or ?tab=
    expect(events).toEqual(['huskynote:settings-tab:transcription']);
    expect(localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)).toBe('transcription');
    expect(new URL(window.location.href).searchParams.get('tab')).toBe('transcription');
  });

  it('opens the meeting setup screen before Meetings mounts and while it is open', () => {
    let actionWhenSwitching: string | null = null;
    const setActiveView = vi.fn(() => {
      actionWhenSwitching = new URL(window.location.href).searchParams.get('action');
    });
    showAppView(setActiveView, 'meetings', { meetingSetup: true });
    // A Meetings view that mounts reads ?action=meeting; one already open hears the event
    expect(actionWhenSwitching).toBe('meeting');
    expect(events).toEqual(['huskynote:start-meeting:']);
  });

  it('still opens the tab when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      showAppView(vi.fn(), 'settings', { settingsTab: 'ai' });
      expect(new URL(window.location.href).searchParams.get('tab')).toBe('ai');
    } finally {
      setItem.mockRestore();
    }
  });
});
