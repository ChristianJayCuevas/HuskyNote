/**
 * Exports: AiStatusBadge, AiStatusBadgeProps
 *
 * AiStatusBadge({ variant: 'inline' | 'pill', onClick?, className }) reads useAI():
 * status dot (success when connected, pulsing while checking), provider name (Ollama / Claude)
 * and the truncated model, or "Not connected". With onClick it renders a <button>.
 * inline: borderless row for the sidebar footer. pill: h-7 rounded-full border chip (e.g. AI Workspace header).
 */
import * as React from 'react';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES } from '../../services/ai/active-provider';
import { cn } from '@/lib/utils';
import { StatusDot } from './status-dot';

export interface AiStatusBadgeProps {
  variant?: 'inline' | 'pill';
  onClick?: () => void;
  className?: string;
}

function AiStatusBadge({ variant = 'inline', onClick, className }: AiStatusBadgeProps) {
  const { isConnected, isChecking, selectedModel, provider } = useAI();
  const providerLabel = PROVIDER_NAMES[provider];
  const detail = isConnected ? selectedModel || 'Ready' : isChecking ? 'Checking...' : 'Not connected';
  const summary = `${providerLabel}: ${detail}`;

  const content = (
    <>
      <StatusDot tone={isConnected ? 'success' : 'muted'} pulse={isChecking && !isConnected} />
      <span className="shrink-0 font-medium text-foreground">{providerLabel}</span>
      <span className="min-w-0 truncate text-muted-foreground">{detail}</span>
    </>
  );

  const classes = cn(
    'flex min-w-0 items-center gap-2 text-xs',
    variant === 'pill' && 'inline-flex h-7 w-fit max-w-full rounded-full border px-2.5',
    onClick &&
      'cursor-pointer rounded-md text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    onClick && variant === 'pill' && 'rounded-full',
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={summary} className={classes}>
        {content}
      </button>
    );
  }
  return (
    <div title={summary} className={classes}>
      {content}
    </div>
  );
}

export { AiStatusBadge };
