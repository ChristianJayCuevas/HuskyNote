import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  openPipHudWindow,
  closePipHudWindow,
  isDocumentPipSupported,
  isPipHudActive,
} from '../../services/screen/pip-hud';
import { FloatingScreenHud } from './floating-screen-hud';
import { useWorkspace } from '../../context/workspace-context';
import { useSound } from '../../context/sound-context';
import { Monitor } from 'lucide-react';

interface DraggableOverlayProps {
  onClose: () => void;
}

const DraggableOverlay: React.FC<DraggableOverlayProps> = ({ onClose }) => {
  const [position, setPosition] = useState(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 440) : 400;
    const defaultY = 76; // Comfortably below the 56px topbar with clear clearance
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not initiate drag when clicking buttons, inputs, links, or textareas
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a')) {
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

      const newX = Math.max(16, Math.min(window.innerWidth - 420, dragStartRef.current.startX + dx));
      const newY = Math.max(16, Math.min(window.innerHeight - 240, dragStartRef.current.startY + dy));

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

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className={`fixed z-[9999] w-[400px] h-[220px] rounded-2xl shadow-2xl overflow-hidden border border-white/20 bg-zinc-950/95 backdrop-blur-2xl transition-shadow ${
        isDragging
          ? 'cursor-grabbing shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] scale-[1.01]'
          : 'cursor-grab'
      } animate-in fade-in zoom-in-95 duration-150`}
    >
      <FloatingScreenHud onClose={onClose} />
    </div>
  );
};

export const ScreenHudLauncher: React.FC = () => {
  const { addToast } = useWorkspace();
  const { playThock, playPop } = useSound();
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isOverlayFallback, setIsOverlayFallback] = useState<boolean>(false);

  const handleToggleScreenHud = async () => {
    playThock();

    if (isActive) {
      closePipHudWindow();
      setPipContainer(null);
      setIsActive(false);
      setIsOverlayFallback(false);
      addToast('Quick Bar closed.', 'info');
      return;
    }

    if (isDocumentPipSupported()) {
      try {
        const container = await openPipHudWindow({
          width: 420,
          height: 220,
          onClose: () => {
            setPipContainer(null);
            setIsActive(false);
          },
        });

        if (container) {
          setPipContainer(container);
          setIsActive(true);
          playPop();
          addToast('🖥️ Quick Bar activated.', 'success');
        } else {
          throw new Error('Could not obtain PiP container.');
        }
      } catch (err: any) {
        console.warn('[HuskyNote] PiP error, falling back to overlay:', err);
        setIsOverlayFallback(true);
        setIsActive(true);
        addToast('🖥️ Quick Bar activated.', 'success');
      }
    } else {
      // In-browser floating overlay fallback for WKWebView / Safari
      setIsOverlayFallback(true);
      setIsActive(true);
      addToast('🖥️ Quick Bar activated.', 'success');
    }
  };

  useEffect(() => {
    const onToggleEvent = () => {
      handleToggleScreenHud();
    };
    window.addEventListener('huskynote:toggle-hud', onToggleEvent);
    return () => window.removeEventListener('huskynote:toggle-hud', onToggleEvent);
  }, [isActive]);

  return (
    <>
      <button
        onClick={handleToggleScreenHud}
        className={`px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          isActive
            ? 'bg-slate-900 text-white dark:bg-white dark:text-black border-slate-900 dark:border-white shadow-sm'
            : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700'
        }`}
        title="Toggle floating Quick Bar"
        aria-label="Toggle Desktop Quick Bar"
      >
        <Monitor className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">Quick Bar</span>
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-black animate-pulse" />}
      </button>

      {/* Render into Document PiP window via Portal */}
      {isActive && pipContainer && createPortal(
        <FloatingScreenHud
          onClose={() => {
            closePipHudWindow();
            setPipContainer(null);
            setIsActive(false);
            addToast('Quick Bar closed.', 'info');
          }}
        />,
        pipContainer
      )}

      {/* Fallback Draggable Overlay inside HuskyNote (mounted to document.body) */}
      {isActive && isOverlayFallback && !pipContainer && typeof document !== 'undefined' && createPortal(
        <DraggableOverlay
          onClose={() => {
            setIsActive(false);
            setIsOverlayFallback(false);
            addToast('Quick Bar closed.', 'info');
          }}
        />,
        document.body
      )}
    </>
  );
};
