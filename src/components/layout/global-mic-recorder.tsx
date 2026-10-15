import React, { useState, useRef, useEffect } from 'react';
import { Mic, Check, Copy, Bookmark, X, Pause, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { StatusDot } from '../ui/status-dot';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '../../services/audio/recorder';
import { LiveSpeechTranscriber, type TranscriptSegment, formatSecondsToTime } from '../../services/audio/transcriber';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';
import { tourTarget } from '@/features/guided-tour/tours/targets';

export const GlobalMicRecorder: React.FC = () => {
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    audioRecorderRef.current = new AudioRecorder();
    speechTranscriberRef.current = new LiveSpeechTranscriber();

    return () => {
      audioRecorderRef.current?.stop();
      speechTranscriberRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartListening = async () => {
    try {
      setTranscript([]);
      setElapsedSeconds(0);
      setIsOpen(true);

      await audioRecorderRef.current?.start((level) => {
        setAudioLevel(level);
      });

      speechTranscriberRef.current?.setInputStream(audioRecorderRef.current?.getStream() ?? null);
      const settings = await db.settings.get('current');
      speechTranscriberRef.current?.setLanguage(settings?.speechLanguage ?? 'auto');
      speechTranscriberRef.current?.start((seg) => {
        setTranscript((prev) => [...prev, seg]);
        // Also emit event so editors can insert text live
        window.dispatchEvent(
          new CustomEvent('huskynote:voice-dictation', { detail: { text: seg.text } })
        );
      });

      setIsListening(true);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);

      addToast('Global microphone active. Listening for voice dictation...', 'info');
    } catch (err: any) {
      console.warn('[HuskyNote] Mic start error:', err);
      addToast('Microphone access was denied. Please allow microphone permissions in your browser.', 'error');
    }
  };

  const handleStopListening = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsListening(false);
    audioRecorderRef.current?.stop();
    speechTranscriberRef.current?.stop();
  };

  const fullText = transcript.map((s) => s.text).join(' ');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Dictation copied to clipboard.', 'info');
  };

  const handleSaveAsNote = async () => {
    if (!fullText.trim()) return;
    try {
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `Voice Note (${new Date().toLocaleDateString()})`,
        content: `# Voice Note\n\n**Recorded:** ${new Date().toLocaleString()}\n\n${fullText}`,
        tags: ['voice-note', 'dictation'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast('Saved dictation to workspace notes.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
      setIsOpen(false);
      handleStopListening();
    } catch {
      addToast('Failed to save voice note.', 'error');
    }
  };

  const closeDrawer = () => {
    setIsOpen(false);
    if (isListening) handleStopListening();
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeDrawer();
      }}
    >
      {/* Topbar Mic Trigger Button (anchors the dictation popover; clicking it starts or stops listening) */}
      <PopoverAnchor asChild>
        <Button
          type="button"
          variant="ghost"
          size={isListening ? 'sm' : 'icon-sm'}
          {...tourTarget('voice-type')}
          onClick={() => {
            if (isListening) {
              handleStopListening();
            } else {
              handleStartListening();
            }
          }}
          aria-pressed={isListening}
          className={cn(
            isListening
              ? 'bg-destructive/10 px-2 text-destructive hover:bg-destructive/15 hover:text-destructive'
              : 'text-muted-foreground'
          )}
          title={isListening ? 'Stop microphone dictation' : 'Dictate with your microphone'}
          aria-label={isListening ? 'Stop microphone dictation' : 'Dictate with your microphone'}
        >
          {isListening ? <StatusDot tone="destructive" pulse /> : <Mic />}
          {isListening && (
            <span className="font-mono text-xs tabular-nums">{formatSecondsToTime(elapsedSeconds)}</span>
          )}
        </Button>
      </PopoverAnchor>

      {/* Live dictation drawer: stays open while you keep working, so dictated text can land in an open note */}
      <PopoverContent
        align="end"
        className="w-96 p-0"
        aria-label="Global Voice Dictation"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={isListening ? 'destructive' : 'muted'} pulse={isListening} />
            <span className="truncate text-sm font-medium text-foreground">Global Voice Dictation</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatSecondsToTime(elapsedSeconds)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isListening ? (
              <Button variant="ghost" size="xs" onClick={handleStopListening}>
                <Pause />
                Pause
              </Button>
            ) : (
              <Button variant="ghost" size="xs" onClick={handleStartListening}>
                <Play />
                Resume
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={closeDrawer}
              aria-label="Close dictation"
              className="size-6 text-muted-foreground"
            >
              <X />
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-3">
          {/* Live Transcript Stream */}
          <div className="max-h-48 min-h-[4.5rem] overflow-y-auto rounded-md bg-secondary p-3 text-sm leading-6 text-foreground">
            {fullText ? (
              fullText
            ) : (
              <span className="text-muted-foreground">
                {isListening ? 'Speak into your microphone now...' : 'Microphone paused.'}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!fullText.trim()}>
                {copied ? <Check /> : <Copy />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSaveAsNote} disabled={!fullText.trim()}>
                <Bookmark />
                <span>Save Note</span>
              </Button>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                handleStopListening();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
