/**
 * Exports: CommandPalette
 *
 * Ctrl/Cmd+K palette on cmdk (CommandDialog). Rendered once by AppLayout; open state lives in
 * useWorkspace().isCommandPaletteOpen. Groups: Create, Go to, Actions. Enter runs the selected
 * (first matching) command.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  Download,
  Feather,
  FileText,
  FileUp,
  GitCommit,
  Home,
  Info,
  Calendar,
  Layers,
  Mic,
  Moon,
  Settings,
  Shield,
  Sparkles,
  Video,
  BookMarked,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspace } from '../../context/workspace-context';
import { useLanguage } from '../../context/language-context';
import { startTourAfterDialogs } from '@/features/guided-tour';
import { useTheme } from '../../context/theme-context';
import { SETTINGS_TAB_STORAGE_KEY } from '../../views/settings-view';
import { createEmptyNote } from '../../services/notes/actions';
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { defaultFilter } from 'cmdk';

interface PaletteAction {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: 'create' | 'goto' | 'actions';
  run: () => void | Promise<void>;
}

const GROUPS: Array<{ id: PaletteAction['group']; heading: string }> = [
  { id: 'create', heading: 'Create' },
  { id: 'goto', heading: 'Go to' },
  { id: 'actions', heading: 'Actions' },
];

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveView,
    addToast,
    setIsExtensionModalOpen,
    setActiveNoteId,
  } = useWorkspace();
  const { t } = useLanguage();
  const { toggleTheme } = useTheme();

  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'new-note',
        title: 'New Note',
        description: 'Create an empty markdown note',
        icon: FileText,
        group: 'create',
        run: async () => {
          try { setActiveNoteId(await createEmptyNote()); }
          catch { addToast('Could not create a note. Check available storage and retry.', 'error'); return; }
          setActiveView('notes');
        },
      },
      {
        id: 'start-meeting',
        title: 'Open meeting setup',
        description: 'Choose an audio source before starting a recording',
        icon: Mic,
        group: 'create',
        run: () => {
          const url = new URL(window.location.href);
          url.searchParams.set('action', 'meeting');
          window.history.replaceState(window.history.state, '', url.toString());
          setActiveView('meetings');
          window.dispatchEvent(new CustomEvent('huskynote:start-meeting'));
        },
      },
      {
        id: 'upload-doc',
        title: 'Upload Document',
        description: 'Choose a PDF, document, or text file',
        icon: FileUp,
        group: 'create',
        run: () => {
          const url = new URL(window.location.href);
          url.searchParams.set('action', 'upload');
          window.history.replaceState(window.history.state, '', url.toString());
          setActiveView('documents');
          window.dispatchEvent(new CustomEvent('huskynote:upload-pdf'));
        },
      },
      {
        id: 'capture-operation',
        title: 'Open guide recorder',
        description: 'Set up a screen recording to create a guide',
        icon: Video,
        group: 'create',
        run: () => {
          setActiveView('studio');
        },
      },
      {
        id: 'go-home',
        title: 'Home',
        description: 'Today, recent work, and action items',
        icon: Home,
        group: 'goto',
        run: () => setActiveView('dashboard'),
      },
      {
        id: 'go-notes',
        title: 'Notes',
        description: 'Markdown notes in this profile',
        icon: FileText,
        group: 'goto',
        run: () => setActiveView('notes'),
      },
      {
        id: 'go-meetings',
        title: 'Meetings',
        description: 'Recordings, transcripts, and reports',
        icon: Mic,
        group: 'goto',
        run: () => setActiveView('meetings'),
      },
      {
        id: 'go-documents',
        title: 'Documents',
        description: 'PDFs and files with the document assistant',
        icon: FileUp,
        group: 'goto',
        run: () => setActiveView('documents'),
      },
      {
        id: 'go-manuals',
        title: 'Manuals',
        description: 'Step-by-step guides from screen recordings',
        icon: BookMarked,
        group: 'goto',
        run: () => setActiveView('manuals'),
      },
      {
        id: 'ask-ai',
        title: 'AI Workspace',
        description: 'Synthesize across notes, meetings, and documents',
        icon: Bot,
        group: 'goto',
        run: () => {
          setActiveView('ai-workspace');
        },
      },
      {
        id: 'templates',
        title: 'Templates Gallery',
        description: 'Browse built-in SOPs, meeting notes, and logs',
        icon: BookOpen,
        group: 'goto',
        run: () => {
          setActiveView('templates');
        },
      },
      {
        id: 'zen-notes',
        title: 'Husky Notes Focus Mode',
        description: 'Distraction-free writing with companion',
        icon: Feather,
        group: 'goto',
        run: () => {
          setActiveView('zen');
        },
      },
      {
        id: 'schedule',
        title: 'Automated Schedule',
        description: 'Timeline agenda, reminders, and calendar planner',
        icon: Calendar,
        group: 'goto',
        run: () => {
          setActiveView('schedule');
        },
      },
      {
        id: 'screen-studio',
        title: 'Screen Recording Studio',
        description: 'Record your screen with webcam',
        icon: Video,
        group: 'goto',
        run: () => {
          setActiveView('studio');
        },
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Configure AI, transcription, integrations, and storage',
        icon: Settings,
        group: 'goto',
        run: () => {
          setActiveView('settings');
        },
      },
      {
        id: 'about',
        title: 'About HuskyNote',
        description: 'Credits and project details',
        icon: Info,
        group: 'goto',
        run: () => setActiveView('about'),
      },
      {
        id: 'changelog',
        title: 'App Updates & Info',
        description: 'See recent updates and system details',
        icon: GitCommit,
        group: 'goto',
        run: () => {
          setActiveView('changelog');
        },
      },
      {
        id: 'privacy',
        title: 'Privacy & Architecture',
        description: 'View local-first boundaries and data ownership',
        icon: Shield,
        group: 'goto',
        run: () => {
          setActiveView('privacy');
        },
      },
      {
        id: 'download',
        title: 'Download App',
        description: 'Desktop apps for Windows, macOS, and Linux',
        icon: Download,
        group: 'goto',
        run: () => setActiveView('download'),
      },
      {
        id: 'landing-page',
        title: 'Return to Landing Page',
        description: 'Explore features, architecture story, and product demo',
        icon: Sparkles,
        group: 'goto',
        run: () => {
          setActiveView('landing');
        },
      },
      {
        id: 'export-workspace',
        title: 'Back up active profile',
        description: 'Open complete backup and recovery, including documents and recordings',
        icon: Download,
        group: 'actions',
        run: () => {
          window.dispatchEvent(new CustomEvent('huskynote:settings-tab', { detail: 'storage' }));
          try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, 'storage'); } catch { /* URL remains the fallback */ }
          setActiveView('settings');
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'storage');
          window.history.replaceState(window.history.state, '', url.toString());
        },
      },
      {
        id: 'chrome-extension',
        title: 'Chrome Extension',
        description: '1-click standalone extension & side panel setup',
        icon: Layers,
        group: 'actions',
        run: () => {
          setIsExtensionModalOpen(true);
        },
      },
      {
        id: 'guided-tour',
        title: t('tour.trigger', 'Take me for a tour'),
        description: 'A short walk through notes, meetings, Voice Type and AI',
        icon: Compass,
        group: 'actions',
        run: () => startTourAfterDialogs('huskynote'),
      },
      {
        id: 'toggle-theme',
        title: 'Toggle theme',
        description: 'Switch between light and dark',
        icon: Moon,
        group: 'actions',
        run: () => toggleTheme(),
      },
    ],
    [setActiveView, setActiveNoteId, addToast, setIsExtensionModalOpen, toggleTheme, t]
  );

  const runAction = (action: PaletteAction) => {
    setIsCommandPaletteOpen(false);
    void action.run();
  };

  // cmdk ranks matches within a group but never reorders the groups themselves, so Enter ran the
  // first group's match ("notes" opened the guide recorder). While searching, show one list ranked
  // by cmdk's own scoring instead. The query clears when the palette closes; start grouped again then.
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!isCommandPaletteOpen) setSearch('');
  }, [isCommandPaletteOpen]);
  const ranked = useMemo(() => {
    const query = search.trim();
    if (!query) return null;
    return actions
      .map((action) => ({ action, score: defaultFilter(action.title, query, [action.description]) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ action }) => action);
  }, [actions, search]);

  const renderItem = (action: PaletteAction) => {
    const Icon = action.icon;
    return (
      <CommandItem key={action.id} value={action.title} keywords={[action.description]} onSelect={() => runAction(action)}>
        <Icon />
        <span className="shrink-0">{action.title}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{action.description}</span>
      </CommandItem>
    );
  };

  return (
    <CommandDialog
      open={isCommandPaletteOpen}
      onOpenChange={setIsCommandPaletteOpen}
      title="Commands"
      description="Search for a command to run"
    >
      {/* Uncontrolled on purpose: cmdk filters and selects synchronously, so Enter right after typing runs the
          first match. The palette remounts on every open, which clears the query. */}
      <CommandInput
        placeholder="Type a command..."
        aria-label="Search commands"
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {ranked ? (
          <CommandGroup key="results">{ranked.map(renderItem)}</CommandGroup>
        ) : (
          GROUPS.map((group) => (
            <CommandGroup key={group.id} heading={group.heading}>
              {actions.filter((action) => action.group === group.id).map(renderItem)}
            </CommandGroup>
          ))
        )}
      </CommandList>
      <CommandFooter aria-hidden="true">
        <span>↑↓ navigate</span>
        <span>·</span>
        <span>↵ select</span>
        <span>·</span>
        <span>esc close</span>
      </CommandFooter>
    </CommandDialog>
  );
};
