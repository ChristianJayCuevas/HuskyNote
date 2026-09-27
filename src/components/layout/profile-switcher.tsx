import React, { useEffect, useRef, useState } from 'react';
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

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** Switching reloads the app so every screen reopens with the other profile's database. */
function openProfile(id: string): void {
  setActiveProfileId(id);
  window.location.reload();
}

type Pending = { kind: 'switch' | 'delete'; profile: Profile } | { kind: 'rename'; profile: Profile; name: string } | null;

/**
 * Sidebar control for switching between profiles, each a separate workspace
 * for a job or project, and for adding, renaming, or deleting them.
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setProfiles(listProfiles());
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
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

  const inputClass =
    'flex-1 min-w-0 px-2 py-1.5 rounded-md text-xs bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-slate-500 dark:bg-canvas dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500';
  const smallButton =
    'px-2 py-1.5 rounded-md text-[11px] font-semibold disabled:opacity-50 transition-colors';
  const primary = `${smallButton} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200`;
  const quiet = `${smallButton} text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-850`;

  return (
    <div ref={rootRef} className={`relative ${collapsed ? 'flex justify-center' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Profile: ${active.name}`}
        className={`flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850 transition-colors ${
          collapsed ? 'p-1.5' : 'w-full px-2.5 py-2 text-left'
        }`}
      >
        <span className="w-6 h-6 shrink-0 rounded-md bg-slate-900 text-white dark:bg-white dark:text-black text-[11px] font-bold flex items-center justify-center">
          {initial(active.name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 leading-none">
                Profile
              </span>
              <span className="block mt-1 text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate leading-none">
                {active.name}
              </span>
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-500" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profiles"
          className={`absolute z-50 w-72 max-w-[calc(100vw-2rem)] p-1.5 rounded-lg border shadow-xl bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-[0_8px_24px_rgba(1,4,9,0.75)] ${
            collapsed ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1.5'
          }`}
        >
          <div className="px-2.5 pt-1.5 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            Profiles
          </div>

          {profiles.map((p) => {
            const isActive = p.id === active.id;
            if (pending?.profile.id === p.id && pending.kind === 'rename') {
              return (
                <form
                  key={p.id}
                  className="flex items-center gap-1.5 px-1.5 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRename(p, pending.name);
                  }}
                >
                  <input
                    autoFocus
                    value={pending.name}
                    maxLength={MAX_PROFILE_NAME_LENGTH}
                    onChange={(e) => setPending({ ...pending, name: e.target.value })}
                    className={inputClass}
                    aria-label="Profile name"
                  />
                  <button type="submit" disabled={busy} className={primary}>
                    Save
                  </button>
                  <button type="button" onClick={() => setPending(null)} className={quiet} aria-label="Cancel rename">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              );
            }
            if (pending?.profile.id === p.id && (pending.kind === 'switch' || pending.kind === 'delete')) {
              const deleting = pending.kind === 'delete';
              return (
                <div key={p.id} className="px-2.5 py-2 rounded-md bg-slate-50 dark:bg-zinc-850/60">
                  <p className="text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300">
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
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => (deleting ? handleDelete(p) : openProfile(p.id))}
                      className={
                        deleting
                          ? `${smallButton} bg-red-600 text-white hover:bg-red-700`
                          : primary
                      }
                    >
                      {deleting ? 'Delete profile' : 'Switch'}
                    </button>
                    <button type="button" onClick={() => setPending(null)} className={quiet}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={p.id} className="group flex items-center rounded-md hover:bg-slate-50 dark:hover:bg-zinc-850/60">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => !isActive && setPending({ kind: 'switch', profile: p })}
                  className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-left text-xs ${
                    isActive ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${isActive ? '' : 'invisible'}`} />
                  <span className="w-5 h-5 shrink-0 rounded bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-bold flex items-center justify-center">
                    {initial(p.name)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPending({ kind: 'rename', profile: p, name: p.name })}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title={`Rename ${p.name}`}
                  aria-label={`Rename ${p.name}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {p.id !== DEFAULT_PROFILE_ID && !isActive && (
                  <button
                    type="button"
                    onClick={() => setPending({ kind: 'delete', profile: p })}
                    className="p-1.5 mr-1 rounded text-slate-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title={`Delete ${p.name}`}
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
            {adding ? (
              <form
                className="flex items-center gap-1.5 px-1.5 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
              >
                <input
                  autoFocus
                  value={newName}
                  maxLength={MAX_PROFILE_NAME_LENGTH}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Job or project name"
                  className={inputClass}
                  aria-label="New profile name"
                />
                <button type="submit" disabled={busy || !newName.trim()} className={primary}>
                  Create
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-850/60"
              >
                <Plus className="w-3.5 h-3.5" />
                New profile
              </button>
            )}
            {error && <p className="px-2.5 py-1.5 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
            <p className="px-2.5 pt-1.5 pb-1 text-[10px] leading-relaxed text-slate-500 dark:text-zinc-500">
              Each profile keeps its own notes, meetings, documents, manuals, and schedule. A new profile starts with your
              current AI and transcription settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
