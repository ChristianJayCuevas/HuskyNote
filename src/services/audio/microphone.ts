/**
 * The microphone the user picked for recording and dictation. The choice is
 * shared by every recording button and stored on this device; an empty id
 * means the system default microphone.
 */

const STORAGE_KEY = 'huskynote_microphone_id';
const CHANGE_EVENT = 'huskynote:microphone-changed';

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export interface MicrophoneList {
  devices: MicrophoneDevice[];
  /** Label of the device the system currently uses as its default, when the browser reports it */
  defaultLabel?: string;
  /** Browsers hide device names until microphone access has been granted once */
  labelsHidden: boolean;
}

export function getPreferredMicrophoneId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setPreferredMicrophoneId(deviceId: string): void {
  try {
    if (deviceId) localStorage.setItem(STORAGE_KEY, deviceId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable; the choice lasts for this page only
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: deviceId }));
}

/** Calls `listener` when the chosen microphone changes anywhere in the app. */
export function onPreferredMicrophoneChange(listener: (deviceId: string) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<string>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/**
 * Lists audio inputs. Chromium adds "default" and "communications" aliases for
 * the system's chosen devices; they are folded into the "System default" entry.
 */
export async function listMicrophones(): Promise<MicrophoneList> {
  if (!navigator.mediaDevices?.enumerateDevices) return { devices: [], labelsHidden: false };
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  const labelsHidden = inputs.length > 0 && inputs.every((d) => !d.label);
  const alias = inputs.find((d) => d.deviceId === 'default');
  const devices = inputs
    .filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
  return { devices, defaultLabel: alias?.label.replace(/^Default - /, '') || undefined, labelsHidden };
}

/** Asks for microphone access once so the browser reveals device names, then releases it. */
export async function revealMicrophoneLabels(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((t) => t.stop());
}

/**
 * Opens the chosen microphone with the given processing constraints. If that
 * device is unplugged or no longer exists, falls back to the system default.
 */
export async function openMicrophone(constraints: MediaTrackConstraints = {}): Promise<MediaStream> {
  const deviceId = getPreferredMicrophoneId();
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { ...constraints, deviceId: { exact: deviceId } } });
    } catch (err: any) {
      if (err?.name !== 'OverconstrainedError' && err?.name !== 'NotFoundError') throw err;
      console.warn('[HuskyNote] The chosen microphone is not available; using the system default.');
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: constraints });
}
