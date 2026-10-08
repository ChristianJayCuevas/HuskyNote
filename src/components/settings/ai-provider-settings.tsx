import React, { useState } from 'react';
import { Cpu, ExternalLink, KeyRound, MessageSquareCode, RefreshCw, Sparkles } from 'lucide-react';
import { useAI, type AIProviderId } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PageSection } from '../ui/page';
import { SettingsStatus, optionCardClass } from './settings-row';
import { CLAUDE_MODELS } from '../../services/ai/claude';
import { CodexSettings } from './codex-settings';

const PROVIDERS: { id: AIProviderId; name: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'ollama',
    name: 'Local AI (Ollama)',
    description: 'Runs on this computer. Your notes stay on your device.',
    icon: <Cpu className="size-4" />,
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic API with your own key. Faster and more capable on most machines.',
    icon: <Sparkles className="size-4" />,
  },
  {
    id: 'codex',
    name: 'ChatGPT (Codex)',
    description: 'Your ChatGPT plan through Codex on this computer. Sign in once, no API key.',
    icon: <MessageSquareCode className="size-4" />,
  },
];

/** Picks which AI answers summaries, chat, and document actions, and configures Claude or Codex. */
export const AIProviderSettings: React.FC = () => {
  const { provider, setProvider, hasClaudeApiKey, setClaudeApiKey, isConnected, isChecking, checkConnection, selectedModel, setSelectedModel } =
    useAI();
  const { addToast } = useWorkspace();
  const [keyInput, setKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setIsSavingKey(true);
    const ok = await setClaudeApiKey(keyInput);
    setIsSavingKey(false);
    setKeyInput('');
    addToast(ok ? 'Claude API key saved and verified.' : 'Claude rejected this API key. Check it and try again.', ok ? 'success' : 'error');
  };

  const handleRemoveKey = async () => {
    await setClaudeApiKey('');
    addToast('Claude API key removed from this device.', 'info');
  };

  const isClaude = provider === 'claude';

  return (
    <PageSection
      id="section-ai-provider"
      className="scroll-mt-6"
      title="AI Provider"
      description="Which AI writes meeting summaries, answers questions, and runs document actions"
      actions={<SettingsStatus tone={isConnected ? 'success' : 'muted'}>{isConnected ? 'Ready' : 'Not connected'}</SettingsStatus>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map((p) => {
          const active = provider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProvider(p.id)}
              className={optionCardClass}
            >
              <div className="flex w-full items-center gap-2 text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{p.icon}</span>
                <span>{p.name}</span>
                {active && (
                  <Badge variant="secondary" className="ml-auto">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
            </button>
          );
        })}
      </div>

      {isClaude && (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={hasClaudeApiKey ? undefined : 'claude-api-key'}>Claude API key</Label>
              {hasClaudeApiKey ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md bg-muted px-2.5 text-sm text-muted-foreground">
                    <KeyRound className="size-3.5" />
                    <span>Saved on this device</span>
                  </div>
                  <Button variant="outline" onClick={() => checkConnection()} disabled={isChecking}>
                    <RefreshCw className={cn(isChecking && 'animate-spin')} />
                    <span>Test</span>
                  </Button>
                  <Button variant="secondary" onClick={handleRemoveKey}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="claude-api-key"
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                    placeholder="sk-ant-..."
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 font-mono"
                  />
                  <Button variant="default" onClick={handleSaveKey} disabled={isSavingKey || !keyInput.trim()}>
                    {isSavingKey ? 'Verifying...' : 'Save Key'}
                  </Button>
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Create a key at{' '}
                <a
                  href="https://platform.claude.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2"
                >
                  platform.claude.com <ExternalLink className="size-3" />
                </a>
                . API usage is billed to your Anthropic account and is separate from a Claude Pro or Max subscription, which
                third-party apps cannot use. The key is stored only on this device and is left out of workspace backups.
              </p>
            </div>

            <div className="space-y-2">
              <div id="claude-model-label" className="text-sm font-medium text-foreground">
                Claude model
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-labelledby="claude-model-label">
                {CLAUDE_MODELS.map((m) => {
                  const active = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedModel(m.id)}
                      className={cn(optionCardClass, 'gap-1 p-3')}
                    >
                      <div className="text-sm font-medium text-foreground">{m.name}</div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              With Claude selected, the text you ask about (transcripts, notes, document excerpts) is sent to Anthropic to
              generate answers. Audio is still transcribed on this device, and everything stays stored locally.
            </p>
          </CardContent>
        </Card>
      )}

      {provider === 'codex' && <CodexSettings />}

      {provider === 'ollama' && <p className="text-xs text-muted-foreground">Configure the Ollama connection and models below.</p>}
    </PageSection>
  );
};
