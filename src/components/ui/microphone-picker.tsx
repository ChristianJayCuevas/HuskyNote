import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Mic } from 'lucide-react';
import {
  getPreferredMicrophoneId,
  listMicrophones,
  onPreferredMicrophoneChange,
  revealMicrophoneLabels,
  setPreferredMicrophoneId,
  type MicrophoneList,
} from '../../services/audio/microphone';

interface MicrophonePickerProps {
  /** Classes for the chevron trigger, so it can match the button it sits next to */
  triggerClassName?: string;
  /** Which edge of the trigger the menu lines up with */
  align?: 'left' | 'right';
  /** While recording, the stream is already open; a new choice applies to the next recording */
  disabled?: boolean;
}

/** Dropdown next to a record button for choosing which microphone to record from. */
export const MicrophonePicker: React.FC<MicrophonePickerProps> = ({ triggerClassName = '', align = 'right', disabled }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<MicrophoneList | null>(null);
  const [selected, setSelected] = useState(getPreferredMicrophoneId);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setList(await listMicrophones());
    } catch {
      setList({ devices: [], labelsHidden: false });
    }
  }, []);

  // Stay in sync with pickers elsewhere in the app and with plugged or unplugged devices
  useEffect(() => onPreferredMicrophoneChange(setSelected), []);
  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.addEventListener) return;
    devices.addEventListener('devicechange', refresh);
    return () => devices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    refresh();
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
  }, [open, refresh]);

  const choose = (deviceId: string) => {
    setPreferredMicrophoneId(deviceId);
    setSelected(deviceId);
    setOpen(false);
  };

  const showNames = async () => {
    setError(null);
    try {
      await revealMicrophoneLabels();
      await refresh();
    } catch {
      setError('Microphone access was denied, so device names stay hidden.');
    }
  };

  // A saved device that is no longer plugged in falls back to the system default when recording
  const selectedMissing = !!selected && !!list && !list.labelsHidden && !list.devices.some((d) => d.deviceId === selected);

  const item = (deviceId: string, label: string, detail?: string) => {
    const active = selected === deviceId || (deviceId === '' && selectedMissing);
    return (
      <button
        key={deviceId || 'default'}
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={() => choose(deviceId)}
        className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-md text-left text-xs transition-colors ${
          active
            ? 'bg-slate-100 text-slate-950 dark:bg-zinc-850 dark:text-white'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-850/60 dark:hover:text-white'
        }`}
      >
        <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${active ? '' : 'invisible'}`} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{label}</span>
          {detail && <span className="block truncate text-[11px] text-slate-500 dark:text-zinc-500">{detail}</span>}
        </span>
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose microphone"
        title={disabled ? 'Stop recording to change the microphone' : 'Choose microphone'}
        className={`inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${triggerClassName}`}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Microphone"
          className={`absolute top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-2rem)] p-1.5 rounded-lg border shadow-xl bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-[0_8px_24px_rgba(1,4,9,0.75)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            <Mic className="w-3 h-3" />
            <span>Microphone</span>
          </div>

          {item('', 'System default', list?.defaultLabel)}
          {list?.devices.map((d) => item(d.deviceId, d.label))}

          {list === null && <p className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-zinc-500">Looking for microphones...</p>}
          {list && list.devices.length === 0 && !list.labelsHidden && (
            <p className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-zinc-500">No microphones found.</p>
          )}

          {list?.labelsHidden && (
            <button
              type="button"
              onClick={showNames}
              className="w-full mt-1 px-2.5 py-2 rounded-md text-left text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-850/60"
            >
              Allow microphone access to show device names
            </button>
          )}
          {error && <p className="px-2.5 py-1.5 text-[11px] text-red-600 dark:text-red-400">{error}</p>}

          <p className="mt-1 px-2.5 pt-2 pb-1 border-t border-slate-100 dark:border-zinc-800 text-[10px] leading-relaxed text-slate-500 dark:text-zinc-500">
            Used for Voice Type and meeting recordings on this device.
          </p>
        </div>
      )}
    </div>
  );
};
