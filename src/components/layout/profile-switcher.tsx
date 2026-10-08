import React, { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { createProfileWithSettings, deleteProfileAndData } from '../../db';
import {
  DEFAULT_PROFILE_ID,
  MAX_PROFILE_NAME_LENGTH,
  getActiveProfile,
  listProfiles,
  renameProfile,
  setActiveProfileId,
  type Profile,
} from '../../services/profiles';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { SimpleTooltip } from '../ui/tooltip';

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** Switching reloads the app so every screen reopens with the other profile's database. */
function openProfile(id: string): void {
  setActiveProfileId(id);
  window.location.reload();
}

type Pending = { kind: 'switch' | 'delete'; profile: Profile } | { kind: 'rename'; profile: Profile; name: string } | null;

/**
 * Sidebar workspace switcher (Notion style): each profile is a separate workspace for a job or
 * project. The popover lists profiles and lets you add, rename, or delete them.
 */
export const ProfileSwitcher: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const active = getActiveProfile();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(listProfiles);
  const [pending, setPending] = useState<Pending>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setProfiles(listProfiles());
    } else {
      setPending(null);
      setAdding(false);
      setNewName('');
      setError(null);
    }
  }, [open]);

  const run = async (action: () => Promise<void> | void) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    run(async () => {
      const profile = await createProfileWithSettings(newName);
      openProfile(profile.id);
    });

  const handleRename = (profile: Profile, name: string) =>
    run(() => {
      renameProfile(profile.id, name);
      setProfiles(listProfiles());
      setPending(null);
    });

  const handleDelete = (profile: Profile) =>
    run(async () => {
      await deleteProfileAndData(profile.id);
      setProfiles(listProfiles());
      setPending(null);
    });

  const trigger = (
    <button
      type="button"
      title={`Profile: ${active.name}`}
      aria-label={collapsed ? `Profile: ${active.name}` : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md text-left transition-colors duration-100 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent',
        collapsed ? 'size-8 justify-center' : 'h-9 w-full px-2'
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
        {initial(active.name)}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-accent-foreground">{active.name}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <SimpleTooltip content={`Profile: ${active.name}`} side="right">
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </SimpleTooltip>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}
      <PopoverContent
        side={collapsed ? 'right' : 'bottom'}
        align="start"
        className="w-72 p-1"
        aria-label="Profiles"
      >
        <div className="px-2 pb-1.5 pt-1.5 text-xs font-medium text-muted-foreground">Profiles</div>

        <div className="space-y-px">
          {profiles.map((p) => {
            const isActive = p.id === active.id;
            if (pending?.profile.id === p.id && pending.kind === 'rename') {
              return (
                <form
                  key={p.id}
                  className="flex items-center gap-1.5 px-1 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRename(p, pending.name);
                  }}
                >
                  <Input
                    autoFocus
                    value={pending.name}
                    maxLength={MAX_PROFILE_NAME_LENGTH}
                    onChange={(e) => setPending({ ...pending, name: e.target.value })}
                    className="h-7 flex-1"
                    aria-label="Profile name"
                  />
                  <Button type="submit" size="sm" disabled={busy}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPending(null)}
                    aria-label="Cancel rename"
                  >
                    <X />
                  </Button>
                </form>
              );
            }
            if (pending?.profile.id === p.id && (pending.kind === 'switch' || pending.kind === 'delete')) {
              const deleting = pending.kind === 'delete';
              return (
                <div key={p.id} className={cn('rounded-md px-2.5 py-2', deleting ? 'bg-destructive/10' : 'bg-muted')}>
                  <p className="text-xs leading-relaxed text-foreground">
                    {deleting ? (
                      <>
                        Delete <strong>{p.name}</strong> and all of its notes, meetings, documents, and settings? This
                        cannot be undone.
                      </>
                    ) : (
                      <>
                        Switch to <strong>{p.name}</strong>? The app reloads, and anything being recorded stops.
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="xs"
                      variant={deleting ? 'destructive' : 'default'}
                      disabled={busy}
                      onClick={() => (deleting ? handleDelete(p) : openProfile(p.id))}
                    >
                      {deleting ? 'Delete profile' : 'Switch'}
                    </Button>
                    <Button type="button" size="xs" variant="ghost" onClick={() => setPending(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={p.id} className="group flex items-center rounded-md transition-colors duration-100 hover:bg-accent">
                <button
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => !isActive && setPending({ kind: 'switch', profile: p })}
                  className={cn(
                    'flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'font-medium text-foreground' : 'text-foreground'
                  )}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initial(p.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {isActive && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPending({ kind: 'rename', profile: p, name: p.name })}
                  className="size-6 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 coarse:opacity-100"
                  title={`Rename ${p.name}`}
                  aria-label={`Rename ${p.name}`}
                >
                  <Pencil className="size-3" />
                </Button>
                {p.id !== DEFAULT_PROFILE_ID && !isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPending({ kind: 'delete', profile: p })}
                    className="mr-1 size-6 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 coarse:opacity-100"
                    title={`Delete ${p.name}`}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-1 border-t pt-1">
          {adding ? (
            <form
              className="flex items-center gap-1.5 px-1 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <Input
                autoFocus
                value={newName}
                maxLength={MAX_PROFILE_NAME_LENGTH}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Job or project name"
                className="h-7 flex-1"
                aria-label="New profile name"
              />
              <Button type="submit" size="sm" disabled={busy || !newName.trim()}>
                Create
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-4" />
              New profile
            </button>
          )}
          {error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
          <p className="px-2 pb-1 pt-1.5 text-xs leading-relaxed text-muted-foreground">
            Each profile keeps its own notes, meetings, documents, manuals, and schedule. A new profile starts with your
            current AI and transcription settings.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
