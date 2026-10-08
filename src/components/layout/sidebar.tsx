import React, { useEffect, useState } from 'react';
import {
  Bot,
  BookOpen,
  Calendar,
  CircleHelp,
  Download,
  Feather,
  FileText,
  FileUp,
  GitCommit,
  Home,
  Info,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { HuskyLogo, HuskyMark } from '@/brand';
import { cn } from '@/lib/utils';
import { GithubIcon } from '../ui/github-icon';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { SimpleTooltip } from '../ui/tooltip';
import { AiStatusBadge } from '../ui/ai-status-badge';
import { StatusDot } from '../ui/status-dot';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useWorkspace, type ViewType } from '../../context/workspace-context';
import { useLanguage } from '../../context/language-context';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES } from '../../services/ai/active-provider';
import { isDesktopShell } from '../../services/environment';
import { ProfileSwitcher } from './profile-switcher';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const modifier = isMac ? 'Cmd' : 'Ctrl';

const itemClass =
  'group/item flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-sidebar-foreground transition-colors duration-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent coarse:h-9 [&>svg]:size-4 [&>svg]:shrink-0';

interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon | React.FC<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  trailing?: React.ReactNode;
}

/** One sidebar row. Collapsed rows are icon-only with a tooltip on the right. */
const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  ({ icon: Icon, label, active, collapsed, trailing, className, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(itemClass, collapsed && 'mx-auto size-8 justify-center px-0 coarse:size-9', className)}
        {...props}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {!collapsed && trailing}
      </button>
    );
    return collapsed ? (
      <SimpleTooltip content={label} side="right">
        {button}
      </SimpleTooltip>
    ) : (
      button
    );
  }
);
NavItem.displayName = 'NavItem';

/** Collapsed rows wrapped in another trigger (menus) need the tooltip outside the trigger. */
const CollapsibleTooltip: React.FC<{ collapsed: boolean; label: string; children: React.ReactElement }> = ({
  collapsed,
  label,
  children,
}) => (collapsed ? <SimpleTooltip content={label} side="right">{children}</SimpleTooltip> : children);

interface SidebarBodyProps {
  collapsed: boolean;
  onNavigate: (view: ViewType) => void;
  onToggleCollapsed?: () => void;
}

const SidebarBody: React.FC<SidebarBodyProps> = ({ collapsed, onNavigate, onToggleCollapsed }) => {
  const { activeView, setActiveView, setIsSearchOpen, setIsMobileSidebarOpen } = useWorkspace();
  const { t } = useLanguage();
  const { isConnected, isChecking, selectedModel, checkConnection, startOllamaService, provider } = useAI();
  const isCloud = provider !== 'ollama';
  const aiSummary = `${PROVIDER_NAMES[provider]}: ${isConnected ? selectedModel || 'Ready' : 'Not connected'}`;

  const primaryItems: Array<{ id: ViewType; label: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: t('nav.home'), icon: Home },
    { id: 'ai-workspace', label: t('nav.aiWorkspace'), icon: Bot },
  ];
  const workspaceItems: Array<{ id: ViewType; label: string; icon: LucideIcon }> = [
    { id: 'notes', label: t('nav.notes'), icon: FileText },
    { id: 'meetings', label: t('nav.meetings'), icon: Mic },
    { id: 'schedule', label: t('nav.schedule'), icon: Calendar },
    { id: 'documents', label: t('nav.documents'), icon: FileUp },
    { id: 'manuals', label: t('nav.manuals'), icon: Video },
    { id: 'templates', label: t('nav.templates'), icon: BookOpen },
  ];
  const helpItems: Array<{ id: ViewType; label: string; icon: LucideIcon }> = [
    { id: 'about', label: t('nav.about'), icon: Info },
    { id: 'changelog', label: t('nav.changelog'), icon: GitCommit },
    { id: 'privacy', label: t('nav.privacy'), icon: Shield },
    { id: 'download', label: t('nav.download'), icon: Download },
  ];

  const renderItem = (item: { id: ViewType; label: string; icon: LucideIcon }) => (
    <NavItem
      key={item.id}
      icon={item.icon}
      label={item.label}
      active={activeView === item.id}
      collapsed={collapsed}
      onClick={() => onNavigate(item.id)}
    />
  );

  return (
    <>
      <div className={cn('shrink-0 px-2 pb-1', collapsed && 'flex justify-center')}>
        <ProfileSwitcher collapsed={collapsed} />
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        <div className="space-y-0.5">
          <NavItem
            icon={Search}
            label={t('nav.search', 'Search')}
            collapsed={collapsed}
            aria-keyshortcuts={isMac ? 'Meta+Shift+F' : 'Control+Shift+F'}
            onClick={() => {
              setIsMobileSidebarOpen(false);
              setIsSearchOpen(true);
            }}
            trailing={
              <Kbd aria-hidden="true" className="hidden bg-sidebar-accent opacity-0 transition-opacity duration-100 group-hover/item:opacity-100 group-focus-visible/item:opacity-100 md:inline-flex">
                {isMac ? '⌘⇧F' : 'Ctrl Shift F'}
              </Kbd>
            }
          />
          {primaryItems.map(renderItem)}
        </div>

        {collapsed ? (
          <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
        ) : (
          <div className="px-2 pb-1 pt-4 text-xs font-medium text-sidebar-foreground/70">{t('nav.sectionWorkspace', 'Workspace')}</div>
        )}
        <div className="space-y-0.5">{workspaceItems.map(renderItem)}</div>
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border p-2">
        <NavItem
          icon={Settings}
          label={t('nav.settings')}
          active={activeView === 'settings'}
          collapsed={collapsed}
          onClick={() => onNavigate('settings')}
        />

        <DropdownMenu>
          <CollapsibleTooltip collapsed={collapsed} label={t('nav.help', 'Help & about')}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={collapsed ? t('nav.help', 'Help & about') : undefined}
                className={cn(itemClass, collapsed && 'mx-auto size-8 justify-center px-0 coarse:size-9')}
              >
                <CircleHelp className="size-4 shrink-0" />
                {!collapsed && <span className="min-w-0 flex-1 truncate">{t('nav.help', 'Help & about')}</span>}
              </button>
            </DropdownMenuTrigger>
          </CollapsibleTooltip>
          <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'start'} className="w-56">
            {helpItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.id} onSelect={() => onNavigate(item.id)}>
                  <Icon />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="https://github.com/ChristianJayCuevas/HuskyNote" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="size-4 text-muted-foreground" />
                <span className="flex-1">GitHub</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => window.dispatchEvent(new CustomEvent('huskynote:mascot-visible', { detail: true }))}
            >
              <Feather />
              Show Husky companion
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal tabular-nums">HuskyNote v{__APP_VERSION__}</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>

        {collapsed ? (
          <>
            {onToggleCollapsed && (
              <NavItem
                icon={PanelLeftOpen}
                label={`Expand sidebar (${modifier}+B)`}
                collapsed
                onClick={onToggleCollapsed}
              />
            )}
            <SimpleTooltip content={aiSummary} side="right">
              <button
                type="button"
                onClick={() => checkConnection()}
                aria-label="Refresh connection"
                className={cn(itemClass, 'relative mx-auto size-8 justify-center px-0')}
              >
                <RefreshCw className={cn('size-4', isChecking && 'animate-spin')} />
                <StatusDot tone={isConnected ? 'success' : 'muted'} className="absolute right-1 top-1 size-1.5" />
              </button>
            </SimpleTooltip>
          </>
        ) : (
          <div className="pt-1">
            <div className="flex h-8 items-center gap-1 pl-2">
              <AiStatusBadge className="min-w-0 flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => checkConnection()}
                title="Refresh connection"
                aria-label="Refresh connection"
                className="text-muted-foreground"
              >
                <RefreshCw className={cn(isChecking && 'animate-spin')} />
              </Button>
            </div>
            {!isConnected && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="mt-1 w-full"
                onClick={() => (isCloud ? setActiveView('settings') : startOllamaService())}
              >
                <Power />
                {isCloud ? `Set Up ${PROVIDER_NAMES[provider]}` : 'Start Local AI'}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export const Sidebar: React.FC = () => {
  const { setActiveView, isMobileSidebarOpen, setIsMobileSidebarOpen } = useWorkspace();
  const showTrafficLightSpacer = isDesktopShell() && isMac;

  // Collapsed state persisted to localStorage for desktop
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('huskynote_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('huskynote_sidebar_collapsed', String(isCollapsed));
    } catch {
      /* storage unavailable */
    }
  }, [isCollapsed]);

  // Global Cmd/Ctrl+B toggles the sidebar, except while typing (editors use it for bold)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (view: ViewType) => {
    setActiveView(view);
    setIsMobileSidebarOpen(false);
  };

  const brandButton = (collapsed: boolean, onClick: () => void) =>
    collapsed ? (
      <SimpleTooltip content="Home" side="right">
        <button
          type="button"
          onClick={onClick}
          aria-label="Go to Home"
          className="mx-auto flex size-8 items-center justify-center rounded-md transition-colors duration-100 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <HuskyMark size={24} />
        </button>
      </SimpleTooltip>
    ) : (
      <button
        type="button"
        onClick={onClick}
        aria-label="Go to Home"
        title="HuskyNote: go to Home"
        className="flex h-8 min-w-0 items-center rounded-md px-1.5 text-sidebar-accent-foreground transition-colors duration-100 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <HuskyLogo size="sm" title="" />
      </button>
    );

  return (
    <>
      {/* Desktop sidebar (the only <aside> in the app) */}
      <aside
        className={cn(
          'group/sidebar z-30 hidden h-full shrink-0 select-none flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-standard md:flex',
          isCollapsed ? 'w-14' : 'w-60'
        )}
      >
        {showTrafficLightSpacer && <div className="h-8 w-full shrink-0 [-webkit-app-region:drag] [app-region:drag]" />}

        <div className={cn('flex h-11 shrink-0 items-center gap-1 px-2', isCollapsed && 'justify-center')}>
          {brandButton(isCollapsed, () => setActiveView('dashboard'))}
          {!isCollapsed && (
            <SimpleTooltip content={`Collapse sidebar (${modifier}+B)`} side="bottom">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsCollapsed(true)}
                aria-label="Collapse sidebar"
                className="ml-auto text-muted-foreground opacity-0 hover:bg-sidebar-accent focus-visible:opacity-100 group-hover/sidebar:opacity-100 coarse:opacity-100"
              >
                <PanelLeftClose />
              </Button>
            </SimpleTooltip>
          )}
        </div>

        <SidebarBody collapsed={isCollapsed} onNavigate={handleNavigate} onToggleCollapsed={() => setIsCollapsed(false)} />
      </aside>

      {/* Phones: the same contents in a sheet */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0 text-sidebar-foreground md:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-11 shrink-0 items-center px-2 pr-12">
            {brandButton(false, () => handleNavigate('dashboard'))}
          </div>
          <SidebarBody collapsed={false} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>
    </>
  );
};
