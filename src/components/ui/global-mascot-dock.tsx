import React, { useState } from 'react';
import { HuskyMascot } from './husky-mascot';
import { useWorkspace } from '../../context/workspace-context';
import { useSound } from '../../context/sound-context';
import { useAI } from '../../context/ai-context';
import { X, Sparkles, Feather, Volume2, VolumeX, ArrowRight, MessageSquare } from 'lucide-react';

export const GlobalMascotDock: React.FC = () => {
  const { activeView, setActiveView } = useWorkspace();
  const { isMuted, toggleMute, playPop, playThock } = useSound();
  const { isConnected, selectedModel } = useAI();

  const [isExpanded, setIsExpanded] = useState(false);

  // If in zen mode or landing page, let those pages render mascot custom
  if (activeView === 'zen' || activeView === 'landing') return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 select-none font-sans">
      {isExpanded ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl p-5 shadow-2xl w-80 space-y-4 animate-fade-in text-xs text-zinc-300">
          <div className="flex items-center justify-between border-b dark:border-zinc-850 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-bold text-white tracking-tight">HuskyNote Companion</span>
            </div>
            <button
              onClick={() => {
                playPop();
                setIsExpanded(false);
              }}
              className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
              title="Minimize companion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <HuskyMascot size="sm" showSpeechBubble={false} />
            <div className="space-y-1">
              <p className="text-zinc-200 text-xs font-medium">
                "I'm keeping your notes and meetings organized locally."
              </p>
              <div className="text-[10px] font-mono text-zinc-500">
                {isConnected ? `AI: ${selectedModel}` : 'AI: Offline'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t dark:border-zinc-850 flex flex-col gap-2">
            <button
              onClick={() => {
                playThock();
                setActiveView('zen');
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 dark:hover:bg-zinc-850 text-white font-mono text-[11px] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Feather className="w-3.5 h-3.5 text-zinc-300" />
                <span>Open Husky Notes</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            <button
              onClick={toggleMute}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900/60 border dark:border-zinc-850 text-zinc-400 hover:text-zinc-200 font-mono text-[10px] transition-colors"
            >
              <span className="flex items-center gap-2">
                {isMuted ? <VolumeX className="w-3 h-3 text-zinc-500" /> : <Volume2 className="w-3 h-3 text-zinc-300" />}
                <span>Tactile Sound Effects</span>
              </span>
              <span>{isMuted ? 'Muted' : 'Thock Active'}</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            playPop();
            setIsExpanded(true);
          }}
          className="group flex items-center gap-2.5 px-3 py-2 rounded-full bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-105"
          title="Open Husky Focus Companion"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center">
            <HuskyMascot size="sm" showSpeechBubble={false} enableInteraction={false} />
          </div>
          <span className="font-mono text-xs text-zinc-300 group-hover:text-white pr-1">
            Husky Notes
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}
    </div>
  );
};
