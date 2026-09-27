import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPreferredMicrophoneId,
  listMicrophones,
  onPreferredMicrophoneChange,
  openMicrophone,
  setPreferredMicrophoneId,
} from '../src/services/audio/microphone';

const store = new Map<string, string>();
const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();

beforeEach(() => {
  store.clear();
  getUserMedia.mockReset();
  enumerateDevices.mockReset();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices } });
});

const input = (deviceId: string, label: string) => ({ kind: 'audioinput', deviceId, label, groupId: '' });

describe('microphone choice', () => {
  it('defaults to the system microphone and remembers a chosen one', () => {
    expect(getPreferredMicrophoneId()).toBe('');
    setPreferredMicrophoneId('usb-mic');
    expect(getPreferredMicrophoneId()).toBe('usb-mic');
    setPreferredMicrophoneId('');
    expect(getPreferredMicrophoneId()).toBe('');
  });

  it('tells other pickers when the choice changes', () => {
    const seen: string[] = [];
    const off = onPreferredMicrophoneChange((id) => seen.push(id));
    setPreferredMicrophoneId('usb-mic');
    off();
    setPreferredMicrophoneId('');
    expect(seen).toEqual(['usb-mic']);
  });

  it('folds the default and communications aliases into "System default"', async () => {
    enumerateDevices.mockResolvedValue([
      input('default', 'Default - Headset (USB)'),
      input('communications', 'Communications - Headset (USB)'),
      input('usb', 'Headset (USB)'),
      input('built-in', 'Microphone Array (Realtek)'),
      { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers', groupId: '' },
    ]);
    const list = await listMicrophones();
    expect(list.devices.map((d) => d.deviceId)).toEqual(['usb', 'built-in']);
    expect(list.defaultLabel).toBe('Headset (USB)');
    expect(list.labelsHidden).toBe(false);
  });

  it('reports hidden names before microphone access is granted', async () => {
    enumerateDevices.mockResolvedValue([input('a', ''), input('b', '')]);
    const list = await listMicrophones();
    expect(list.labelsHidden).toBe(true);
    expect(list.devices.map((d) => d.label)).toEqual(['Microphone 1', 'Microphone 2']);
  });

  it('opens exactly the chosen microphone with the requested processing', async () => {
    setPreferredMicrophoneId('usb');
    getUserMedia.mockResolvedValue('stream');
    await openMicrophone({ echoCancellation: true, noiseSuppression: true });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, deviceId: { exact: 'usb' } },
    });
  });

  it('falls back to the system default when the chosen microphone is unplugged', async () => {
    setPreferredMicrophoneId('gone');
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no device'), { name: 'OverconstrainedError' })).mockResolvedValueOnce('default-stream');
    await expect(openMicrophone({ echoCancellation: true })).resolves.toBe('default-stream');
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: { echoCancellation: true } });
  });

  it('does not hide a denied permission behind the fallback', async () => {
    setPreferredMicrophoneId('usb');
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    await expect(openMicrophone()).rejects.toThrow('denied');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});
