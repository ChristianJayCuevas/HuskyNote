import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { db } from '../db';
import type { Note } from '../types';
import { useWorkspace } from '../context/workspace-context';
import { HuskyMascot } from '../components/ui/husky-mascot';
import { MicrophonePicker } from '../components/ui/microphone-picker';
import { Button, buttonVariants } from '../components/ui/button';
import { Kbd } from '../components/ui/kbd';
import { Markdown } from '../components/ui/markdown';
import { StatusDot } from '../components/ui/status-dot';
import { autoGrowTextarea } from '../components/notes/auto-grow-textarea';
import { cn } from '@/lib/utils';
import { Feather, Clock, Eye, EyeOff, Minimize2, Save, CheckCircle, Mic } from 'lucide-react';
import { LiveSpeechTranscriber } from '../services/audio/transcriber';

export const ZenFocusView: React.FC = () => {
  const { setActiveView, addToast, activeNoteId, setActiveNoteId } = useWorkspace();

  const [title, setTitle] = useState('Focus Note');
  const [content, setContent] = useState('');
  const [currentNoteId, setCurrentNoteId] = useState<string>(activeNoteId || `zen-${Date.now()}`);
  const [showPreview, setShowPreview] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  // Focus Timer state (Pomodoro style 25m or countup)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  const typingTimeoutRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The text area grows with the writing so the page scrolls as one document
  useLayoutEffect(() => {
    autoGrowTextarea(textareaRef.current);
  }, [content, showPreview]);
  useEffect(() => {
    const onResize = () => autoGrowTextarea(textareaRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load existing note if activeNoteId was provided
  useEffect(() => {
    if (activeNoteId) {
      db.notes.get(activeNoteId).then((note) => {
        if (note) {
          setTitle(note.title);
          setContent(note.content);
          setCurrentNoteId(note.id);
        }
      });
    }
  }, [activeNoteId]);

  // Esc leaves focus mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveView('notes');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveView]);

  // Focus Timer interval
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Debounced autosave to IndexedDB
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const existing = await db.notes.get(currentNoteId);
        // Opening Focus mode alone should not leave an empty note behind; create it once there is text
        if (!existing && !content.trim()) return;
        const noteEntity: Note = {
          id: currentNoteId,
          title: title || 'Untitled Focus Note',
          content,
          tags: existing?.tags?.length ? existing.tags : ['zen-focus'],
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
          versions: existing?.versions || [],
        };
        await db.notes.put(noteEntity);
        setLastSaved(Date.now());
      } catch (err) {
        console.warn('[HuskyNote] Zen autosave warning:', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title, content, currentNoteId]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1200);
  };

  // Metrics
  const wordsCount = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [content]);

  const readTimeMin = useMemo(() => {
    return Math.max(1, Math.ceil(wordsCount / 200));
  }, [wordsCount]);

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleManualSave = async () => {
    addToast('Note saved.', 'success');
  };

  // Voice Dictation effect & listener for Husky Notes Focus
  useEffect(() => {
    speechTranscriberRef.current = new LiveSpeechTranscriber();

    const handleGlobalDictation = (e: any) => {
      const text = e.detail?.text;
      if (text) {
        setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
      }
    };

    window.addEventListener('huskynote:voice-dictation', handleGlobalDictation);

    return () => {
      speechTranscriberRef.current?.stop();
      window.removeEventListener('huskynote:voice-dictation', handleGlobalDictation);
    };
  }, []);

  const toggleDictation = async () => {
    if (isDictating) {
      speechTranscriberRef.current?.stop();
      setIsDictating(false);
      addToast('Voice typing paused.', 'info');
    } else {
      try {
        await speechTranscriberRef.current?.start((seg) => {
          setContent((prev) => (prev ? `${prev} ${seg.text}` : seg.text));
        });
        setIsDictating(true);
        addToast('Voice typing active. Speak freely...', 'success');
      } catch {
        addToast('Microphone access denied.', 'error');
      }
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-background text-foreground">
      {/* Minimal top bar: muted ghost controls only */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex items-center gap-1.5 px-1.5 text-sm text-muted-foreground">
            <Feather className="size-4" />
            <span className="hidden font-medium sm:inline">Focus mode</span>
          </div>

          {/* Focus Timer */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className={cn('font-mono tabular-nums', isTimerRunning ? 'text-muted-foreground' : 'text-muted-foreground/60')}
            title="Click to pause/resume focus timer"
          >
            <Clock />
            <span>{formatTimer(timerSeconds)}</span>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Metrics */}
          <div className="mr-2 hidden items-center gap-2 text-xs tabular-nums text-muted-foreground md:flex">
            <span>{wordsCount} words</span>
            <span aria-hidden="true">·</span>
            <span>~{readTimeMin} min read</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle className="size-3.5" />
              Autosaved
            </span>
          </div>

          {/* Toggle Split Preview */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowPreview(!showPreview)}
            aria-pressed={showPreview}
            className={cn('text-muted-foreground', showPreview && 'bg-accent text-accent-foreground')}
            title={showPreview ? 'Hide preview' : 'Show markdown preview'}
          >
            {showPreview ? <EyeOff /> : <Eye />}
          </Button>

          {/* Voice Typing Button, with the microphone picker attached */}
          <div className="inline-flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDictation}
              aria-pressed={isDictating}
              className={cn(
                'rounded-r-none',
                isDictating
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                  : 'text-muted-foreground'
              )}
              title={isDictating ? 'Pause Voice Typing' : 'Start Voice Typing'}
            >
              {isDictating ? <StatusDot tone="destructive" pulse /> : <Mic />}
              <span className="hidden sm:inline">{isDictating ? 'Listening' : 'Voice type'}</span>
            </Button>
            <MicrophonePicker
              align="right"
              disabled={isDictating}
              triggerClassName={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'w-5 rounded-l-none text-muted-foreground')}
            />
          </div>

          {/* Manual Save */}
          <Button variant="ghost" size="sm" onClick={handleManualSave} className="text-muted-foreground" title="Save">
            <Save />
            <span className="hidden sm:inline">Save</span>
          </Button>

          {/* Exit Focus mode */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('notes')}
            className="text-muted-foreground"
            title="Back to Notes (Esc)"
          >
            <Minimize2 />
            <span className="hidden sm:inline">Exit focus</span>
            <Kbd className="ml-0.5 hidden md:inline-flex">Esc</Kbd>
          </Button>
        </div>
      </div>

      {/* Writing area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'mx-auto w-full px-6 pb-32 pt-10 sm:pt-16',
            showPreview ? 'grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2' : 'max-w-2xl'
          )}
        >
          {/* Editor Column */}
          <div className="flex min-w-0 flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title..."
              aria-label="Note title"
              className="mb-6 w-full bg-transparent text-3xl font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:outline-none sm:text-4xl"
            />

            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Begin typing freely..."
              aria-label="Note content"
              className="block min-h-[60vh] w-full resize-none overflow-hidden bg-transparent text-lg leading-8 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:outline-none"
              autoFocus
              spellCheck={false}
            />
          </div>

          {/* Split Markdown Preview (Optional) */}
          {showPreview && (
            <div className="min-w-0 border-t pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
              <div className="mb-4 text-xs font-medium text-muted-foreground">Preview</div>
              <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">{title}</h1>
              <Markdown>{content}</Markdown>
            </div>
          )}
        </div>
      </div>

      {/* Husky companion in the bottom-right corner */}
      <div className="pointer-events-auto fixed bottom-6 right-6 z-30">
        <HuskyMascot size="md" isWriting={isTyping} />
      </div>
    </div>
  );
};
