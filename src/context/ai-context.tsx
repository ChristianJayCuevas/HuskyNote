import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { OllamaModel, AppSettings } from '../types';
import { ollama, type PullProgressUpdate } from '../services/ai/ollama';
import { claude, DEFAULT_CLAUDE_MODEL } from '../services/ai/claude';
import { codex, codexModelsAsOptions, type CodexStatus } from '../services/ai/codex';
import { claudeSubscription, claudeSubscriptionModelsAsOptions, isClaudeSubscriptionReady, type ClaudeSubscriptionStatus } from '../services/ai/claude-subscription';
import { setActiveProvider, type AIProviderId } from '../services/ai/active-provider';
import { db, DEFAULT_SETTINGS } from '../db';

export type { PullProgressUpdate, AIProviderId, CodexStatus };

interface AIContextType {
  /** The active provider can answer requests (local service, verified API key, or subscription sign-in) */
  isConnected: boolean;
  isChecking: boolean;
  /** Models of the active provider */
  models: OllamaModel[];
  /** Selected model of the active provider */
  selectedModel: string;
  baseUrl: string;
  provider: AIProviderId;
  setProvider: (provider: AIProviderId) => Promise<void>;
  hasClaudeApiKey: boolean;
  /** Saves (or clears, with '') the Claude API key and verifies it */
  setClaudeApiKey: (apiKey: string) => Promise<boolean>;
  /** Codex on this computer: installed, signed in, models (null until first checked) */
  codexStatus: CodexStatus | null;
  /** Re-reads the Codex status */
  refreshCodexStatus: () => Promise<CodexStatus>;
  /** Opens ChatGPT sign-in through Codex and waits until it finishes (true when signed in) */
  signInWithChatGPT: (onUrl?: (url: string) => void) => Promise<boolean>;
  claudeSubscriptionStatus: ClaudeSubscriptionStatus | null;
  refreshClaudeSubscriptionStatus: () => Promise<ClaudeSubscriptionStatus>;
  signInWithClaude: (onUrl?: (url: string) => void) => Promise<boolean>;
  /** Local Ollama status, regardless of the active provider */
  isOllamaConnected: boolean;
  setSelectedModel: (model: string) => Promise<void>;
  setBaseUrl: (url: string) => Promise<void>;
  checkConnection: () => Promise<boolean>;
  startOllamaService: () => Promise<{ success: boolean; message: string }>;
  pullModel: (
    name: string,
    onProgress?: (progress: PullProgressUpdate) => void,
    signal?: AbortSignal
  ) => Promise<{ success: boolean; message: string }>;
}

const AIContext = createContext<AIContextType | null>(null);

const STORAGE_KEY_SELECTED_MODEL = 'huskynote_user_selected_model';

async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const existing = await db.settings.get('current');
  if (existing) await db.settings.update('current', patch);
  else await db.settings.put({ ...DEFAULT_SETTINGS, ...patch });
}

export const AIProviderContext: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOllamaConnected, setIsOllamaConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  // Synchronous initial load from localStorage ensures zero-flicker and instant persistence across reloads
  const [ollamaModel, setOllamaModelState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_SELECTED_MODEL) || '';
    }
    return '';
  });
  const [baseUrl, setBaseUrlState] = useState<string>('http://localhost:11434');

  const [provider, setProviderState] = useState<AIProviderId>('ollama');
  const [claudeModel, setClaudeModelState] = useState<string>(DEFAULT_CLAUDE_MODEL);
  const [claudeModels, setClaudeModels] = useState<OllamaModel[]>([]);
  const [hasClaudeApiKey, setHasClaudeApiKey] = useState<boolean>(false);
  const [isClaudeReady, setIsClaudeReady] = useState<boolean>(false);
  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null);
  const [codexModel, setCodexModelState] = useState<string>('');
  const [claudeSubscriptionStatus, setClaudeSubscriptionStatus] = useState<ClaudeSubscriptionStatus | null>(null);
  const [claudeSubscriptionModel, setClaudeSubscriptionModelState] = useState('default');

  useEffect(() => {
    claude.getModels().then(setClaudeModels);
  }, []);

  const checkClaude = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const ok = await claude.isAvailable();
      setIsClaudeReady(ok);
      return ok;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const refreshCodexStatus = useCallback(async (): Promise<CodexStatus> => {
    setIsChecking(true);
    try {
      const status = await codex.getStatus();
      setCodexStatus(status);
      return status;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const signInWithChatGPT = useCallback(async (onUrl?: (url: string) => void): Promise<boolean> => {
    const { url } = await codex.startLogin();
    if (url) onUrl?.(url);
    // Codex finishes sign-in in the browser; watch until it reports signed in or gives up
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const status = await codex.getStatus();
      setCodexStatus(status);
      if (status.loginUrl) onUrl?.(status.loginUrl);
      if (status.loggedIn) return true;
      if (!status.loginInProgress) return false;
    }
    return false;
  }, []);

  const refreshClaudeSubscriptionStatus = useCallback(async (): Promise<ClaudeSubscriptionStatus> => {
    setIsChecking(true);
    try {
      const status = await claudeSubscription.getStatus();
      setClaudeSubscriptionStatus(status);
      return status;
    } finally { setIsChecking(false); }
  }, []);

  const signInWithClaude = useCallback(async (onUrl?: (url: string) => void): Promise<boolean> => {
    const { url } = await claudeSubscription.startLogin();
    if (url) onUrl?.(url);
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const status = await claudeSubscription.getStatus();
      setClaudeSubscriptionStatus(status);
      if (status.loginUrl) onUrl?.(status.loginUrl);
      // An existing Console login must not be mistaken for a successful subscription sign-in.
      if (!status.loginInProgress) return isClaudeSubscriptionReady(status);
    }
    return false;
  }, []);

  // Load persisted settings on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const settings = await db.settings.get('current');
        const localSaved =
          typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SELECTED_MODEL) : null;
        const modelToUse = localSaved || settings?.selectedModel || '';

        if (modelToUse && isMounted) {
          setOllamaModelState(modelToUse);
          if (typeof window !== 'undefined' && !localSaved) {
            localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, modelToUse);
          }
        }

        if (settings && isMounted) {
          setBaseUrlState(settings.ollamaBaseUrl || 'http://localhost:11434');
          ollama.setBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');

          const savedProvider: AIProviderId =
            settings.aiProvider === 'claude' || settings.aiProvider === 'codex' || settings.aiProvider === 'claude-subscription' ? settings.aiProvider : 'ollama';
          setProviderState(savedProvider);
          setActiveProvider(savedProvider);
          if (settings.claudeModel) setClaudeModelState(settings.claudeModel);
          if (settings.codexModel) setCodexModelState(settings.codexModel);
          if (savedProvider === 'codex') refreshCodexStatus();
          if (settings.claudeSubscriptionModel) setClaudeSubscriptionModelState(settings.claudeSubscriptionModel);
          if (savedProvider === 'claude-subscription') refreshClaudeSubscriptionStatus();
          if (settings.claudeApiKey) {
            claude.setApiKey(settings.claudeApiKey);
            setHasClaudeApiKey(true);
            checkClaude();
          }
        }
      } catch (err) {
        console.warn('[HuskyNote] Could not read settings:', err);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [checkClaude, refreshCodexStatus, refreshClaudeSubscriptionStatus]);

  const checkOllama = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const available = await ollama.isAvailable();
      setIsOllamaConnected(available);
      if (available) {
        const fetchedModels = await ollama.getModels();
        setOllamaModels(fetchedModels);

        // Auto-select first model ONLY if the user has NEVER selected any model anywhere
        if (fetchedModels.length > 0) {
          setOllamaModelState((curr) => {
            const savedChoice =
              typeof window !== 'undefined'
                ? localStorage.getItem(STORAGE_KEY_SELECTED_MODEL)
                : null;

            // If user already has an active model choice, NEVER switch or overwrite it
            if (curr && curr.trim()) {
              return curr;
            }
            if (savedChoice && savedChoice.trim()) {
              return savedChoice;
            }

            // Fresh install with no user choice: initialize with first available model
            const defaultPick = fetchedModels[0].name || fetchedModels[0].model;
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, defaultPick);
            }
            saveSettings({ selectedModel: defaultPick }).catch(() => {});
            return defaultPick;
          });
        }
      } else {
        setOllamaModels([]);
      }
      return available;
    } catch {
      setIsOllamaConnected(false);
      setOllamaModels([]);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (provider === 'claude-subscription') return isClaudeSubscriptionReady(await refreshClaudeSubscriptionStatus());
    if (provider === 'claude') return checkClaude();
    if (provider === 'codex') {
      const status = await refreshCodexStatus();
      return status.installed && status.loggedIn;
    }
    return checkOllama();
  }, [provider, checkClaude, checkOllama, refreshCodexStatus, refreshClaudeSubscriptionStatus]);

  // Poll the local Ollama service every 12 seconds (Claude is verified only when its key changes)
  useEffect(() => {
    checkOllama();
    const interval = setInterval(checkOllama, 12000);
    return () => clearInterval(interval);
  }, [checkOllama]);

  const setProvider = async (next: AIProviderId) => {
    setProviderState(next);
    setActiveProvider(next);
    try {
      await saveSettings({ aiProvider: next });
    } catch (err) {
      console.warn('[HuskyNote] Failed to persist AI provider:', err);
    }
    if (next === 'claude' && claude.hasApiKey()) checkClaude();
    if (next === 'codex') refreshCodexStatus();
    if (next === 'claude-subscription') refreshClaudeSubscriptionStatus();
  };

  const setClaudeApiKey = async (apiKey: string): Promise<boolean> => {
    const key = apiKey.trim();
    claude.setApiKey(key);
    setHasClaudeApiKey(!!key);
    try {
      await saveSettings({ claudeApiKey: key || undefined });
    } catch (err) {
      console.warn('[HuskyNote] Failed to persist Claude API key:', err);
    }
    if (!key) {
      setIsClaudeReady(false);
      return false;
    }
    return checkClaude();
  };

  const setSelectedModel = async (model: string) => {
    if (!model || !model.trim()) return;
    const cleanModel = model.trim();

    if (provider === 'claude-subscription') {
      setClaudeSubscriptionModelState(cleanModel);
      try { await saveSettings({ claudeSubscriptionModel: cleanModel }); }
      catch (err) { console.warn('[HuskyNote] Failed to persist Claude subscription model:', err); }
      return;
    }

    if (provider === 'codex') {
      setCodexModelState(cleanModel);
      try {
        await saveSettings({ codexModel: cleanModel });
      } catch (err) {
        console.warn('[HuskyNote] Failed to persist Codex model:', err);
      }
      return;
    }

    if (provider === 'claude') {
      setClaudeModelState(cleanModel);
      try {
        await saveSettings({ claudeModel: cleanModel });
      } catch (err) {
        console.warn('[HuskyNote] Failed to persist Claude model:', err);
      }
      return;
    }

    setOllamaModelState(cleanModel);

    // Save to localStorage immediately (synchronous, immune to DB delays)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, cleanModel);
    }

    // Persist to Dexie IndexedDB
    try {
      await saveSettings({ selectedModel: cleanModel });
    } catch (err) {
      console.warn('[HuskyNote] Failed to persist selected model:', err);
    }
  };

  const setBaseUrl = async (url: string) => {
    setBaseUrlState(url);
    ollama.setBaseUrl(url);
    try {
      await db.settings.update('current', { ollamaBaseUrl: url });
      await checkOllama();
    } catch (err) {
      console.warn('[HuskyNote] Failed to persist base URL:', err);
    }
  };

  const startOllamaService = async (): Promise<{ success: boolean; message: string }> => {
    setIsChecking(true);
    try {
      // First attempt to invoke companion on http://localhost:8765/ollama/start
      const res = await fetch('http://localhost:8765/ollama/start', {
        method: 'POST',
      }).catch(() => null);

      if (res && res.ok) {
        // Wait 3 seconds and check
        await new Promise((r) => setTimeout(r, 3000));
        const ok = await checkOllama();
        return {
          success: ok,
          message: ok
            ? 'Ollama service successfully started by local companion.'
            : 'Ollama service launched, waiting for endpoint to respond...',
        };
      }

      // If companion is not running, ping standard endpoint again
      const directOk = await checkOllama();
      if (directOk) {
        return { success: true, message: 'Connected to Ollama service.' };
      }

      return {
        success: false,
        message:
          'Local companion not running. Execute "./start.sh" or "scripts/setup-ollama.sh" in your terminal to start Ollama with CORS enabled.',
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to start Ollama service.' };
    } finally {
      setIsChecking(false);
    }
  };

  const pullModel = async (
    name: string,
    onProgress?: (progress: PullProgressUpdate) => void,
    signal?: AbortSignal
  ): Promise<{ success: boolean; message: string }> => {
    const result = await ollama.pullModel(name, onProgress, signal);
    if (result.success) {
      await checkOllama();
    }
    return result;
  };

  const codexModels = useMemo(() => codexStatus?.models ?? [], [codexStatus]);
  const codexModelOptions = useMemo(() => codexModelsAsOptions(codexModels), [codexModels]);
  // A saved model Codex no longer lists falls back to its first (default) model
  const activeCodexModel = codexModels.some((m) => m.id === codexModel) ? codexModel : codexModels[0]?.id ?? '';
  const isCodexReady = Boolean(codexStatus?.installed && codexStatus.loggedIn);
  const subscriptionModels = useMemo(() => claudeSubscriptionStatus?.models ?? [], [claudeSubscriptionStatus]);
  const subscriptionModelOptions = useMemo(() => claudeSubscriptionModelsAsOptions(subscriptionModels), [subscriptionModels]);
  const activeSubscriptionModel = subscriptionModels.some((m) => m.id === claudeSubscriptionModel) ? claudeSubscriptionModel : 'default';

  return (
    <AIContext.Provider
      value={{
        isConnected: provider === 'claude-subscription' ? isClaudeSubscriptionReady(claudeSubscriptionStatus) : provider === 'claude' ? isClaudeReady : provider === 'codex' ? isCodexReady : isOllamaConnected,
        isChecking,
        models: provider === 'claude-subscription' ? subscriptionModelOptions : provider === 'claude' ? claudeModels : provider === 'codex' ? codexModelOptions : ollamaModels,
        selectedModel: provider === 'claude-subscription' ? activeSubscriptionModel : provider === 'claude' ? claudeModel : provider === 'codex' ? activeCodexModel : ollamaModel,
        baseUrl,
        provider,
        setProvider,
        hasClaudeApiKey,
        setClaudeApiKey,
        codexStatus,
        refreshCodexStatus,
        signInWithChatGPT,
        claudeSubscriptionStatus,
        refreshClaudeSubscriptionStatus,
        signInWithClaude,
        isOllamaConnected,
        setSelectedModel,
        setBaseUrl,
        checkConnection,
        startOllamaService,
        pullModel,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export function useAI(): AIContextType {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProviderContext');
  }
  return context;
}
