import React from 'react';

export const TechnicalGrid: React.FC<{
  label?: string;
  coords?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ label = 'HUSKYNOTE / SYSTEM', coords = 'SEC-01 // 40.7128° N', className = '', children }) => {
  return (
    <div className={`relative border border-zinc-850/80 bg-zinc-950/40 p-6 sm:p-8 bg-tech-grid ${className}`}>
      {/* Corner crosshairs */}
      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 text-zinc-700 font-mono text-[10px] leading-none select-none">
        +
      </div>
      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 text-zinc-700 font-mono text-[10px] leading-none select-none">
        +
      </div>
      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 text-zinc-700 font-mono text-[10px] leading-none select-none">
        +
      </div>
      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 text-zinc-700 font-mono text-[10px] leading-none select-none">
        +
      </div>

      {/* Top Header Label */}
      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-6 pb-2 border-b border-zinc-900 select-none">
        <span>{label}</span>
        <span>{coords}</span>
      </div>

      {children}
    </div>
  );
};
