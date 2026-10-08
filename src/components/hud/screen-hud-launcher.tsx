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
import { useTheme } from '../../context/theme-context';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
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
      className={cn(
        'fixed z-[9999] h-[220px] w-[400px] overflow-hidden rounded-xl border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
    >
      <FloatingScreenHud onClose={onClose} />
    </div>
  );
};

export const ScreenHudLauncher: React.FC = () => {
  const { addToast } = useWorkspace();
  const { theme } = useTheme();
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isOverlayFallback, setIsOverlayFallback] = useState<boolean>(false);

  const handleToggleScreenHud = async () => {

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
          addToast('Quick Bar activated.', 'success');
        } else {
          throw new Error('Could not obtain PiP container.');
        }
      } catch (err: any) {
        console.warn('[HuskyNote] PiP error, falling back to overlay:', err);
        setIsOverlayFallback(true);
        setIsActive(true);
        addToast('Quick Bar activated.', 'success');
      }
    } else {
      // In-browser floating overlay fallback for WKWebView / Safari
      setIsOverlayFallback(true);
      setIsActive(true);
      addToast('Quick Bar activated.', 'success');
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleToggleScreenHud}
        aria-pressed={isActive}
        className={cn('relative', isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
        title="Quick Bar: floating recording controls"
        aria-label="Toggle Desktop Quick Bar"
      >
        <Monitor />
        {isActive && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-foreground" />}
      </Button>

      {/* Render into Document PiP window via Portal */}
      {isActive && pipContainer && createPortal(
        <div className={cn('h-full w-full', theme === 'dark' && 'dark')}>
          <FloatingScreenHud
            onClose={() => {
              closePipHudWindow();
              setPipContainer(null);
              setIsActive(false);
              addToast('Quick Bar closed.', 'info');
            }}
          />
        </div>,
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
