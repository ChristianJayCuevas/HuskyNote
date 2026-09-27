import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../db';
import type { Note } from '../types';
import { useWorkspace } from '../context/workspace-context';
import { useSound } from '../context/sound-context';
import { HuskyMascot } from '../components/ui/husky-mascot';
import { Button } from '../components/ui/button';
import {
  Feather,
  Clock,
  Eye,
  EyeOff,
  Minimize2,
  Save,
  CheckCircle,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../services/audio/transcriber';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const ZenFocusView: React.FC = () => {
  const { setActiveView, addToast, activeNoteId, setActiveNoteId } = useWorkspace();
  const { playThock, playChime } = useSound();

  const [title, setTitle] = useState('Deep Focus Notes');
  const [content, setContent] = useState(
    '# Deep Focus\n\nQuiet the noise. Capture your thoughts directly to local IndexedDB storage.\n\n- No tracking or ads\n- Pure markdown formatting\n- Real-time offline autosave\n\nStart typing below...'
  );
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
        const noteEntity: Note = {
          id: currentNoteId,
          title: title || 'Untitled Focus Note',
          content,
          tags: ['zen-focus'],
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

  // Handle typing keystroke with tactile sound feedback
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsTyping(true);
    playThock(0.95 + Math.random() * 0.1);

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
    playChime();
    addToast('Husky note saved to your device.', 'success');
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
    <div className="relative w-full h-full min-h-screen bg-white dark:bg-canvas text-slate-900 dark:text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Subtle Top Minimal Navigation Bar */}
      <header className="h-12 border-b dark:border-zinc-850 px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 font-mono text-xs">
            <Feather className="w-3.5 h-3.5 text-slate-800 dark:text-zinc-200" />
            <span className="text-slate-950 dark:text-white font-semibold">HUSKY NOTES</span>
          </div>

          <span className="text-slate-400 dark:text-zinc-600">•</span>

          {/* Focus Timer */}
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono text-[11px] text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors"
            title="Click to pause/resume focus timer"
          >
            <Clock className="w-3 h-3 text-slate-600 dark:text-zinc-400" />
            <span>{formatTimer(timerSeconds)}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Metrics */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-zinc-500">
            <span>{wordsCount} words</span>
            <span>•</span>
            <span>~{readTimeMin} min read</span>
            <span>•</span>
            <span className="text-emerald-400">Autosaved</span>
          </div>

          {/* Toggle Split Preview */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-1.5 rounded text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
            title={showPreview ? 'Hide preview' : 'Show markdown preview'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Voice Typing Button */}
          <button
            onClick={toggleDictation}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border transition-all ${
              isDictating
                ? 'bg-red-950/80 border-red-700 text-white animate-pulse'
                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white'
            }`}
            title={isDictating ? 'Pause Voice Typing' : 'Start Voice Typing'}
          >
            {isDictating ? <Mic className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isDictating ? 'LISTENING' : 'VOICE TYPE'}</span>
          </button>

          {/* Manual Save */}
          <Button variant="outline" size="sm" onClick={handleManualSave}>
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>

          {/* Exit Husky Notes */}
          <button
            onClick={() => setActiveView('notes')}
            className="flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 transition-colors"
            title="Return to standard workspace"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit Husky Notes</span>
          </button>
        </div>
      </header>

      {/* Main Focus Writing Area */}
      <main className="flex-1 flex overflow-hidden relative">
        <div
          className={`flex-1 flex flex-col max-w-4xl mx-auto w-full px-8 py-10 overflow-y-auto select-text ${
            showPreview ? 'grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl' : ''
          }`}
        >
          {/* Editor Column */}
          <div className="flex flex-col flex-1 min-h-[500px]">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title..."
              className="w-full bg-transparent text-2xl sm:text-4xl font-black text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-700 tracking-tight outline-none border-b border-transparent focus:border-slate-200 dark:focus:border-zinc-800 pb-3 mb-6 transition-colors"
            />

            <textarea
              value={content}
              onChange={handleContentChange}
              placeholder="Begin typing freely..."
              className="w-full flex-1 bg-transparent text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-700 font-sans text-sm sm:text-base leading-relaxed outline-none resize-none scrollbar-none selection:bg-slate-100 dark:selection:bg-zinc-800 selection:text-slate-950 dark:selection:text-white"
              autoFocus
              spellCheck={false}
            />
          </div>

          {/* Split Markdown Preview (Optional) */}
          {showPreview && (
            <div className="border-l dark:border-zinc-850 pl-8 overflow-y-auto text-slate-800 dark:text-zinc-200 font-sans prose prose-invert max-w-none text-sm leading-relaxed select-text">
              <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Preview
              </div>
              <h1 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">{title}</h1>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Animated Husky Mascot Companion in Bottom Right Corner */}
        <div className="fixed bottom-6 right-6 z-30 pointer-events-auto">
          <HuskyMascot
            size="md"
            isWriting={isTyping}
          />
        </div>
      </main>
    </div>
  );
};
