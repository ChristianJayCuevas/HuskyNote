import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import {
  Mic,
  MicOff,
  FileText,
  Bookmark,
  ExternalLink,
  X,
  Sparkles,
  Send,
  Radio,
  Clock,
} from 'lucide-react';

interface FloatingScreenHudProps {
  onClose?: () => void;
  isRecording?: boolean;
  activeSpeaker?: string;
  latestTranscriptSnippet?: string;
  elapsedSeconds?: number;
  onToggleMic?: () => void;
  onAddBookmark?: (type: 'decision' | 'action' | 'highlight') => void;
}

export const FloatingScreenHud: React.FC<FloatingScreenHudProps> = ({
  onClose,
  isRecording = false,
  activeSpeaker = 'You / Host',
  latestTranscriptSnippet = '',
  elapsedSeconds = 0,
  onToggleMic,
  onAddBookmark,
}) => {
  const [quickNote, setQuickNote] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  const handleSaveQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;

    const text = quickNote.trim();
    setQuickNote('');

    // Save as a quick scratch note in IndexedDB
    const id = `note-hud-${Date.now()}`;
    await db.notes.put({
      id,
      title: `Quick Note: ${text.slice(0, 30)}...`,
      content: `# Note from Quick Bar\n\n**Captured at:** ${new Date().toLocaleString()}\n\n${text}`,
      tags: ['quick-bar', 'quick-note'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [],
    });

    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2000);
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full bg-zinc-950/85 backdrop-blur-2xl text-white p-3.5 flex flex-col justify-between select-none border border-white/15 shadow-2xl font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-xs font-bold font-mono tracking-tight text-white">
            HuskyNote Quick Bar
          </span>
          {isRecording && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white border border-white/20 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {formatSecs(elapsedSeconds)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (window.opener) window.opener.focus();
              else window.focus();
            }}
            className="p-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Focus HuskyNote Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Close Quick Bar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle: Live Speech Caption Ticker */}
      <div className="my-2 p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 flex items-start gap-2 min-h-[46px] overflow-hidden">
        <Radio className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 mb-0.5">
            <span className="text-white font-bold">{activeSpeaker}</span>
            <span>•</span>
            <span>Live Caption</span>
          </div>
          <p className="text-[11px] text-zinc-200 line-clamp-2 leading-tight">
            {latestTranscriptSnippet || (isRecording ? 'Listening to speech...' : 'Ready to record')}
          </p>
        </div>
      </div>

      {/* Bottom: Action Buttons & Quick Note Input */}
      <div className="space-y-2">
        <form onSubmit={handleSaveQuickNote} className="flex items-center gap-1.5">
          <input
            type="text"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder={noteSavedFeedback ? 'Saved to HuskyNote!' : 'Quick note... (Enter to save)'}
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 font-sans backdrop-blur-sm"
          />
          <button
            type="submit"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-200 hover:text-white transition-colors"
            title="Save Note"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex items-center justify-between gap-1 text-[10px] font-mono pt-1">
          {onToggleMic && (
            <button
              onClick={onToggleMic}
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition-colors ${
                isRecording
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              <span>{isRecording ? 'Mute' : 'Mic'}</span>
            </button>
          )}

          {onAddBookmark && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddBookmark('decision')}
                className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                + Decision
              </button>
              <button
                onClick={() => onAddBookmark('action')}
                className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                + Action
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
