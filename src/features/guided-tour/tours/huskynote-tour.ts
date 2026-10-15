import type { TourDefinition } from '../types';

/** The sidebar and the list resize handles only show from the md breakpoint up */
const wideScreen = () => window.matchMedia('(min-width: 768px)').matches;

/**
 * The HuskyNote tour: the main flow plus the newer features. Titles and bodies are keys in
 * `src/locales/*.json` (`tour.steps.<id>`). Steps only highlight: clicking a provider card,
 * the Voice Type mic or a profile would change something, so the tour never clicks for you.
 *
 * Bump `version` when the tour changes enough to show it again to people who finished it.
 */
export const huskynoteTour: TourDefinition = {
  id: 'huskynote',
  version: 1,
  steps: [
    {
      id: 'welcome',
      title: 'tour.steps.welcome.title',
      body: 'tour.steps.welcome.body',
    },
    {
      id: 'navigation',
      target: 'sidebar-nav',
      placement: 'right',
      showIf: wideScreen,
      title: 'tour.steps.navigation.title',
      body: 'tour.steps.navigation.body',
      beforeEnter: (ctx) => ctx.showView('dashboard'),
    },
    {
      id: 'profiles',
      target: 'profile-switcher',
      placement: 'right',
      showIf: wideScreen,
      title: 'tour.steps.profiles.title',
      body: 'tour.steps.profiles.body',
    },
    {
      id: 'search',
      target: 'search',
      placement: 'bottom',
      title: 'tour.steps.search.title',
      body: 'tour.steps.search.body',
    },
    {
      id: 'voice-type',
      target: 'voice-type',
      placement: 'bottom',
      title: 'tour.steps.voiceType.title',
      body: 'tour.steps.voiceType.body',
    },
    {
      id: 'notes',
      target: 'new-note',
      placement: 'right',
      title: 'tour.steps.notes.title',
      body: 'tour.steps.notes.body',
      beforeEnter: (ctx) => ctx.showView('notes'),
    },
    {
      id: 'resizable-lists',
      target: 'notes-list',
      placement: 'right',
      showIf: wideScreen,
      title: 'tour.steps.resizableLists.title',
      body: 'tour.steps.resizableLists.body',
    },
    {
      id: 'teams-import',
      target: 'meetings-import',
      placement: 'bottom',
      title: 'tour.steps.teamsImport.title',
      body: 'tour.steps.teamsImport.body',
      beforeEnter: (ctx) => ctx.showView('meetings'),
    },
    {
      id: 'recording',
      target: 'meeting-record',
      placement: 'bottom',
      title: 'tour.steps.recording.title',
      body: 'tour.steps.recording.body',
      beforeEnter: (ctx) => ctx.showView('meetings', { meetingSetup: true }),
    },
    {
      id: 'ai-workspace',
      target: 'ai-workspace-composer',
      placement: 'top',
      title: 'tour.steps.aiWorkspace.title',
      body: 'tour.steps.aiWorkspace.body',
      beforeEnter: (ctx) => ctx.showView('ai-workspace'),
    },
    {
      id: 'ai-providers',
      target: 'ai-providers',
      placement: 'bottom',
      title: 'tour.steps.aiProviders.title',
      body: 'tour.steps.aiProviders.body',
      beforeEnter: (ctx) => ctx.showView('settings', { settingsTab: 'ai' }),
    },
    {
      id: 'transcription',
      target: 'transcription-setup',
      placement: 'top',
      title: 'tour.steps.transcription.title',
      body: 'tour.steps.transcription.body',
      beforeEnter: (ctx) => ctx.showView('settings', { settingsTab: 'transcription' }),
    },
    {
      id: 'finish',
      title: 'tour.steps.finish.title',
      body: 'tour.steps.finish.body',
      beforeEnter: (ctx) => ctx.showView('dashboard'),
    },
  ],
};
