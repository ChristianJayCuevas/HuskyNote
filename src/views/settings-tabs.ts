/** Settings tabs, and the key that remembers the last one opened. Kept apart from the Settings view so callers that only open a tab don't import it. */
export type SettingsTab = 'ai' | 'transcription' | 'integrations' | 'storage' | 'about';

export const SETTINGS_TAB_STORAGE_KEY = 'huskynote-settings-tab';
