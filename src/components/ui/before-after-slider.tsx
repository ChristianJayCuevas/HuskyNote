import React, { useState, useRef, useCallback } from 'react';
import { GripVertical, Sparkles, CheckSquare, Mic, Volume2, ArrowLeftRight, Check } from 'lucide-react';

export const BeforeAfterSlider: React.FC = () => {
  const [sliderPos, setSliderPos] = useState(50); // percentage 15 - 85
  const [isDraggingState, setIsDraggingState] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(15, Math.min(85, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsDraggingState(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (isDragging.current) {
        handleMove(ev.clientX);
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      setIsDraggingState(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleMove(e.clientX);
  };

  return (
    <div className="w-full select-none space-y-4">
      {/* Interactive Controls & Mode Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Preset Switcher Buttons */}
        <div className="grid grid-cols-3 sm:inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => setSliderPos(80)}
            className={`px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              sliderPos > 65
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Raw Audio<span className="hidden sm:inline"> (Before)</span></span>
          </button>

          <button
            onClick={() => setSliderPos(50)}
            className={`px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              sliderPos >= 40 && sliderPos <= 60
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">50/50<span className="hidden sm:inline"> Split</span></span>
          </button>

          <button
            onClick={() => setSliderPos(20)}
            className={`px-1.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              sliderPos < 35
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 shadow-sm'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">AI Summary<span className="hidden sm:inline"> (After)</span></span>
          </button>
        </div>

        {/* Hint Caption */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500 font-mono text-[11px]">
          <span className="hidden sm:inline">Drag divider or tap presets to compare</span>
          <span className="text-slate-700 dark:text-zinc-400 font-semibold">{Math.round(sliderPos)}% / {100 - Math.round(sliderPos)}%</span>
        </div>
      </div>

      {/* Main Interactive Comparison Viewport */}
      <div
        ref={containerRef}
        onClick={handleTrackClick}
        onTouchMove={handleTouchMove}
        className="relative w-full min-h-[480px] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-white dark:bg-canvas shadow-xl dark:shadow-2xl cursor-ew-resize select-none"
      >
        {/* Left Side: Raw Audio Transcript Buffer */}
        <div
          className={`absolute inset-y-0 left-0 overflow-hidden bg-slate-50 dark:bg-zinc-900 border-r border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 z-10 select-none shadow-[6px_0_24px_rgba(0,0,0,0.1)] dark:shadow-[6px_0_24px_rgba(0,0,0,0.7)] ${
            isDraggingState ? '' : 'transition-[width] duration-300 ease-out'
          }`}
          style={{ width: `${sliderPos}%` }}
        >
          <div className="h-full p-5 sm:p-7 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                  <span className="font-bold text-xs tracking-tight text-slate-800 dark:text-zinc-200 uppercase font-mono">
                    Raw Audio Speech Stream
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-600 dark:text-zinc-400 bg-slate-200/70 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 px-2 py-0.5 rounded shrink-0">
                  00:14:32
                </span>
              </div>

              {/* Monospace Raw Dialogue List */}
              <div className="text-xs text-slate-700 dark:text-zinc-300 space-y-2.5 font-mono leading-relaxed bg-white dark:bg-zinc-950/70 p-4 rounded-xl border border-slate-200 dark:border-zinc-850">
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0 font-semibold">00:02</span>
                  <p><strong className="text-zinc-400 font-semibold">speaker:</strong> hey so about the deployment we were talking earlier...</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0 font-semibold">00:14</span>
                  <p><strong className="text-zinc-400 font-semibold">speaker:</strong> yeah i think friday might be better because of the load testing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0 font-semibold">00:31</span>
                  <p><strong className="text-zinc-400 font-semibold">speaker:</strong> who's preparing the yaml files again? arron did you do that?</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0 font-semibold">00:48</span>
                  <p><strong className="text-zinc-400 font-semibold">speaker:</strong> yeah i can write the manifests tonight and ping devops on slack</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0 font-semibold">01:05</span>
                  <p><strong className="text-zinc-400 font-semibold">speaker:</strong> okay cool make sure we don't drop traffic during db migration</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-800/80 flex items-center justify-between mt-4">
              <span>Unedited speech transcript</span>
              <span className="text-emerald-400/80 font-medium">100% Offline</span>
            </div>
          </div>
        </div>

        {/* Right Side: Structured AI Summary & Tasks */}
        <div
          className={`absolute inset-y-0 right-0 overflow-hidden bg-slate-50 dark:bg-canvas text-slate-900 dark:text-zinc-100 select-none ${
            isDraggingState ? '' : 'transition-[left,width] duration-300 ease-out'
          }`}
          style={{ left: `${sliderPos}%`, width: `${100 - sliderPos}%` }}
        >
          <div className="h-full p-5 sm:p-7 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white uppercase font-mono">
                    Synthesized Minutes & Deliverables
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded shrink-0">
                  Local AI Model
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3.5">
                {/* Decision Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-750 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider font-mono">
                      Key Decision
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">Consensus reached</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-medium">
                    "Release scheduled for Friday 18:00 UTC with zero-downtime canary rollout. Local IndexedDB persistence approved with zero cloud dependencies."
                  </p>
                </div>

                {/* Action Items Card */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-750 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider font-mono">
                      Extracted Action Items
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                      2 tasks assigned
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">Prepare canary rollout manifests</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-700 dark:text-zinc-300 bg-slate-200 dark:bg-zinc-850 px-2 py-0.5 rounded ml-2 shrink-0 border border-slate-300 dark:border-zinc-750">
                        @Arron
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">Verify zero-drop database migrations</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-700 dark:text-zinc-300 bg-slate-200 dark:bg-zinc-850 px-2 py-0.5 rounded ml-2 shrink-0 border border-slate-300 dark:border-zinc-750">
                        @DevOps
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 pt-3 border-t border-slate-200 dark:border-zinc-850 flex items-center justify-between mt-4">
              <span>Saved locally in IndexedDB</span>
              <span className="text-slate-400 dark:text-zinc-500">2 deliverables created</span>
            </div>
          </div>
        </div>

        {/* Draggable Divider Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute inset-y-0 -ml-4 w-8 flex items-center justify-center cursor-ew-resize z-20 pointer-events-auto ${
            isDraggingState ? '' : 'transition-[left] duration-300 ease-out'
          }`}
          style={{ left: `${sliderPos}%` }}
        >
          {/* Vertical Divider Line */}
          <div className="absolute inset-y-0 w-[2px] bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />

          {/* Central Circular Knob */}
          <div className="relative z-10 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.8)] border-2 border-white transition-transform hover:scale-110 active:scale-95 cursor-ew-resize">
            <GripVertical className="w-4 h-4 text-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
};
