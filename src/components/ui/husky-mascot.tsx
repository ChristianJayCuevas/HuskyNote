import React, { useState, useEffect } from 'react';
import mascotImg from '../../assets/husky-mascot.png';
import { useSound } from '../../context/sound-context';
import { Edit3 } from 'lucide-react';

interface HuskyMascotProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  isWriting?: boolean;
  message?: string;
  className?: string;
  showSpeechBubble?: boolean;
  enableInteraction?: boolean;
  badge?: string;
}

export const HuskyMascot: React.FC<HuskyMascotProps> = ({
  size = 'md',
  isWriting = false,
  className = '',
  enableInteraction = true,
}) => {
  const { playPop, playThock } = useSound();
  const [isHovered, setIsHovered] = useState(false);
  const [scribbleActive, setScribbleActive] = useState(true);

  // Periodic writing cycle
  useEffect(() => {
    if (isWriting) {
      setScribbleActive(true);
      return;
    }
    const interval = setInterval(() => {
      setScribbleActive((prev) => !prev);
    }, 2800);
    return () => clearInterval(interval);
  }, [isWriting]);

  const handleClick = () => {
    if (!enableInteraction) return;
    playPop();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    playThock(1.2);
  };

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28',
    lg: 'w-44 h-44',
    hero: 'w-60 h-60 sm:w-72 sm:h-72',
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Mascot Image with Motion & Live Scribble Overlay */}
      <div
        className={`relative ${sizeClasses[size]} transition-all duration-300 ${
          isHovered ? 'scale-105' : ''
        } ${enableInteraction ? 'cursor-pointer' : ''}`}
      >
        <img
          src={mascotImg}
          alt="HuskyNote Husky Mascot"
          className="w-full h-full object-contain rounded-3xl filter drop-shadow-[0_12px_24px_rgba(255,255,255,0.06)] animate-[float_4s_ease-in-out_infinite]"
          style={{ mixBlendMode: 'screen' }}
        />

        {/* Animated Pencil & Notepad Scribble Effect */}
        {size !== 'sm' && (scribbleActive || isWriting) && (
          <div className="absolute bottom-5 right-6 pointer-events-none flex items-center gap-1 bg-white/80 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded-full shadow-lg animate-fade-in">
            <Edit3 className="w-3 h-3 text-slate-950 dark:text-white animate-bounce" />
            <span className="text-[9px] font-mono text-slate-700 dark:text-zinc-300 tracking-wider whitespace-nowrap">
              taking notes...
            </span>
          </div>
        )}

        {/* Floating Ink Dots on Hover */}
        {isHovered && (
          <div className="absolute -top-1 -right-1 pointer-events-none">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 dark:bg-white opacity-40" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-900 dark:bg-white" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
