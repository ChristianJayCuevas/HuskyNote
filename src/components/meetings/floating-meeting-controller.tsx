import React, { useState, useEffect, useRef } from 'react';
import type { TranscriptSegment, MeetingScreenshot } from '../../types';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import {
  Mic,
  MicOff,
  Square,
  Camera,
  Crop,
  FileText,
  Bookmark,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Copy,
  Check,
  Pause,
  Play,
  Image,
  X,
  ExternalLink,
  MessageSquare,
  Volume2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { StatusDot } from '../ui/status-dot';
import { cn } from '@/lib/utils';

/*
 * The always-on-top Picture-in-Picture window is plain HTML without the app stylesheet,
 * so it uses literal colors that mirror the dark theme tokens.
 */
// design-exception: PiP inline HTML (background, popover, border, foreground, muted, destructive)
const PIP = { bg: '#191919', surface: '#252525', border: '#2F2F2F', text: '#E3E2E0', muted: '#9B9A97', destructive: '#F06A63' } as const;
// design-exception: PiP inline HTML shadow
const PIP_SHADOW = '0 3px 6px rgba(0, 0, 0, 0.3), 0 9px 24px rgba(0, 0, 0, 0.5)';
const PIP_FONT = '"Geist Variable", "Segoe UI", system-ui, sans-serif';

// Lucide icon paths for the PiP window's plain-HTML buttons (no emoji; the PiP document can't render React icons)
const PIP_ICON_PATHS = {
  stop: '<rect width="14" height="14" x="5" y="5" rx="2" fill="currentColor" stroke="none"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  micOff:
    '<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>',
  focus: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  grip: '<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/>',
} as const;
const pipIcon = (name: keyof typeof PIP_ICON_PATHS) =>
  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIP_ICON_PATHS[name]}</svg>`;

export interface FloatingMeetingControllerProps {
  elapsedSeconds: number;
  isRecording: boolean;
  isPaused: boolean;
  isMicMuted: boolean;
  audioLevel: number;
  transcript: TranscriptSegment[];
  screenshots: MeetingScreenshot[];
  autoOpenPiP?: boolean;
  onStopAndCompile: () => void;
  onTogglePause: () => void;
  onToggleMicMute: () => void;
  onTakeFullScreenshot: () => void;
  onStartPortionSnip: () => void;
  onAddBookmark: (type: 'decision' | 'action' | 'highlight', note?: string) => void;
  onAddQuickNote: (note: string) => void;
  onRemoveScreenshot: (id: string) => void;
}

/**
 * FloatingMeetingController provides a draggable, Always-on-Top capable
 * control bar during meeting recording (popover surface, theme tokens).
 *
 * It provides the complete expanded suite of quick actions:
 * - Quick Stop & Compile Single Report
 * - Pause / Resume
 * - Mic Mute / Unmute
 * - Full Screen Snapshot
 * - Interactive Portion Snip Tool
 * - Live Transcriber Streaming Drawer
 * - AI Milestone Bookmarking (Decisions, Actions, Highlights)
 * - Quick Timestamped Note Jotter
 * - Screenshot Strip Drawer
 * - Picture-in-Picture (PiP) Window
 * - Collapse to Mini Pill / Expand Full HUD
 */
export const FloatingMeetingController: React.FC<FloatingMeetingControllerProps> = ({
  elapsedSeconds,
  isRecording,
  isPaused,
  isMicMuted,
  audioLevel,
  transcript,
  screenshots,
  autoOpenPiP,
  onStopAndCompile,
  onTogglePause,
  onToggleMicMute,
  onTakeFullScreenshot,
  onStartPortionSnip,
  onAddBookmark,
  onAddQuickNote,
  onRemoveScreenshot,
}) => {
  // The always-on-top window wires its buttons once, when it opens. Reading the
  // handlers through this ref keeps them current; otherwise Stop saved the
  // meeting with the title, notes, screenshots and 0:00 duration from that moment.
  const actionsRef = useRef({ onStopAndCompile, onTogglePause, onToggleMicMute, onTakeFullScreenshot, onStartPortionSnip, onAddBookmark, onAddQuickNote });
  actionsRef.current = { onStopAndCompile, onTogglePause, onToggleMicMute, onTakeFullScreenshot, onStartPortionSnip, onAddBookmark, onAddQuickNote };
  // Position state (defaults to bottom-center so it doesn't obstruct top controls)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(20, (window.innerWidth - 680) / 2) : 200;
    const defaultY = typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 84) : 450;
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // HUD Expand / Collapse
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sub-drawers & modals
  const [activeDrawer, setActiveDrawer] = useState<'transcriber' | 'bookmarks' | 'notes' | 'screenshots' | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const pipWindowRef = useRef<any>(null);

  const transcriberEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live transcript drawer
  useEffect(() => {
    if (activeDrawer === 'transcriber' && transcriberEndRef.current) {
      transcriberEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, activeDrawer]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from handle or container background, not interactive buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(10, Math.min(window.innerWidth - 320, dragStartRef.current.startX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.startY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Toasts stack from the bottom-center too: while the bar sits near the bottom, lift them above it
  // (the Toaster reads --meeting-controls-offset).
  useEffect(() => {
    const root = document.documentElement;
    const fromBottom = window.innerHeight - position.y;
    if (!isPiPActive && fromBottom < 160) root.style.setProperty('--meeting-controls-offset', `${fromBottom + 12}px`);
    else root.style.removeProperty('--meeting-controls-offset');
    return () => {
      root.style.removeProperty('--meeting-controls-offset');
    };
  }, [position.y, isPiPActive]);

  // Copy transcript so far
  const handleCopyTranscript = () => {
    const text = transcript.map((s) => `[${formatSecondsToTime(s.timestampSeconds)}] ${s.speaker}: ${s.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Submit quick note
  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteText.trim()) return;
    onAddQuickNote(quickNoteText.trim());
    setQuickNoteText('');
    setActiveDrawer(null);
  };

  // Real-time synchronization to Always-on-Top PiP window (timer, waves, transcript count, states)
  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const doc = pipWindowRef.current.document;
      const timer = doc.getElementById('pip-timer');
      if (timer) timer.textContent = formatSecondsToTime(elapsedSeconds);
      const label = doc.getElementById('pip-label');
      if (label) label.textContent = isPaused ? 'PAUSED' : 'RECORDING';
      const badge = doc.getElementById('pip-tr-badge');
      if (badge) badge.textContent = String(transcript.length);
      const pauseBtn = doc.getElementById('pip-pause-btn');
      if (pauseBtn) pauseBtn.innerHTML = pipIcon(isPaused ? 'play' : 'pause');
      const micBtn = doc.getElementById('pip-mic-btn');
      if (micBtn) micBtn.innerHTML = pipIcon(isMicMuted ? 'micOff' : 'mic');

      // Live transcript drawer update inside PiP
      const drawer = doc.getElementById('pip-drawer');
      if (drawer && drawer.style.display !== 'none') {
        drawer.innerHTML =
          transcript.length === 0
            ? `<span style="color:${PIP.muted}">Listening for meeting speech...</span>`
            : transcript
                .slice(-10)
                .map(
                  (s) =>
                    `<div style="margin-bottom:6px;"><span style="color:${PIP.text};font-weight:600;font-size:10px;">${s.speaker}</span> <span style="color:${PIP.muted};font-size:9px;">${formatSecondsToTime(s.timestampSeconds)}</span><br/><span style="color:${PIP.text};">${s.text}</span></div>`
                )
                .join('');
        drawer.scrollTop = drawer.scrollHeight;
      }

      // Audio wave bars
      const waves = doc.getElementById('pip-waves');
      if (waves && !isPaused && !isMicMuted) {
        const bars = waves.querySelectorAll('.hud-wave-bar');
        [0.4, 0.8, 0.5, 1.0, 0.6].forEach((scale, i) => {
          const bar = bars[i] as HTMLElement;
          if (bar) {
            const h = Math.max(2, Math.min(12, (audioLevel / 100) * 12 * scale));
            bar.style.height = `${h}px`;
          }
        });
      }
    }
  }, [elapsedSeconds, transcript, audioLevel, isPaused, isMicMuted]);

  // Toggle Picture-in-Picture (PiP) Window (Always-on-Top over Google Meet, Windows & Fullscreen)
  const handleTogglePiP = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        if (!isPiPActive && !pipWindowRef.current) {
          const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
            width: 780,
            height: 60,
          });
          pipWindowRef.current = pipWindow;

          // Set background and inject full horizontal controller matching HuskyNote HUD
          pipWindow.document.body.innerHTML = `
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
              html, body {
                background: ${PIP.bg} !important;
                color: ${PIP.text};
                font-family: ${PIP_FONT};
                height: 100vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              }
              .hud-bar {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: ${PIP.surface};
                border: 1px solid ${PIP.border};
                border-radius: 14px;
                box-shadow: ${PIP_SHADOW};
                height: 48px;
                margin: auto 4px;
              }
              .hud-grip {
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${PIP.muted};
                cursor: grab;
                padding: 0 4px;
                font-size: 14px;
              }
              .hud-status {
                display: flex;
                align-items: center;
                gap: 8px;
                background: ${PIP.bg};
                border: 1px solid ${PIP.border};
                border-radius: 10px;
                padding: 4px 8px;
              }
              .hud-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: ${PIP.destructive};
                box-shadow: 0 0 6px ${PIP.destructive};
                animation: pulse 1.5s infinite;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.35; transform: scale(0.85); }
              }
              .hud-timer {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 11px;
                font-weight: 700;
                color: ${PIP.text};
                line-height: 1.1;
              }
              .hud-label {
                font-size: 8px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: ${PIP.muted};
                line-height: 1;
              }
              .hud-waves {
                display: flex;
                align-items: flex-end;
                gap: 1.5px;
                height: 12px;
                margin-left: 2px;
              }
              .hud-wave-bar {
                width: 2px;
                background: ${PIP.muted};
                border-radius: 1px;
                transition: height 0.08s ease;
                min-height: 2px;
              }
              .hud-divider {
                width: 1px;
                height: 20px;
                background: ${PIP.border};
                margin: 0 2px;
              }
              .hud-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 5px 9px;
                border-radius: 8px;
                border: 1px solid ${PIP.border};
                background: ${PIP.surface};
                color: ${PIP.text};
                font-family: inherit;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.12s ease;
                white-space: nowrap;
              }
              .hud-btn:hover {
                background: ${PIP.border};
                color: ${PIP.text};
                border-color: ${PIP.muted};
              }
              .hud-btn-stop {
                background: ${PIP.destructive} !important;
                color: ${PIP.bg} !important;
                border: 1px solid ${PIP.destructive} !important;
                font-weight: 700 !important;
                padding: 5px 11px !important;
              }
              .hud-btn-stop:hover {
                opacity: 0.9;
              }
              .hud-badge {
                background: ${PIP.border};
                color: ${PIP.text};
                font-size: 9px;
                font-family: monospace;
                padding: 0 4px;
                border-radius: 4px;
              }
              .hud-drawer {
                display: none;
                flex: 1;
                background: ${PIP.surface};
                border: 1px solid ${PIP.border};
                border-radius: 10px;
                margin: 4px;
                padding: 8px 10px;
                overflow-y: auto;
                font-size: 11px;
                color: ${PIP.text};
                line-height: 1.4;
              }
            </style>
            <div class="hud-bar">
              <div class="hud-grip" title="Always on Top Window (Google Meet & Windows)">${pipIcon('grip')}</div>
              <div class="hud-status">
                <div class="hud-dot" id="pip-dot"></div>
                <div>
                  <div class="hud-timer" id="pip-timer">${formatSecondsToTime(elapsedSeconds)}</div>
                  <div class="hud-label" id="pip-label">${isPaused ? 'PAUSED' : 'RECORDING'}</div>
                </div>
                <div class="hud-waves" id="pip-waves">
                  <div class="hud-wave-bar" style="height:3px"></div>
                  <div class="hud-wave-bar" style="height:6px"></div>
                  <div class="hud-wave-bar" style="height:4px"></div>
                  <div class="hud-wave-bar" style="height:8px"></div>
                  <div class="hud-wave-bar" style="height:5px"></div>
                </div>
              </div>
              <div class="hud-divider"></div>
              <button class="hud-btn hud-btn-stop" id="pip-stop-btn" title="End recording and generate documentation">${pipIcon('stop')} Stop & Report</button>
              <button class="hud-btn" id="pip-full-btn" title="Capture full screenshot">${pipIcon('camera')} Full</button>
              <button class="hud-btn" id="pip-snip-btn" title="Capture portion screenshot">${pipIcon('crop')} Snip</button>
              <button class="hud-btn" id="pip-tr-btn" title="View live transcript">${pipIcon('message')} Transcribe <span class="hud-badge" id="pip-tr-badge">${transcript.length}</span></button>
              <button class="hud-btn" id="pip-bm-btn" title="Add milestone bookmark">${pipIcon('bookmark')} Bookmark</button>
              <button class="hud-btn" id="pip-note-btn" title="Add timestamped note">${pipIcon('note')} Note</button>
              <button class="hud-btn" id="pip-pause-btn" title="Pause / Resume" aria-label="Pause or resume" style="padding: 5px 7px;">${pipIcon(isPaused ? 'play' : 'pause')}</button>
              <button class="hud-btn" id="pip-mic-btn" title="Mute / Unmute Mic" aria-label="Mute or unmute microphone" style="padding: 5px 7px;">${pipIcon(isMicMuted ? 'micOff' : 'mic')}</button>
              <button class="hud-btn" id="pip-focus-btn" title="Focus HuskyNote tab" aria-label="Focus HuskyNote tab" style="padding: 5px 7px;">${pipIcon('focus')}</button>
            </div>
            <div class="hud-drawer" id="pip-drawer"></div>
          `;

          // Button event listeners in the Always-on-Top PiP window
          pipWindow.document.getElementById('pip-stop-btn')?.addEventListener('click', () => {
            pipWindow.close();
            actionsRef.current.onStopAndCompile();
          });

          pipWindow.document.getElementById('pip-full-btn')?.addEventListener('click', () => {
            actionsRef.current.onTakeFullScreenshot();
          });

          pipWindow.document.getElementById('pip-snip-btn')?.addEventListener('click', () => {
            window.focus();
            actionsRef.current.onStartPortionSnip();
          });

          pipWindow.document.getElementById('pip-tr-btn')?.addEventListener('click', () => {
            const drawer = pipWindow.document.getElementById('pip-drawer');
            if (drawer) {
              const isHidden = drawer.style.display === 'none' || !drawer.style.display;
              drawer.style.display = isHidden ? 'block' : 'none';
              try {
                pipWindow.resizeTo(780, isHidden ? 220 : 60);
              } catch {}
            }
          });

          pipWindow.document.getElementById('pip-bm-btn')?.addEventListener('click', () => {
            actionsRef.current.onAddBookmark('highlight');
          });

          pipWindow.document.getElementById('pip-note-btn')?.addEventListener('click', () => {
            const note = pipWindow.prompt('Enter quick meeting note:');
            if (note && note.trim()) {
              actionsRef.current.onAddQuickNote(note.trim());
            }
          });

          pipWindow.document.getElementById('pip-pause-btn')?.addEventListener('click', () => {
            actionsRef.current.onTogglePause();
          });

          pipWindow.document.getElementById('pip-mic-btn')?.addEventListener('click', () => {
            actionsRef.current.onToggleMicMute();
          });

          pipWindow.document.getElementById('pip-focus-btn')?.addEventListener('click', () => {
            window.focus();
          });

          pipWindow.addEventListener('pagehide', () => {
            setIsPiPActive(false);
            pipWindowRef.current = null;
          });

          setIsPiPActive(true);
        } else if (pipWindowRef.current) {
          pipWindowRef.current.close();
          pipWindowRef.current = null;
          setIsPiPActive(false);
        }
      } catch (err) {
        console.warn('[HuskyNote] PiP request failed:', err);
      }
    }
  };

  // Auto-open Always-on-Top floating PiP window when requested (e.g. tab capture starts)
  useEffect(() => {
    if (autoOpenPiP && 'documentPictureInPicture' in window && !isPiPActive && !pipWindowRef.current) {
      handleTogglePiP().catch(() => {});
    }
  }, [autoOpenPiP]);

  // When PiP is active, the floating bar lives inside the PiP window — hide the in-page bar
  if (isPiPActive) return null;

  const drawerClass = 'rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg';
  // Drawers open above the bar when it sits in the lower half of the window (its default spot), so they stay on screen
  const opensUp = typeof window !== 'undefined' && position.y > window.innerHeight / 2;
  const toggleClass = (active: boolean) =>
    cn('text-muted-foreground', active && 'bg-accent text-accent-foreground');

  return (
    <div
      role="region"
      aria-label="Meeting controls"
      className="pointer-events-auto fixed z-[9999] select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Main control bar */}
      <div className="flex items-center gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
        {/* Draggable Grip Handle */}
        <div
          className="flex h-7 cursor-grab items-center px-1 text-muted-foreground transition-colors duration-100 hover:text-foreground active:cursor-grabbing"
          title="Drag to reposition HUD"
        >
          <GripHorizontal className="size-4" />
        </div>

        {/* Status Indicator & Timer */}
        <div className="flex h-8 items-center gap-2 rounded-md bg-secondary px-2.5">
          <StatusDot tone={isPaused ? 'muted' : 'destructive'} pulse={!isPaused} />
          <div className="flex flex-col leading-none">
            <span className="font-mono text-xs font-medium tabular-nums text-foreground">
              {formatSecondsToTime(elapsedSeconds)}
            </span>
            <span className="mt-0.5 text-xs leading-none text-muted-foreground">
              {isPaused ? 'Paused' : isRecording ? 'Recording' : 'Standby'}
            </span>
          </div>

          {/* Audio Soundwave Bars reacting to level */}
          {!isMicMuted && !isPaused && (
            <div className="ml-0.5 flex h-4 items-end gap-0.5" aria-hidden="true">
              {[0.4, 0.8, 0.5, 1.0, 0.6].map((scale, i) => {
                const height = Math.max(3, Math.min(16, (audioLevel / 100) * 16 * scale));
                return (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-muted-foreground transition-[height] duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {!isCollapsed && (
          <>
            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Quick Stop Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopAndCompile}
              title="End meeting and compile into Single Report"
            >
              <Square className="fill-current" />
              <span>Stop & Report</span>
            </Button>

            {/* Visual Capture Group: Full Screenshot & Portion Snip */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onTakeFullScreenshot}
              className="text-muted-foreground"
              title="Full Screen Screenshot (1-Click)"
            >
              <Camera />
              <span className="hidden sm:inline">Full</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartPortionSnip}
              className="text-muted-foreground"
              title="Snip Portion (Interactive Rectangle Crop)"
            >
              <Crop />
              <span className="hidden sm:inline">Snip</span>
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Live Transcriber Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveDrawer(activeDrawer === 'transcriber' ? null : 'transcriber')}
              aria-pressed={activeDrawer === 'transcriber'}
              className={toggleClass(activeDrawer === 'transcriber')}
              title="Toggle Live Transcriber Drawer"
            >
              <MessageSquare />
              <span className="hidden md:inline">Transcribe</span>
              {transcript.length > 0 && (
                <Badge variant="secondary" className="px-1 font-mono tabular-nums">
                  {transcript.length}
                </Badge>
              )}
            </Button>

            {/* AI Bookmark Quick Actions */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveDrawer(activeDrawer === 'bookmarks' ? null : 'bookmarks')}
              aria-pressed={activeDrawer === 'bookmarks'}
              className={toggleClass(activeDrawer === 'bookmarks')}
              title="Bookmark key moment (Decision, Action Item, Highlight)"
            >
              <Bookmark />
              <span className="hidden md:inline">Bookmark</span>
            </Button>

            {/* Quick Note Jotter */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveDrawer(activeDrawer === 'notes' ? null : 'notes')}
              aria-pressed={activeDrawer === 'notes'}
              className={toggleClass(activeDrawer === 'notes')}
              title="Type quick timestamped note"
            >
              <FileText />
              <span className="hidden lg:inline">Note</span>
            </Button>

            {/* Screenshots Gallery Drawer Toggle */}
            {screenshots.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveDrawer(activeDrawer === 'screenshots' ? null : 'screenshots')}
                aria-pressed={activeDrawer === 'screenshots'}
                className={toggleClass(activeDrawer === 'screenshots')}
                title="View captured screenshots"
              >
                <Image />
                <Badge variant="secondary" className="px-1 font-mono tabular-nums">
                  {screenshots.length}
                </Badge>
              </Button>
            )}

            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Audio Controls: Pause / Mute */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onTogglePause}
              className="text-muted-foreground"
              title={isPaused ? 'Resume recording' : 'Pause recording'}
              aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            >
              {isPaused ? <Play className="fill-current" /> : <Pause />}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleMicMute}
              aria-pressed={isMicMuted}
              className={cn(
                isMicMuted
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                  : 'text-muted-foreground'
              )}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOff /> : <Mic />}
            </Button>

            {/* Always-on-Top PiP Window (Chrome/Edge Document PiP) */}
            {'documentPictureInPicture' in window && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleTogglePiP}
                aria-pressed={isPiPActive}
                className={toggleClass(isPiPActive)}
                title="Stay on top of Google Meet, other windows & Fullscreen (Always-on-Top PiP)"
                aria-label="Open always-on-top window"
              >
                <ExternalLink />
              </Button>
            )}
          </>
        )}

        {/* Collapse / Expand Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground"
          title={isCollapsed ? 'Expand full HUD controls' : 'Collapse to mini pill'}
          aria-label={isCollapsed ? 'Expand full HUD controls' : 'Collapse to mini pill'}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </div>

      {/* Drawers (above or below the bar) */}
      <div className={cn('absolute left-0', opensUp ? 'bottom-full mb-2' : 'top-full mt-2')}>
        {/* 1. Live Transcriber Drawer */}
        {activeDrawer === 'transcriber' && !isCollapsed && (
          <div className={cn(drawerClass, 'w-[380px] max-w-[90vw]')}>
            <div className="mb-2 flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Live Speech Stream</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="xs" onClick={handleCopyTranscript} title="Copy transcript so far">
                  {copiedTranscript ? <Check /> : <Copy />}
                  <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setActiveDrawer(null)}
                  className="size-6 text-muted-foreground"
                  aria-label="Close transcript"
                >
                  <X />
                </Button>
              </div>
            </div>

            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {transcript.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Listening... spoken words will transcribe here in real-time.
                </p>
              ) : (
                transcript.map((seg) => (
                  <div key={seg.id} className="rounded-md bg-secondary/60 px-2.5 py-2">
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{seg.speaker}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{formatSecondsToTime(seg.timestampSeconds)}</span>
                    </div>
                    <p className="text-xs leading-5 text-foreground">{seg.text}</p>
                  </div>
                ))
              )}
              <div ref={transcriberEndRef} />
            </div>
          </div>
        )}

        {/* 2. AI Bookmark Popover */}
        {activeDrawer === 'bookmarks' && !isCollapsed && (
          <div className={cn(drawerClass, 'w-72')}>
            <div className="mb-2.5 flex items-center justify-between border-b pb-1.5">
              <span className="text-xs font-medium text-foreground">
                Mark Moment [{formatSecondsToTime(elapsedSeconds)}]
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveDrawer(null)}
                className="size-6 text-muted-foreground"
                aria-label="Close bookmarks"
              >
                <X />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { type: 'decision', label: 'Decision', hint: 'Agreed point' },
                  { type: 'action', label: 'Action', hint: 'Todo task' },
                  { type: 'highlight', label: 'Highlight', hint: 'Key insight' },
                ] as const
              ).map(({ type, label, hint }) => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => {
                    onAddBookmark(type);
                    setActiveDrawer(null);
                  }}
                  className="h-auto flex-col gap-0.5 px-2 py-2"
                >
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{hint}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Quick Note Jotter Drawer */}
        {activeDrawer === 'notes' && !isCollapsed && (
          <form onSubmit={handleSubmitNote} className={cn(drawerClass, 'w-80')}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Quick Note @ {formatSecondsToTime(elapsedSeconds)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveDrawer(null)}
                className="size-6 text-muted-foreground"
                aria-label="Close quick note"
              >
                <X />
              </Button>
            </div>

            <Input
              type="text"
              value={quickNoteText}
              onChange={(e) => setQuickNoteText(e.target.value)}
              placeholder="Type bullet point and press Enter..."
              aria-label="Quick note"
              autoFocus
            />

            <div className="mt-2 flex justify-end gap-1.5">
              <Button type="button" variant="ghost" size="xs" onClick={() => setActiveDrawer(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="xs" disabled={!quickNoteText.trim()}>
                Save Note
              </Button>
            </div>
          </form>
        )}

        {/* 4. Screenshot Strip Drawer */}
        {activeDrawer === 'screenshots' && !isCollapsed && (
          <div className={cn(drawerClass, 'w-[360px] max-w-[90vw]')}>
            <div className="mb-2 flex items-center justify-between border-b pb-1.5">
              <span className="text-xs font-medium text-foreground">Screenshots ({screenshots.length})</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setActiveDrawer(null)}
                className="size-6 text-muted-foreground"
                aria-label="Close screenshots"
              >
                <X />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {screenshots.map((ss, idx) => (
                <div key={ss.id} className="group relative w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                  <img src={ss.dataUrl} alt={`Screenshot ${idx + 1}`} className="h-16 w-full object-cover" />
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => onRemoveScreenshot(ss.id)}
                    className="absolute right-1 top-1 size-6 opacity-0 shadow-sm transition-opacity duration-100 focus-visible:opacity-100 group-hover:opacity-100 coarse:opacity-100"
                    title="Delete screenshot"
                    aria-label={`Delete screenshot ${idx + 1}`}
                  >
                    <X />
                  </Button>
                  <div className="truncate border-t bg-popover px-1 py-0.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {formatSecondsToTime(ss.timestampSeconds)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
