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
 * FloatingMeetingController provides a draggable, Always-on-Top capable,
 * strictly monochrome white/gray glassmorphic HUD toolbar during meeting recording.
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
      if (pauseBtn) pauseBtn.textContent = isPaused ? '▶' : '⏸';
      const micBtn = doc.getElementById('pip-mic-btn');
      if (micBtn) micBtn.textContent = isMicMuted ? '🔇' : '🎙';

      // Live transcript drawer update inside PiP
      const drawer = doc.getElementById('pip-drawer');
      if (drawer && drawer.style.display !== 'none') {
        drawer.innerHTML =
          transcript.length === 0
            ? '<span style="color:#71717a">Listening for meeting speech...</span>'
            : transcript
                .slice(-10)
                .map(
                  (s) =>
                    `<div style="margin-bottom:6px;"><span style="color:#10b981;font-weight:600;font-size:10px;">${s.speaker}</span> <span style="color:#71717a;font-size:9px;">${formatSecondsToTime(s.timestampSeconds)}</span><br/><span style="color:#f4f4f5;">${s.text}</span></div>`
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
                background: #09090b !important;
                color: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
                background: rgba(18, 18, 22, 0.96);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 14px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                height: 48px;
                margin: auto 4px;
              }
              .hud-grip {
                display: flex;
                align-items: center;
                justify-content: center;
                color: #71717a;
                cursor: grab;
                padding: 0 4px;
                font-size: 14px;
              }
              .hud-status {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 10px;
                padding: 4px 8px;
              }
              .hud-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #fff;
                box-shadow: 0 0 6px #fff;
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
                color: #fff;
                line-height: 1.1;
              }
              .hud-label {
                font-size: 8px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: #a1a1aa;
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
                background: #d4d4d8;
                border-radius: 1px;
                transition: height 0.08s ease;
                min-height: 2px;
              }
              .hud-divider {
                width: 1px;
                height: 20px;
                background: rgba(255,255,255,0.14);
                margin: 0 2px;
              }
              .hud-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 5px 9px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.06);
                color: #e4e4e7;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.12s ease;
                white-space: nowrap;
              }
              .hud-btn:hover {
                background: rgba(255,255,255,0.16);
                color: #fff;
                border-color: rgba(255,255,255,0.25);
              }
              .hud-btn-stop {
                background: #ffffff !important;
                color: #000000 !important;
                border: 1px solid #ffffff !important;
                font-weight: 700 !important;
                padding: 5px 11px !important;
              }
              .hud-btn-stop:hover {
                background: #e4e4e7 !important;
              }
              .hud-badge {
                background: rgba(255,255,255,0.22);
                color: #fff;
                font-size: 9px;
                font-family: monospace;
                padding: 0 4px;
                border-radius: 4px;
              }
              .hud-drawer {
                display: none;
                flex: 1;
                background: #121216;
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 10px;
                margin: 4px;
                padding: 8px 10px;
                overflow-y: auto;
                font-size: 11px;
                color: #e4e4e7;
                line-height: 1.4;
              }
            </style>
            <div class="hud-bar">
              <div class="hud-grip" title="Always on Top Window (Google Meet & Windows)">⠿</div>
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
              <button class="hud-btn hud-btn-stop" id="pip-stop-btn" title="End recording and generate documentation">■ Stop & Report</button>
              <button class="hud-btn" id="pip-full-btn" title="Capture full screenshot">📷 Full</button>
              <button class="hud-btn" id="pip-snip-btn" title="Capture portion screenshot">✂ Snip</button>
              <button class="hud-btn" id="pip-tr-btn" title="View live transcript">💬 Transcribe <span class="hud-badge" id="pip-tr-badge">${transcript.length}</span></button>
              <button class="hud-btn" id="pip-bm-btn" title="Add milestone bookmark">🔖 Bookmark</button>
              <button class="hud-btn" id="pip-note-btn" title="Add timestamped note">📝 Note</button>
              <button class="hud-btn" id="pip-pause-btn" title="Pause / Resume" style="padding: 5px 7px;">${isPaused ? '▶' : '⏸'}</button>
              <button class="hud-btn" id="pip-mic-btn" title="Mute / Unmute Mic" style="padding: 5px 7px;">${isMicMuted ? '🔇' : '🎙'}</button>
              <button class="hud-btn" id="pip-focus-btn" title="Focus HuskyNote tab" style="padding: 5px 7px;">⤢</button>
            </div>
            <div class="hud-drawer" id="pip-drawer"></div>
          `;

          // Button event listeners in the Always-on-Top PiP window
          pipWindow.document.getElementById('pip-stop-btn')?.addEventListener('click', () => {
            pipWindow.close();
            onStopAndCompile();
          });

          pipWindow.document.getElementById('pip-full-btn')?.addEventListener('click', () => {
            onTakeFullScreenshot();
          });

          pipWindow.document.getElementById('pip-snip-btn')?.addEventListener('click', () => {
            window.focus();
            onStartPortionSnip();
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
            onAddBookmark('highlight');
          });

          pipWindow.document.getElementById('pip-note-btn')?.addEventListener('click', () => {
            const note = pipWindow.prompt('Enter quick meeting note:');
            if (note && note.trim()) {
              onAddQuickNote(note.trim());
            }
          });

          pipWindow.document.getElementById('pip-pause-btn')?.addEventListener('click', () => {
            onTogglePause();
          });

          pipWindow.document.getElementById('pip-mic-btn')?.addEventListener('click', () => {
            onToggleMicMute();
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

  return (
    <aside
      aria-label="Floating meeting controls"
      className="fixed z-[9999] select-none pointer-events-auto transition-shadow"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Main Glassmorphic HUD Bar */}
      <div
        className="flex items-center gap-2 p-2 rounded-2xl border shadow-2xl backdrop-blur-3xl transition-all duration-300"
        style={{
          backgroundColor: 'rgba(15, 15, 18, 0.78)',
          borderColor: 'rgba(255, 255, 255, 0.20)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Draggable Grip Handle */}
        <div
          className="px-1.5 py-2 cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Drag to reposition HUD"
        >
          <GripHorizontal className="w-4 h-4" />
        </div>

        {/* Status Indicator & Timer */}
        <div className="flex items-center gap-2.5 px-2 py-1 rounded-xl bg-white/5 border border-white/10">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isPaused ? 'bg-zinc-500' : 'bg-white'
              } transition-colors`}
            />
            {!isPaused && (
              <span className="absolute w-4 h-4 rounded-full border border-white/60 animate-ping" />
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold tracking-wider text-white">
              {formatSecondsToTime(elapsedSeconds)}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-400">
              {isPaused ? 'Paused' : isRecording ? 'Recording' : 'Standby'}
            </span>
          </div>

          {/* Audio Soundwave Bars reacting to level */}
          {!isMicMuted && !isPaused && (
            <div className="flex items-end gap-0.5 h-4 ml-1 px-1">
              {[0.4, 0.8, 0.5, 1.0, 0.6].map((scale, i) => {
                const height = Math.max(3, Math.min(16, (audioLevel / 100) * 16 * scale));
                return (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-zinc-300 transition-all duration-75"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Pill divider */}
        {!isCollapsed && (
          <>
            <div className="h-6 w-[1px] bg-white/15 mx-1" />

            {/* Quick Stop Button (Prominent Monochrome White Pill) */}
            <button
              onClick={onStopAndCompile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 active:bg-zinc-300 text-xs font-bold transition-all shadow-md active:scale-95"
              title="End meeting and compile into Single Report"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop & Report</span>
            </button>

            {/* Visual Capture Group: Full Screenshot & Portion Snip */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={onTakeFullScreenshot}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/15 text-zinc-200 hover:text-white text-xs font-semibold transition-all active:scale-95"
                title="Full Screen Screenshot (1-Click)"
              >
                <Camera className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden sm:inline">Full</span>
              </button>

              <button
                onClick={onStartPortionSnip}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/15 text-zinc-200 hover:text-white text-xs font-semibold transition-all active:scale-95"
                title="Snip Portion (Interactive Rectangle Crop)"
              >
                <Crop className="w-3.5 h-3.5 text-zinc-300" />
                <span className="hidden sm:inline">Snip</span>
              </button>
            </div>

            {/* Live Transcriber Toggle */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'transcriber' ? null : 'transcriber')}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                activeDrawer === 'transcriber'
                  ? 'bg-white/25 border-white/40 text-white shadow-inner'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
              }`}
              title="Toggle Live Transcriber Drawer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden md:inline">Transcribe</span>
              {transcript.length > 0 && (
                <span className="text-[10px] font-mono px-1 rounded bg-white/20 text-white">
                  {transcript.length}
                </span>
              )}
            </button>

            {/* AI Bookmark Quick Actions */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'bookmarks' ? null : 'bookmarks')}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1 ${
                activeDrawer === 'bookmarks'
                  ? 'bg-white/25 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
              }`}
              title="Bookmark key moment (Decision, Action Item, Highlight)"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden md:inline">Bookmark</span>
            </button>

            {/* Quick Note Jotter */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'notes' ? null : 'notes')}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1 ${
                activeDrawer === 'notes'
                  ? 'bg-white/25 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
              }`}
              title="Type quick timestamped note"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden lg:inline">Note</span>
            </button>

            {/* Screenshots Gallery Drawer Toggle */}
            {screenshots.length > 0 && (
              <button
                onClick={() => setActiveDrawer(activeDrawer === 'screenshots' ? null : 'screenshots')}
                className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1 ${
                  activeDrawer === 'screenshots'
                    ? 'bg-white/25 border-white/40 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
                }`}
                title="View captured screenshots"
              >
                <Image className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono px-1 rounded bg-white/20 text-white">
                  {screenshots.length}
                </span>
              </button>
            )}

            {/* Audio Controls: Pause / Mute */}
            <div className="flex items-center gap-1">
              <button
                onClick={onTogglePause}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-300 hover:text-white transition-all"
                title={isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onToggleMicMute}
                className={`p-2 rounded-xl border transition-all ${
                  isMicMuted
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-400'
                    : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
                }`}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Always-on-Top PiP Window (Chrome/Edge Document PiP) */}
            {'documentPictureInPicture' in window && (
              <button
                onClick={handleTogglePiP}
                className={`p-2 rounded-xl border transition-all flex items-center gap-1 ${
                  isPiPActive
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-sm'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/15 hover:text-white'
                }`}
                title="Stay on top of Google Meet, other windows & Fullscreen (Always-on-Top PiP)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}

        {/* Collapse / Expand Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-white/15 text-zinc-400 hover:text-white transition-colors ml-1"
          title={isCollapsed ? 'Expand full HUD controls' : 'Collapse to mini pill'}
        >
          {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Drawers below or above HUD in Monochrome Glassmorphism */}

      {/* 1. Live Transcriber Drawer */}
      {activeDrawer === 'transcriber' && !isCollapsed && (
        <div
          className="mt-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-3xl w-[380px] max-w-[90vw] transition-all"
          style={{
            backgroundColor: 'rgba(12, 12, 15, 0.88)',
            borderColor: 'rgba(255, 255, 255, 0.20)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Live Speech Stream
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyTranscript}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-mono text-zinc-200 transition-colors flex items-center gap-1"
                title="Copy transcript so far"
              >
                {copiedTranscript ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded-md hover:bg-white/15 text-zinc-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
            {transcript.length === 0 ? (
              <p className="text-zinc-500 italic text-[11px] py-3 text-center">
                Listening... spoken words will transcribe here in real-time.
              </p>
            ) : (
              transcript.map((seg) => (
                <div key={seg.id} className="p-2 rounded-lg bg-white/5 border border-white/5 leading-relaxed">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                    <span className="font-semibold text-zinc-300">{seg.speaker}</span>
                    <span>{formatSecondsToTime(seg.timestampSeconds)}</span>
                  </div>
                  <p className="text-zinc-200 text-xs">{seg.text}</p>
                </div>
              ))
            )}
            <div ref={transcriberEndRef} />
          </div>
        </div>
      )}

      {/* 2. AI Bookmark Popover */}
      {activeDrawer === 'bookmarks' && !isCollapsed && (
        <div
          className="mt-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-3xl w-72 transition-all"
          style={{
            backgroundColor: 'rgba(12, 12, 15, 0.88)',
            borderColor: 'rgba(255, 255, 255, 0.20)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Mark Moment [{formatSecondsToTime(elapsedSeconds)}]
            </span>
            <button
              onClick={() => setActiveDrawer(null)}
              className="p-1 rounded-md hover:bg-white/15 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                onAddBookmark('decision');
                setActiveDrawer(null);
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex flex-col items-center gap-1 text-center transition-all hover:scale-105"
            >
              <span className="text-xs font-bold">Decision</span>
              <span className="text-[9px] text-zinc-400 font-mono">Agreed point</span>
            </button>

            <button
              onClick={() => {
                onAddBookmark('action');
                setActiveDrawer(null);
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex flex-col items-center gap-1 text-center transition-all hover:scale-105"
            >
              <span className="text-xs font-bold">Action</span>
              <span className="text-[9px] text-zinc-400 font-mono">Todo task</span>
            </button>

            <button
              onClick={() => {
                onAddBookmark('highlight');
                setActiveDrawer(null);
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex flex-col items-center gap-1 text-center transition-all hover:scale-105"
            >
              <span className="text-xs font-bold">Highlight</span>
              <span className="text-[9px] text-zinc-400 font-mono">Key insight</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Quick Note Jotter Drawer */}
      {activeDrawer === 'notes' && !isCollapsed && (
        <form
          onSubmit={handleSubmitNote}
          className="mt-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-3xl w-80 transition-all"
          style={{
            backgroundColor: 'rgba(12, 12, 15, 0.88)',
            borderColor: 'rgba(255, 255, 255, 0.20)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">
              Quick Note @ {formatSecondsToTime(elapsedSeconds)}
            </span>
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="p-1 rounded-md hover:bg-white/15 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <input
            type="text"
            value={quickNoteText}
            onChange={(e) => setQuickNoteText(e.target.value)}
            placeholder="Type bullet point and press Enter..."
            autoFocus
            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/50"
          />

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setActiveDrawer(null)}
              className="px-2.5 py-1 rounded-lg hover:bg-white/10 text-[11px] text-zinc-400 hover:text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!quickNoteText.trim()}
              className="px-3 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-[11px] font-bold"
            >
              Save Note
            </button>
          </div>
        </form>
      )}

      {/* 4. Screenshot Strip Drawer */}
      {activeDrawer === 'screenshots' && !isCollapsed && (
        <div
          className="mt-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-3xl w-[360px] max-w-[90vw] transition-all"
          style={{
            backgroundColor: 'rgba(12, 12, 15, 0.88)',
            borderColor: 'rgba(255, 255, 255, 0.20)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Screenshots ({screenshots.length})
            </span>
            <button
              onClick={() => setActiveDrawer(null)}
              className="p-1 rounded-md hover:bg-white/15 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {screenshots.map((ss, idx) => (
              <div key={ss.id} className="relative group shrink-0 w-24 rounded-lg overflow-hidden border border-white/15 bg-black">
                <img src={ss.dataUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-16 object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => onRemoveScreenshot(ss.id)}
                    className="p-1 rounded bg-black/80 hover:bg-zinc-800 text-white"
                    title="Delete screenshot"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-1 bg-zinc-950/80 text-[9px] font-mono text-zinc-300 text-center truncate">
                  {formatSecondsToTime(ss.timestampSeconds)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
