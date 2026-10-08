/**
 * Exports: MicrophonePicker
 *
 * MicrophonePicker({ triggerClassName?, align?: 'left' | 'right', disabled? }): chevron trigger (style it with
 * triggerClassName to match the record button beside it, e.g. buttonVariants({ size: 'icon' }) + rounded-l-none)
 * opening a DropdownMenu radio group of microphones. The choice is saved for Voice Type and meetings.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Mic } from 'lucide-react';
import {
  getPreferredMicrophoneId,
  listMicrophones,
  onPreferredMicrophoneChange,
  revealMicrophoneLabels,
  setPreferredMicrophoneId,
  type MicrophoneList,
} from '../../services/audio/microphone';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface MicrophonePickerProps {
  /** Classes for the chevron trigger, so it can match the button it sits next to */
  triggerClassName?: string;
  /** Which edge of the trigger the menu lines up with */
  align?: 'left' | 'right';
  /** While recording, the stream is already open; a new choice applies to the next recording */
  disabled?: boolean;
}

const DEFAULT_VALUE = '__system_default__';

/** Dropdown next to a record button for choosing which microphone to record from. */
export const MicrophonePicker: React.FC<MicrophonePickerProps> = ({ triggerClassName = '', align = 'right', disabled }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<MicrophoneList | null>(null);
  const [selected, setSelected] = useState(getPreferredMicrophoneId);
  const [error, setError] = useState<string | null>(null);

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
    if (open) refresh();
  }, [open, refresh]);

  const choose = (value: string) => {
    const deviceId = value === DEFAULT_VALUE ? '' : value;
    setPreferredMicrophoneId(deviceId);
    setSelected(deviceId);
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
  const radioValue = !selected || selectedMissing ? DEFAULT_VALUE : selected;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          aria-label="Choose microphone"
          title={disabled ? 'Stop recording to change the microphone' : 'Choose microphone'}
          className={cn(
            'inline-flex items-center justify-center transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName
          )}
        >
          <ChevronDown className={cn('size-3.5 transition-transform duration-150', open && 'rotate-180')} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align === 'right' ? 'end' : 'start'} className="w-72">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <Mic className="size-3" />
          <span>Microphone</span>
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup value={radioValue} onValueChange={choose}>
          <DropdownMenuRadioItem value={DEFAULT_VALUE}>
            <span className="min-w-0">
              <span className="block truncate">System default</span>
              {list?.defaultLabel && <span className="block truncate text-xs text-muted-foreground">{list.defaultLabel}</span>}
            </span>
          </DropdownMenuRadioItem>
          {list?.devices.map((d) => (
            <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
              <span className="min-w-0 truncate">{d.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {list === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">Looking for microphones...</p>}
        {list && list.devices.length === 0 && !list.labelsHidden && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No microphones found.</p>
        )}

        {list?.labelsHidden && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void showNames();
            }}
          >
            Allow microphone access to show device names
          </DropdownMenuItem>
        )}
        {error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}

        <DropdownMenuSeparator />
        <p className="px-2 pb-1 pt-1 text-xs leading-relaxed text-muted-foreground">
          Used for Voice Type and meeting recordings on this device.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
