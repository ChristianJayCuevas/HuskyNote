/**
 * Exports: GlobalMascotDock
 *
 * Bottom-right companion button (z-40) that expands into a small card. Hidden on the landing page
 * and in Focus mode. GlobalMascotDock({ onHide? }).
 */
import React, { useState } from 'react';
import { ArrowRight, Feather, X } from 'lucide-react';
import { HuskyHead } from '@/brand';
import { useWorkspace } from '../../context/workspace-context';
import { useAI } from '../../context/ai-context';
import { Button } from './button';
import { StatusDot } from './status-dot';

export const GlobalMascotDock: React.FC<{ onHide?: () => void }> = ({ onHide }) => {
  const { activeView, setActiveView } = useWorkspace();
  const { isConnected, selectedModel } = useAI();
  const [isExpanded, setIsExpanded] = useState(false);

  // Focus mode and the landing page have their own layout
  if (activeView === 'zen' || activeView === 'landing') return null;

  return (
    <div className="fixed bottom-3 right-3 z-40">
      {isExpanded ? (
        <div className="w-80 max-w-[calc(100vw-1.5rem)] space-y-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot tone={isConnected ? 'success' : 'muted'} />
              <span className="font-semibold">HuskyNote Companion</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsExpanded(false)}
              className="-mr-1.5 text-muted-foreground"
              title="Minimize companion"
              aria-label="Minimize companion"
            >
              <X />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <HuskyHead animated className="size-12 shrink-0" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm">Your notes and meetings are saved on this device.</p>
              <p className="truncate text-xs text-muted-foreground">{isConnected ? `AI: ${selectedModel}` : 'AI: Offline'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Button type="button" variant="ghost" size="sm" className="justify-between" onClick={() => setActiveView('zen')}>
              <span className="flex items-center gap-2">
                <Feather className="text-muted-foreground" />
                Focus mode
              </span>
              <ArrowRight className="text-muted-foreground" />
            </Button>
            {onHide && (
              <Button type="button" variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={onHide}>
                Hide this button
              </Button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex size-11 items-center justify-center rounded-full border bg-background shadow-md transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          title="Husky companion"
          aria-label="Open Husky companion"
        >
          <HuskyHead className="size-7" />
        </button>
      )}
    </div>
  );
};
