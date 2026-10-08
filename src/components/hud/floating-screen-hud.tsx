import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { Mic, MicOff, ExternalLink, X, Send, Radio } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { StatusDot } from '../ui/status-dot';
import { cn } from '@/lib/utils';

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

  // Renders inside the Document Picture-in-Picture window too: plain elements and token classes only,
  // no Radix portal components (tooltips, menus, popovers would open in the main window instead).
  return (
    <div className="flex h-full w-full select-none flex-col gap-3 bg-popover p-3 font-sans text-popover-foreground">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot tone={isRecording ? 'destructive' : 'success'} pulse={isRecording} />
          <span className="truncate text-xs font-medium text-foreground">HuskyNote Quick Bar</span>
          {isRecording && (
            <Badge variant="destructive" className="font-mono tabular-nums">
              {formatSecs(elapsedSeconds)}
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (window.opener) window.opener.focus();
              else window.focus();
            }}
            className="size-6 text-muted-foreground"
            title="Focus HuskyNote Window"
            aria-label="Focus HuskyNote Window"
          >
            <ExternalLink />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="size-6 text-muted-foreground"
              title="Close Quick Bar"
              aria-label="Close Quick Bar"
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      {/* Middle: Live Speech Caption Ticker */}
      <div className="flex min-h-[46px] items-start gap-2 overflow-hidden rounded-md bg-secondary px-2.5 py-2">
        <Radio className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeSpeaker}</span>
            <span aria-hidden="true">·</span>
            <span>Live Caption</span>
          </div>
          <p className="line-clamp-2 text-xs leading-snug text-foreground">
            {latestTranscriptSnippet || (isRecording ? 'Listening to speech...' : 'Ready to record')}
          </p>
        </div>
      </div>

      {/* Bottom: Action Buttons & Quick Note Input */}
      <div className="mt-auto space-y-2">
        <form onSubmit={handleSaveQuickNote} className="flex items-center gap-1.5">
          <Input
            type="text"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder={noteSavedFeedback ? 'Saved to HuskyNote!' : 'Quick note... (Enter to save)'}
            aria-label="Quick note"
            className="h-7 flex-1 text-xs coarse:min-h-7"
          />
          <Button type="submit" variant="outline" size="icon-sm" title="Save Note" aria-label="Save Note">
            <Send />
          </Button>
        </form>

        {(onToggleMic || onAddBookmark) && (
          <div className="flex items-center justify-between gap-1">
            {onToggleMic && (
              <Button
                variant="outline"
                size="xs"
                onClick={onToggleMic}
                aria-pressed={isRecording}
                className={cn(isRecording && 'bg-accent')}
              >
                {isRecording ? <MicOff /> : <Mic />}
                <span>{isRecording ? 'Mute' : 'Mic'}</span>
              </Button>
            )}

            {onAddBookmark && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="xs" onClick={() => onAddBookmark('decision')}>
                  + Decision
                </Button>
                <Button variant="outline" size="xs" onClick={() => onAddBookmark('action')}>
                  + Action
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
