import React, { useState } from 'react';
import { Cpu, ExternalLink, KeyRound, RefreshCw, Sparkles } from 'lucide-react';
import { useAI, type AIProviderId } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import { CLAUDE_MODELS } from '../../services/ai/claude';

const PROVIDERS: { id: AIProviderId; name: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'ollama',
    name: 'Local AI (Ollama)',
    description: 'Runs on this computer. Nothing leaves your device.',
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic API with your own key. Faster and more capable on most machines.',
    icon: <Sparkles className="w-4 h-4" />,
  },
];

/** Picks which AI answers summaries, chat, and document actions, and configures Claude. */
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
    <div id="section-ai-provider" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-5 scroll-mt-28 shadow-xs dark:shadow-xl transition-colors duration-500">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">AI Provider</h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Which AI writes meeting summaries, answers questions, and runs document actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-slate-900 dark:bg-white animate-pulse' : 'bg-slate-400 dark:bg-zinc-600'}`} />
          <span className="text-xs font-bold text-slate-950 dark:text-white">{isConnected ? 'Ready' : 'Not connected'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="AI provider">
        {PROVIDERS.map((p) => {
          const active = provider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProvider(p.id)}
              className={`text-left p-4 rounded-lg border transition-colors ${
                active
                  ? 'border-slate-900 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-900'
                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-950 dark:text-zinc-100">
                {p.icon}
                <span>{p.name}</span>
                {active && <span className="ml-auto text-[10px] font-mono uppercase tracking-wider">Active</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">{p.description}</p>
            </button>
          );
        })}
      </div>

      {isClaude && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Claude API key</label>
            {hasClaudeApiKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-md px-3 py-2 text-xs font-mono text-slate-700 dark:text-zinc-300">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Saved on this device</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => checkConnection()} disabled={isChecking}>
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>Test</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={handleRemoveKey}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-slate-400 dark:focus:border-zinc-700"
                />
                <Button size="sm" variant="primary" onClick={handleSaveKey} disabled={isSavingKey || !keyInput.trim()}>
                  {isSavingKey ? 'Verifying...' : 'Save Key'}
                </Button>
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed">
              Create a key at{' '}
              <a
                href="https://platform.claude.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline hover:text-slate-900 dark:hover:text-zinc-200"
              >
                platform.claude.com <ExternalLink className="w-3 h-3" />
              </a>
              . API usage is billed to your Anthropic account and is separate from a Claude Pro or Max subscription, which
              third-party apps cannot use. The key is stored only on this device and is left out of workspace backups.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Claude model</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CLAUDE_MODELS.map((m) => {
                const active = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-slate-900 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-900'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-950 dark:text-zinc-100">{m.name}</div>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed border-t border-slate-200 dark:border-zinc-850 pt-3">
            With Claude selected, the text you ask about (transcripts, notes, document excerpts) is sent to Anthropic to
            generate answers. Audio is still transcribed on this device, and everything stays stored locally.
          </p>
        </div>
      )}

      {!isClaude && (
        <p className="text-[11px] text-slate-500 dark:text-zinc-500">
          Configure the Ollama connection and models below.
        </p>
      )}
    </div>
  );
};
