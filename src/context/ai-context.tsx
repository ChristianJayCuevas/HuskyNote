import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { OllamaModel } from '../types';
import { ollama, type PullProgressUpdate } from '../services/ai/ollama';
import { db, DEFAULT_SETTINGS } from '../db';

export type { PullProgressUpdate };

interface AIContextType {
  isConnected: boolean;
  isChecking: boolean;
  models: OllamaModel[];
  selectedModel: string;
  baseUrl: string;
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

export const AIProviderContext: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [models, setModels] = useState<OllamaModel[]>([]);
  // Synchronous initial load from localStorage ensures zero-flicker and instant persistence across reloads
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_SELECTED_MODEL) || '';
    }
    return '';
  });
  const [baseUrl, setBaseUrlState] = useState<string>('http://localhost:11434');

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
          setSelectedModelState(modelToUse);
          if (typeof window !== 'undefined' && !localSaved) {
            localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, modelToUse);
          }
        }

        if (settings && isMounted) {
          setBaseUrlState(settings.ollamaBaseUrl || 'http://localhost:11434');
          ollama.setBaseUrl(settings.ollamaBaseUrl || 'http://localhost:11434');
        }
      } catch (err) {
        console.warn('[HuskyNote] Could not read settings:', err);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const available = await ollama.isAvailable();
      setIsConnected(available);
      if (available) {
        const fetchedModels = await ollama.getModels();
        setModels(fetchedModels);

        // Auto-select first model ONLY if the user has NEVER selected any model anywhere
        if (fetchedModels.length > 0) {
          setSelectedModelState((curr) => {
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
            db.settings.get('current').then((existing) => {
              if (existing) {
                db.settings.update('current', { selectedModel: defaultPick }).catch(() => {});
              } else {
                db.settings.put({ ...DEFAULT_SETTINGS, selectedModel: defaultPick }).catch(() => {});
              }
            }).catch(() => {});
            return defaultPick;
          });
        }
      } else {
        setModels([]);
      }
      return available;
    } catch {
      setIsConnected(false);
      setModels([]);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Poll connection every 12 seconds
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const setSelectedModel = async (model: string) => {
    if (!model || !model.trim()) return;
    const cleanModel = model.trim();
    setSelectedModelState(cleanModel);

    // Save to localStorage immediately (synchronous, immune to DB delays)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, cleanModel);
    }

    // Persist to Dexie IndexedDB
    try {
      const existing = await db.settings.get('current');
      if (existing) {
        await db.settings.update('current', { selectedModel: cleanModel });
      } else {
        await db.settings.put({ ...DEFAULT_SETTINGS, selectedModel: cleanModel });
      }
    } catch (err) {
      console.warn('[HuskyNote] Failed to persist selected model:', err);
    }
  };

  const setBaseUrl = async (url: string) => {
    setBaseUrlState(url);
    ollama.setBaseUrl(url);
    try {
      await db.settings.update('current', { ollamaBaseUrl: url });
      await checkConnection();
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
        const ok = await checkConnection();
        return {
          success: ok,
          message: ok
            ? 'Ollama service successfully started by local companion.'
            : 'Ollama service launched, waiting for endpoint to respond...',
        };
      }

      // If companion is not running, ping standard endpoint again
      const directOk = await checkConnection();
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
      await checkConnection();
    }
    return result;
  };

  return (
    <AIContext.Provider
      value={{
        isConnected,
        isChecking,
        models,
        selectedModel,
        baseUrl,
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
