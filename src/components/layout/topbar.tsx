import React from 'react';
import { Command, Menu, Monitor, Moon, Search, Sun, SunMoon, Globe } from 'lucide-react';
import { useWorkspace } from '../../context/workspace-context';
import { useLanguage, type LanguageCode } from '../../context/language-context';
import { useTheme, type ThemePreference } from '../../context/theme-context';
import { getActiveProfile } from '../../services/profiles';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { Separator } from '../ui/separator';
import { SimpleTooltip } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { GlobalMicRecorder } from './global-mic-recorder';
import { ScreenHudLauncher } from '../hud/screen-hud-launcher';
import { tourTarget } from '@/features/guided-tour/tours/targets';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const modifier = isMac ? 'Cmd' : 'Ctrl';

export const Topbar: React.FC = () => {
  const { activeView, setIsCommandPaletteOpen, setIsSearchOpen, setIsMobileSidebarOpen } = useWorkspace();
  const { t, language, setLanguage, languages } = useLanguage();
  const { preference, setPreference } = useTheme();
  const profileName = getActiveProfile().name;

  const getTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return t('nav.home');
      case 'notes':
        return t('nav.notes');
      case 'zen':
        return t('nav.zen');
      case 'meetings':
        return t('nav.meetings');
      case 'schedule':
        return t('nav.schedule');
      case 'documents':
        return t('nav.documents');
      case 'manuals':
        return t('nav.manuals');
      case 'studio':
        return t('nav.studio');
      case 'ai-workspace':
        return t('nav.aiWorkspace');
      case 'templates':
        return t('nav.templates');
      case 'settings':
        return t('nav.settings');
      case 'about':
        return t('nav.about');
      case 'changelog':
        return t('nav.changelog');
      case 'privacy':
        return t('nav.privacy');
      default:
        return 'HuskyNote';
    }
  };

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system', 'System'), icon: Monitor },
  ];

  return (
    <header className="relative z-30 flex h-11 shrink-0 items-center gap-2 bg-background px-3 [-webkit-app-region:drag] [app-region:drag]">
      {/* Left: mobile menu + breadcrumb (pages own their h1) */}
      <div className="flex min-w-0 items-center gap-1 [-webkit-app-region:no-drag] [app-region:no-drag]">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="text-muted-foreground md:hidden"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu />
        </Button>

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li className="hidden min-w-0 max-w-[12rem] truncate text-muted-foreground sm:block">{profileName}</li>
            <li aria-hidden="true" className="hidden text-muted-foreground/60 sm:block">
              /
            </li>
            <li className="min-w-0">
              <span aria-current="page" className="block truncate font-medium text-foreground" title={getTitle()}>
                {getTitle()}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Right: capture tools, search, commands, appearance */}
      <div className="ml-auto flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag] [app-region:no-drag]">
        <GlobalMicRecorder />
        <ScreenHudLauncher />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          {...tourTarget('search')}
          onClick={() => setIsSearchOpen(true)}
          className="text-muted-foreground"
          title={`${t('common.search')} (${modifier}+Shift+F)`}
          aria-label="Search workspace"
        >
          <Search />
          <span className="hidden md:inline">{t('nav.search', 'Search')}</span>
          <Kbd aria-hidden="true" className="ml-1 hidden lg:inline-flex">{isMac ? '⌘⇧F' : 'Ctrl Shift F'}</Kbd>
        </Button>

        <SimpleTooltip content={`Commands (${modifier}+K)`} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden text-muted-foreground sm:inline-flex"
            aria-label="Open commands"
          >
            <Command />
          </Button>
        </SimpleTooltip>

        <DropdownMenu>
          <SimpleTooltip content={t('theme.appearance', 'Appearance')} side="bottom">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Appearance and language"
              >
                <SunMoon />
              </Button>
            </DropdownMenuTrigger>
          </SimpleTooltip>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{t('theme.appearance', 'Appearance')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    <Icon />
                    {option.label}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe />
                <span className="flex-1">{t('language.select')}</span>
                <span className="text-xs uppercase text-muted-foreground">{language}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
                  {languages.map((item) => (
                    <DropdownMenuRadioItem key={item.code} value={item.code}>
                      <span className="flex-1">{item.nativeLabel}</span>
                      <span className="text-xs uppercase text-muted-foreground">{item.code}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
