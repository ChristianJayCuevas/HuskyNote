import { useEffect, useState } from 'react';

/** A Teams transcript collected by the HuskyNote browser extension */
export interface ExtensionTranscript {
  vtt: string;
  lines: number;
  speakers: string[];
  title: string;
  collectedAt: number;
  /** Collecting was stopped before the end */
  partial?: boolean;
}

let latest: ExtensionTranscript | null = null;
const listeners = new Set<(transcript: ExtensionTranscript | null) => void>();
let listening = false;

const isTranscript = (value: unknown): value is ExtensionTranscript => {
  const v = value as ExtensionTranscript | null;
  return Boolean(v && typeof v.vtt === 'string' && v.vtt.startsWith('WEBVTT') && typeof v.collectedAt === 'number');
};

/** Listen for transcripts the extension forwards to this page, and ask for the latest one */
function startListening(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'HUSKYNOTE_TEAMS_TRANSCRIPT' || event.data?.source !== 'huskynote-extension') return;
    if (!isTranscript(event.data.payload)) return;
    if (latest && latest.collectedAt >= event.data.payload.collectedAt) return;
    latest = event.data.payload;
    listeners.forEach((listener) => listener(latest));
  });
  window.postMessage({ type: 'HUSKYNOTE_REQUEST_TEAMS_TRANSCRIPT' }, window.location.origin);
}

/** The most recent transcript collected by the extension, if any */
export function useExtensionTranscript(): ExtensionTranscript | null {
  const [transcript, setTranscript] = useState<ExtensionTranscript | null>(latest);
  useEffect(() => {
    startListening();
    listeners.add(setTranscript);
    // Ask again: the extension may have collected one since the page loaded
    window.postMessage({ type: 'HUSKYNOTE_REQUEST_TEAMS_TRANSCRIPT' }, window.location.origin);
    return () => { listeners.delete(setTranscript); };
  }, []);
  return transcript;
}

/** "just now", "5 min ago", "2 h ago", or a date */
export function collectedAgo(at: number, now = Date.now()): string {
  const minutes = Math.round((now - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
