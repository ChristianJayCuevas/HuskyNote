import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Check, Copy, Bookmark, X, Square, Sparkles } from 'lucide-react';
import { AudioRecorder } from '../../services/audio/recorder';
import { LiveSpeechTranscriber, type TranscriptSegment, formatSecondsToTime } from '../../services/audio/transcriber';
import { useWorkspace } from '../../context/workspace-context';
import { db } from '../../db';

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

  return (
    <div className="relative">
      {/* Topbar Mic Trigger Button */}
      <button
        onClick={() => {
          if (isListening) {
            handleStopListening();
          } else {
            handleStartListening();
          }
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-semibold shadow-sm ${
          isListening
            ? 'bg-red-950/80 border-red-700 text-white animate-pulse'
            : 'bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:border-slate-400 dark:hover:border-zinc-700'
        }`}
        title={isListening ? 'Stop microphone dictation' : 'Start global microphone dictation'}
      >
        <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-red-400' : 'text-slate-600 dark:text-zinc-400'}`} />
        <span className="hidden sm:inline">
          {isListening ? formatSecondsToTime(elapsedSeconds) : 'Mic'}
        </span>
        {isListening && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"
          />
        )}
      </button>

      {/* Popover Live Dictation Drawer */}
      {isOpen && (
        <div
          className="absolute right-0 top-11 mt-1 w-80 sm:w-96 rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-white/20 text-white shadow-2xl p-4 z-50 animate-fade-in"
          style={{
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.15)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-white animate-ping' : 'bg-zinc-500'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Global Voice Dictation
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {formatSecondsToTime(elapsedSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {isListening ? (
                <button
                  onClick={handleStopListening}
                  className="px-2 py-0.5 rounded bg-white text-black text-[10px] font-bold hover:bg-zinc-200 transition-colors"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleStartListening}
                  className="px-2 py-0.5 rounded bg-white text-black text-[10px] font-bold hover:bg-zinc-200 transition-colors"
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (isListening) handleStopListening();
                }}
                className="p-1 rounded hover:bg-white/15 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Transcript Stream */}
          <div className="min-h-[70px] max-h-48 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-3 text-xs leading-relaxed text-zinc-200 mb-3 font-sans">
            {fullText ? (
              fullText
            ) : (
              <span className="text-zinc-500 italic">
                {isListening ? 'Speak into your microphone now...' : 'Microphone paused.'}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                disabled={!fullText.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleSaveAsNote}
                disabled={!fullText.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Bookmark className="w-3 h-3" />
                <span>Save Note</span>
              </button>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                handleStopListening();
              }}
              className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold shadow"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
