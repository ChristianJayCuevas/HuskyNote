import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAI, type PullProgressUpdate } from '../context/ai-context';
import { useWorkspace } from '../context/workspace-context';
import { db, exportWorkspaceToJson, importWorkspaceFromJson } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../components/ui/button';
import { downloadJsonFile } from '../services/export/json';
import {
  COMPATIBLE_MODELS,
  MODEL_TIERS,
  type ModelTier,
  type CompatibleModel,
  detectSystemHardware,
  isModelInstalled,
  getInstalledOllamaModel,
  findMatchingCompatibleModel,
} from '../services/ai/compatible-models';
import {
  getGoogleCalendarConfig,
  saveGoogleCalendarConfig,
  disconnectGoogleCalendar,
  authenticateGoogleCalendar,
} from '../services/calendar/google-calendar';
import type { GoogleCalendarConfig } from '../types';
import {
  Cpu,
  Database,
  Download,
  Upload,
  RefreshCw,
  Power,
  Shield,
  CheckCircle,
  AlertCircle,
  Server,
  Trash2,
  Puzzle,
  Copy,
  Check,
  Zap,
  Sparkles,
  Layers,
  ArrowDownCircle,
  XCircle,
  CheckCheck,
  Loader2,
  HardDrive,
  Calendar,
  Key,
  ExternalLink,
  Languages,
} from 'lucide-react';
import { ChromeIcon } from '../components/ui/chrome-icon';
import { SUPPORTED_LANGUAGES } from '../services/ai/translation';
import { AIProviderSettings } from '../components/settings/ai-provider-settings';
import { TranscriptionSettings } from '../components/settings/transcription-settings';

export const SettingsView: React.FC = () => {
  const {
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
    provider,
  } = useAI();
  const { addToast, setIsExtensionModalOpen } = useWorkspace();

  const [inputUrl, setInputUrl] = useState(baseUrl);
  const [companionStatus, setCompanionStatus] = useState<string>('checking');
  const importFileRef = useRef<HTMLInputElement>(null);

  // Google Calendar Integration State
  const [gcalConfig, setGcalConfig] = useState<GoogleCalendarConfig>(() => getGoogleCalendarConfig());
  const [customClientId, setCustomClientId] = useState(gcalConfig.clientId || '');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [copiedRedirectOrigin, setCopiedRedirectOrigin] = useState(false);

  // System Hardware Detection & Model Recommendation
  const hardwareProfile = useMemo(() => detectSystemHardware(), []);
  const [activeTierFilter, setActiveTierFilter] = useState<ModelTier | 'all'>('all');
  const [pullingModelId, setPullingModelId] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<PullProgressUpdate | null>(null);
  const [customModelTag, setCustomModelTag] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // App Settings for Speech Recognition & Meeting Languages
  const appSettings = useLiveQuery(() => db.settings.get('current'));
  const currentSpeechLang = appSettings?.speechLanguage || 'auto';

  const handleUpdateSpeechLanguage = async (newLang: string) => {
    try {
      await db.settings.update('current', { speechLanguage: newLang });
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.bcp47 === newLang);
      addToast(`Default speech recognition language set to ${langObj?.name || newLang}.`, 'success');
    } catch {
      addToast('Failed to update speech language preference.', 'error');
    }
  };

  const handlePullModel = async (modelTag: string, modelDisplayName?: string) => {
    if (!isConnected) {
      addToast('Ollama is offline. Please start the Ollama service before pulling models.', 'warning');
      return;
    }

    const tag = modelTag.trim();
    if (!tag) return;

    const displayName = modelDisplayName || tag;
    setPullingModelId(tag);
    setPullProgress({ status: 'Connecting to Ollama model registry...' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await pullModel(
        tag,
        (progress) => {
          setPullProgress(progress);
        },
        controller.signal
      );

      if (result.success) {
        addToast(`Model "${displayName}" is ready! Selected as active model.`, 'success');
        await setSelectedModel(tag);
      } else {
        addToast(result.message, 'error');
      }
    } catch (err: any) {
      addToast(`Download failed: ${err?.message || 'Network error'}`, 'error');
    } finally {
      setPullingModelId(null);
      setPullProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelPull = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setPullingModelId(null);
      setPullProgress(null);
      addToast('Model download cancelled.', 'info');
    }
  };

  // Find current model details
  const activeCompatible = useMemo(() => {
    return findMatchingCompatibleModel(selectedModel);
  }, [selectedModel]);

  const isActiveModelInstalled = useMemo(() => {
    if (!selectedModel) return false;
    const direct = models.some((m) => m.name === selectedModel || m.model === selectedModel);
    if (direct) return true;
    if (activeCompatible) {
      return isModelInstalled(activeCompatible, models);
    }
    return false;
  }, [selectedModel, models, activeCompatible]);

  const recommendedModel = useMemo(() => {
    return (
      COMPATIBLE_MODELS.find((m) => m.id === hardwareProfile.recommendedModelId) ||
      COMPATIBLE_MODELS.find((m) => m.isAppDefault) ||
      COMPATIBLE_MODELS[3]
    );
  }, [hardwareProfile.recommendedModelId]);

  const isRecommendedInstalled = useMemo(() => {
    return isModelInstalled(recommendedModel, models);
  }, [recommendedModel, models]);

  const resolvedSelectedValue = useMemo(() => {
    if (!selectedModel) return hardwareProfile.recommendedModelId;
    if (COMPATIBLE_MODELS.some((m) => m.id === selectedModel)) return selectedModel;
    const match = findMatchingCompatibleModel(selectedModel);
    if (match) return match.id;
    return selectedModel;
  }, [selectedModel, hardwareProfile.recommendedModelId]);

  const handleSelectModel = async (modelId: string) => {
    const targetComp = COMPATIBLE_MODELS.find((m) => m.id === modelId);
    if (targetComp) {
      const installedMatch = getInstalledOllamaModel(targetComp, models);
      if (installedMatch) {
        const targetName = installedMatch.name || installedMatch.model;
        await setSelectedModel(targetName);
        addToast(`Active model set to: ${targetComp.name}`, 'success');
        return;
      }
      await setSelectedModel(modelId);
      addToast(`Active model set to: ${targetComp.name}`, 'success');
      return;
    }
    await setSelectedModel(modelId);
    addToast(`Active model set to: ${modelId}`, 'success');
  };

  // Storage metrics
  const notesCount = useLiveQuery(() => db.notes.count(), []) ?? 0;
  const meetingsCount = useLiveQuery(() => db.meetings.count(), []) ?? 0;
  const documentsCount = useLiveQuery(() => db.documents.count(), []) ?? 0;
  const manualsCount = useLiveQuery(() => db.manuals.count(), []) ?? 0;
  const blobsCount = useLiveQuery(() => db.blobs.count(), []) ?? 0;

  // Check companion status
  useEffect(() => {
    fetch('http://localhost:8765/health')
      .then((r) => r.json())
      .then(() => setCompanionStatus('online'))
      .catch(() => setCompanionStatus('offline'));
  }, []);

  const handleSaveUrl = async () => {
    await setBaseUrl(inputUrl);
    addToast('Ollama base URL updated.', 'info');
  };

  const handleExport = async () => {
    try {
      const json = await exportWorkspaceToJson();
      const dateStr = new Date().toISOString().split('T')[0];
      downloadJsonFile(`huskynote_workspace_${dateStr}.json`, json);
      addToast('Exported complete workspace backup to JSON.', 'success');
    } catch {
      addToast('Failed to export workspace.', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importWorkspaceFromJson(text);
      if (result.success) {
        addToast(result.message, 'success');
      } else {
        addToast(result.message, 'error');
      }
    } catch (err: any) {
      addToast(`Import failed: ${err?.message}`, 'error');
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleClearDatabase = async () => {
    if (confirm('CAUTION: Are you sure you want to erase all notes, meetings, and documents? This cannot be undone.')) {
      await db.notes.clear();
      await db.meetings.clear();
      await db.documents.clear();
      await db.manuals.clear();
      await db.blobs.clear();
      addToast('Local workspace data cleared.', 'info');
    }
  };

  const handleSaveGoogleClientId = () => {
    const updated = saveGoogleCalendarConfig({ clientId: customClientId.trim() || undefined });
    setGcalConfig(updated);
    addToast(customClientId.trim() ? 'Google Client ID saved.' : 'Cleared custom Client ID.', 'info');
  };

  const handleConnectGoogle = async () => {
    const effectiveId = customClientId.trim() || gcalConfig.clientId;
    if (!effectiveId) {
      addToast('Please enter your Google OAuth Client ID first.', 'warning');
      return;
    }
    setIsConnectingGoogle(true);
    try {
      const res = await authenticateGoogleCalendar(effectiveId);
      setGcalConfig(getGoogleCalendarConfig());
      if (res.success) {
        addToast(`Connected to Google Calendar (${res.userEmail}).`, 'success');
      } else {
        addToast(res.error || 'Google authentication was cancelled.', 'warning');
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = () => {
    disconnectGoogleCalendar();
    setGcalConfig(getGoogleCalendarConfig());
    addToast('Disconnected Google Calendar.', 'info');
  };

  const copyOriginToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedRedirectOrigin(true);
      setTimeout(() => setCopiedRedirectOrigin(false), 2000);
      addToast(`Copied origin (${window.location.origin}) to clipboard.`, 'info');
    }
  };

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const copyToClipboard = (text: string, type: 'url' | 'path') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      addToast('Copied "chrome://extensions" to clipboard.', 'info');
    } else {
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
      addToast('Copied extension folder path to clipboard.', 'info');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-canvas text-slate-900 dark:text-white p-8 overflow-y-auto max-w-4xl mx-auto w-full select-none transition-colors duration-500 font-sans">
      {/* Settings Header & Quick Jump Navigation (scrolls with the page) */}
      <div className="pb-4 pt-2 mb-8 border-b border-slate-200 dark:border-zinc-800 transition-colors duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">Settings</h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
              Configure local AI connectivity, install browser companions, review client-side storage, and manage workspace archives.
            </p>
          </div>
        </div>

        {/* Quick Jump Sub-Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => document.getElementById('section-ai-provider')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap text-xs cursor-pointer shadow-xs font-medium"
          >
            AI Engine
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('section-models')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap text-xs cursor-pointer shadow-xs font-medium"
          >
            Models Catalog
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('section-google-calendar')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap text-xs cursor-pointer shadow-xs font-medium"
          >
            Google Calendar
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('section-companion')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap text-xs cursor-pointer shadow-xs font-medium"
          >
            <ChromeIcon className="w-3.5 h-3.5" />
            <span>Chrome Extension</span>
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('section-storage')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-3 py-1 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap text-xs cursor-pointer shadow-xs font-medium"
          >
            Storage & Backup
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <AIProviderSettings />

        {/* Local AI / Ollama Configuration */}
        {provider === 'ollama' && (
        <div id="section-ai" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-5 scroll-mt-6 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-4">
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Local AI (Ollama)</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">Direct connection to your local AI engine</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-slate-900 dark:bg-white animate-pulse' : 'bg-slate-400 dark:bg-zinc-600'
                }`}
              />
              <span className="text-xs font-bold text-slate-950 dark:text-white">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Service URL & Actions */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-zinc-300">Ollama API Base URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 bg-zinc-900 border dark:border-zinc-850 rounded-md px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-700"
              />
              <Button size="sm" variant="secondary" onClick={handleSaveUrl}>
                Save URL
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => checkConnection()}
                disabled={isChecking}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </Button>
            </div>
          </div>

          {/* Automated Setup Trigger if Disconnected */}
          {!isConnected && (
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-xs text-zinc-200 mb-1">
                  Automated Local AI Setup
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ollama is currently unreachable on {baseUrl}. You can start Ollama automatically
                  with CORS enabled, or run <code>./start.sh</code> in your terminal.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  const res = await startOllamaService();
                  addToast(res.message, res.success ? 'success' : 'warning');
                }}
              >
                <Power className="w-3.5 h-3.5" />
                <span>Start Service</span>
              </Button>
            </div>
          )}

          {/* Hardware Diagnostic & Smart Recommendation Banner */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white">
                  <Cpu className="w-4 h-4 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-950 dark:text-zinc-100 flex items-center gap-2">
                    <span>System Hardware Profile</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 font-mono font-bold">
                      {hardwareProfile.cpuCores} Cores • ~{hardwareProfile.memoryEstimateGb}GB Profile
                    </span>
                    {hardwareProfile.isAppleSilicon && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-200 font-mono font-semibold">
                        Apple Silicon
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                    GPU/Engine: <span className="font-mono text-slate-800 dark:text-zinc-300">{hardwareProfile.gpuRenderer}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <div className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-950 dark:text-white text-[11px] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                  <span>{hardwareProfile.recommendationTitle}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 dark:text-zinc-300">
              <p className="leading-relaxed text-slate-600 dark:text-zinc-400 max-w-2xl font-medium">
                {hardwareProfile.recommendationReason}
              </p>
              <div className="shrink-0 flex items-center gap-2">
                {!isRecommendedInstalled ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold shadow-sm"
                    onClick={() => handlePullModel(recommendedModel.id, recommendedModel.name)}
                    disabled={pullingModelId !== null}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Recommended ({recommendedModel.downloadSize})</span>
                  </Button>
                ) : selectedModel !== recommendedModel.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 font-semibold"
                    onClick={() => handleSelectModel(recommendedModel.id)}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Use Recommended</span>
                  </Button>
                ) : (
                  <span className="text-[11px] font-bold text-slate-950 dark:text-white flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                    Recommended Model Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Model Selection (Compatible Models Only, Ranked from Min to Higher) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-950 dark:text-zinc-200">
                Active Model (Compatible with HuskyNote)
              </label>
              <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                {models.length} model(s) installed on Ollama
              </span>
            </div>

            <select
              value={resolvedSelectedValue}
              onChange={(e) => handleSelectModel(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-slate-950 dark:text-zinc-100 font-medium focus:outline-none focus:border-slate-500 dark:focus:border-zinc-600 transition-colors"
            >
              {!COMPATIBLE_MODELS.some((m) => m.id === resolvedSelectedValue) && selectedModel && (
                <optgroup label="─── Currently Active Model ───">
                  <option value={selectedModel}>
                    {selectedModel} — ● Currently Active in Ollama
                  </option>
                </optgroup>
              )}

              <optgroup label="─── Tier 1: Minimal / Ultra-Light (1B – 2B) • Low RAM ───">
                {COMPATIBLE_MODELS.filter((m) => m.tier === 'minimum').map((m) => {
                  const isInst = isModelInstalled(m, models);
                  const isRec = m.id === hardwareProfile.recommendedModelId;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.downloadSize}, {m.parameterSize}) — {isInst ? '● Installed' : '○ Available to pull'}{isRec ? ' ⭐ Best For System' : ''}
                    </option>
                  );
                })}
              </optgroup>

              <optgroup label="─── Tier 2: Balanced / Standard (3B – 4B) • HuskyNote Recommended ───">
                {COMPATIBLE_MODELS.filter((m) => m.tier === 'standard').map((m) => {
                  const isInst = isModelInstalled(m, models);
                  const isRec = m.id === hardwareProfile.recommendedModelId;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.downloadSize}, {m.parameterSize}) — {isInst ? '● Installed' : '○ Available to pull'}{isRec ? ' ⭐ Best For System' : ''}
                    </option>
                  );
                })}
              </optgroup>

              <optgroup label="─── Tier 3: High Performance / Pro (7B – 8B) • Deep RAG & Transcripts ───">
                {COMPATIBLE_MODELS.filter((m) => m.tier === 'pro').map((m) => {
                  const isInst = isModelInstalled(m, models);
                  const isRec = m.id === hardwareProfile.recommendedModelId;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.downloadSize}, {m.parameterSize}) — {isInst ? '● Installed' : '○ Available to pull'}{isRec ? ' ⭐ Best For System' : ''}
                    </option>
                  );
                })}
              </optgroup>

              <optgroup label="─── Tier 4: Advanced / Power (14B) • High-Memory Workstations ───">
                {COMPATIBLE_MODELS.filter((m) => m.tier === 'advanced').map((m) => {
                  const isInst = isModelInstalled(m, models);
                  const isRec = m.id === hardwareProfile.recommendedModelId;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.downloadSize}, {m.parameterSize}) — {isInst ? '● Installed' : '○ Available to pull'}{isRec ? ' ⭐ Best For System' : ''}
                    </option>
                  );
                })}
              </optgroup>
            </select>

            {/* Status of Selected Model */}
            {selectedModel && (
              <div className="flex items-center justify-between text-xs px-1">
                {isActiveModelInstalled ? (
                  <div className="flex items-center gap-1.5 text-slate-950 dark:text-white font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                    <span>
                      Ready: <strong className="text-slate-950 dark:text-white">{activeCompatible?.name || selectedModel}</strong> is installed and powering workspace notes, meetings, and documents.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-400" />
                    <span>
                      <strong className="text-slate-950 dark:text-zinc-200">{activeCompatible?.name || selectedModel}</strong> is selected but not yet downloaded locally.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Prompt to pull if currently selected model is not installed */}
            {!isActiveModelInstalled && selectedModel && (
              <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                    <ArrowDownCircle className="w-4 h-4 text-slate-900 dark:text-white" />
                    <span>Download Required: {activeCompatible?.name || selectedModel}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                    Download size: <strong className="text-slate-900 dark:text-zinc-300">{activeCompatible?.downloadSize || 'Standard'}</strong> • Requires ~{activeCompatible?.ramRequiredGb || 4} GB RAM
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold shrink-0 shadow-sm"
                  onClick={() => handlePullModel(selectedModel, activeCompatible?.name)}
                  disabled={pullingModelId !== null}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull {activeCompatible?.name || selectedModel}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Live Pull Progress Display */}
          {pullingModelId && (
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 shadow-md space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-950 dark:text-white font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                  <span>
                    Pulling Model: <strong className="font-mono text-slate-950 dark:text-white">{pullingModelId}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {pullProgress?.percent !== undefined && (
                    <span className="font-mono text-slate-950 dark:text-white font-bold">{pullProgress.percent}%</span>
                  )}
                  <button
                    onClick={handleCancelPull}
                    className="text-[11px] text-slate-600 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-slate-900 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)] h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, pullProgress?.percent || 20)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
                <span>{pullProgress?.status || 'Downloading model layers from Ollama...'}</span>
                {pullProgress?.completed && pullProgress?.total ? (
                  <span>
                    {(pullProgress.completed / 1024 / 1024).toFixed(1)} MB / {(pullProgress.total / 1024 / 1024).toFixed(1)} MB
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Compatible Models Hub (Ranked From Min to Higher) */}
          <div id="section-models" className="space-y-4 pt-3 border-t border-slate-200 dark:border-zinc-850 scroll-mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-900 dark:text-white" />
                  <span>Compatible Models Catalog (Min to Higher Tiers)</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                  Pre-screened models optimized for HuskyNote. Click "Pull Model" on any tier to install directly.
                </p>
              </div>

              {/* Tier Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-slate-300 dark:border-zinc-800 self-start sm:self-auto">
                <button
                  onClick={() => setActiveTierFilter('all')}
                  className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                    activeTierFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  All ({COMPATIBLE_MODELS.length})
                </button>
                <button
                  onClick={() => setActiveTierFilter('minimum')}
                  className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                    activeTierFilter === 'minimum'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Minimal (1B–2B)
                </button>
                <button
                  onClick={() => setActiveTierFilter('standard')}
                  className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                    activeTierFilter === 'standard'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Standard (3B–4B)
                </button>
                <button
                  onClick={() => setActiveTierFilter('pro')}
                  className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                    activeTierFilter === 'pro'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Pro (7B–8B)
                </button>
                <button
                  onClick={() => setActiveTierFilter('advanced')}
                  className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                    activeTierFilter === 'advanced'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-bold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Advanced (14B)
                </button>
              </div>
            </div>

            {/* Model Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {COMPATIBLE_MODELS.filter((m) => activeTierFilter === 'all' || m.tier === activeTierFilter).map(
                (model) => {
                  const isInstalled = isModelInstalled(model, models);
                  const isCurrentlySelected = selectedModel === model.id;
                  const isRec = model.id === hardwareProfile.recommendedModelId;
                  const isPullingThis = pullingModelId === model.id;
                  const tierInfo = MODEL_TIERS[model.tier];

                  return (
                    <div
                      key={model.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isCurrentlySelected
                          ? 'bg-slate-100 dark:bg-zinc-900 border-slate-400 dark:border-zinc-400 shadow-sm'
                          : isRec
                          ? 'bg-slate-50 dark:bg-zinc-900/60 border-slate-300 dark:border-zinc-700'
                          : 'bg-white dark:bg-zinc-900/30 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Title & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-950 dark:text-white">{model.name}</span>
                              {isRec && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-950 dark:text-white font-bold flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-slate-900 dark:text-white" />
                                  Best For System
                                </span>
                              )}
                              {model.isAppDefault && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 font-semibold">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5 font-medium">
                              <span>{model.provider}</span>
                              <span>•</span>
                              <span className="font-mono text-slate-900 dark:text-zinc-300">{model.parameterSize} params</span>
                              <span>•</span>
                              <span className="font-mono text-slate-900 dark:text-zinc-300">{model.downloadSize}</span>
                            </div>
                          </div>

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 shrink-0 font-mono font-bold">
                            {tierInfo.minRam}
                          </span>
                        </div>

                        {/* Summary */}
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                          {model.summary}
                        </p>
                      </div>

                      {/* Card Action Row */}
                      <div className="pt-2 border-t border-slate-200 dark:border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
                        <div className="text-[10px] text-slate-600 dark:text-zinc-400 font-medium">
                          Speed: <strong className="text-slate-950 dark:text-zinc-200">{model.speedRating}</strong>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPullingThis ? (
                            <div className="flex items-center gap-2 text-xs text-slate-950 dark:text-white font-semibold">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900 dark:text-white" />
                              <span>Downloading...</span>
                            </div>
                          ) : isCurrentlySelected && isInstalled ? (
                            <span className="text-[11px] font-bold text-slate-950 dark:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700">
                              <CheckCheck className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                              Active Model
                            </span>
                          ) : isInstalled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2.5 border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium"
                              onClick={() => handleSelectModel(model.id)}
                            >
                              <Check className="w-3 h-3" />
                              <span>Select Active</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              className="text-xs h-7 px-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold shadow-sm"
                              onClick={() => handlePullModel(model.id, model.name)}
                              disabled={pullingModelId !== null}
                            >
                              <Download className="w-3 h-3" />
                              <span>Pull Model</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Custom Model Pull Input */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-300 dark:border-zinc-850 space-y-2">
              <label className="block text-xs font-semibold text-slate-950 dark:text-zinc-300">
                Pull Custom Ollama Model (Advanced)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customModelTag}
                  onChange={(e) => setCustomModelTag(e.target.value)}
                  placeholder="e.g. deepseek-r1:7b, mistral-nemo, codellama:7b"
                  className="flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs text-slate-950 dark:text-zinc-100 font-mono focus:outline-none focus:border-slate-500 dark:focus:border-zinc-700"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (customModelTag.trim()) {
                      handlePullModel(customModelTag.trim());
                      setCustomModelTag('');
                    }
                  }}
                  disabled={!customModelTag.trim() || pullingModelId !== null}
                  className="border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull Tag</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Optional Local Companion Status */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-850 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 font-medium">
              <Server className="w-4 h-4 text-slate-700 dark:text-zinc-500" />
              <span>Python Companion Service (port 8765):</span>
            </div>
            <span
              className={`font-bold ${
                companionStatus === 'online' ? 'text-slate-950 dark:text-white' : 'text-slate-500 dark:text-zinc-500'
              }`}
            >
              {companionStatus === 'online' ? 'Active' : 'Offline (Optional)'}
            </span>
          </div>
        </div>
        )}

        {/* Google Calendar & Cloud Sync Section */}
        <div id="section-google-calendar" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-6 scroll-mt-6 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white">
                <Calendar className="w-5 h-5 text-slate-900 dark:text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Google Calendar & System Sync</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Two-way event synchronization, speech date extraction, and zero-config web scheduling
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  gcalConfig.isConnected ? 'bg-slate-900 dark:bg-white animate-pulse' : 'bg-slate-400 dark:bg-zinc-600'
                }`}
              />
              <span className="text-xs font-bold text-slate-950 dark:text-white">
                {gcalConfig.isConnected ? `Connected (${gcalConfig.userEmail || 'Google User'})` : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Sync Architecture & OAuth Client ID Explanation Banner */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-start gap-2.5">
              <Key className="w-4 h-4 text-slate-900 dark:text-white shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1">
                <span className="font-bold text-slate-950 dark:text-white">How Google Calendar Sync Works:</span>
                <p className="text-slate-600 dark:text-zinc-400">
                  Google Calendar offers two flexible integration tiers in HuskyNote:
                </p>
                <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600 dark:text-zinc-400">
                  <li>
                    <strong className="text-slate-950 dark:text-white">1-Click Web Event Creation (Zero Config):</strong> Works immediately with no Client ID, API keys, or OAuth setup required. HuskyNote pre-populates your event in Google Calendar in your default browser.
                  </li>
                  <li>
                    <strong className="text-slate-950 dark:text-white">Two-Way Background Sync (OAuth 2.0):</strong> To pull events into HuskyNote or push them silently, Google's Cloud security policy requires an OAuth 2.0 Client ID. HuskyNote keeps this <em>100% dynamic</em> — you can paste your own Client ID below or provide <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env</code> without any hardcoded credentials.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Dynamic Client ID Input & Connection Controls */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-950 dark:text-zinc-200">
              Google OAuth 2.0 Client ID (Dynamic Configuration)
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={customClientId}
                onChange={(e) => setCustomClientId(e.target.value)}
                placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                className="flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-850 rounded-md px-3 py-2 text-xs text-slate-950 dark:text-zinc-100 font-mono focus:outline-none focus:border-slate-500 dark:focus:border-zinc-700"
              />
              <Button size="sm" variant="secondary" onClick={handleSaveGoogleClientId}>
                Save Client ID
              </Button>
              {gcalConfig.isConnected ? (
                <Button size="sm" variant="danger" onClick={handleDisconnectGoogle}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Google'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Step-by-Step Guide: How to generate your Client ID in Google Cloud */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-zinc-850">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider font-mono">
              Setup Guide: How to Get a Free Client ID (3 Minutes)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-[10px] flex items-center justify-center font-mono">1</span>
                  <span className="font-bold text-slate-950 dark:text-white">Enable Calendar API</span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-slate-950 dark:text-white underline font-medium">console.cloud.google.com</a>, create a project, and search for and enable <strong>Google Calendar API</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-[10px] flex items-center justify-center font-mono">2</span>
                  <span className="font-bold text-slate-950 dark:text-white">Consent Screen</span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Under <strong>OAuth consent screen</strong>, select <strong>External</strong>, enter your app name (e.g. <em>HuskyNote</em>) and email, and save.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-[10px] flex items-center justify-center font-mono">3</span>
                  <span className="font-bold text-slate-950 dark:text-white">Create Credentials</span>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Go to <strong>Credentials &gt; Create Credentials &gt; OAuth client ID</strong>. Select <strong>Web application</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-[10px] flex items-center justify-center font-mono">4</span>
                    <span className="font-bold text-slate-950 dark:text-white">Authorized URIs</span>
                  </div>
                  <button
                    onClick={copyOriginToClipboard}
                    className="flex items-center gap-1 text-[10px] text-slate-900 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 transition-colors font-mono"
                  >
                    {copiedRedirectOrigin ? <Check className="w-3 h-3 text-slate-900 dark:text-white" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Origin</span>
                  </button>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Add your origin (e.g. <code>http://localhost:5176</code> and <code>http://127.0.0.1:5176</code>) to both <strong>Authorized JavaScript origins</strong> and <strong>Authorized redirect URIs</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chrome Browser Extension Companion Setup */}
        <div id="section-companion" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-6 scroll-mt-6 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-850 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white">
                <ChromeIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Chrome Browser Extension</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  Meeting & Tab Audio Companion (Google Meet, Microsoft Teams, Browser Tabs)
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 px-2.5 py-1 rounded-md font-bold">
              Manifest V3 • Built-in
            </span>
          </div>

          {/* Quick Explanation Banner */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
            <Shield className="w-4 h-4 text-slate-900 dark:text-white shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed space-y-1">
              <span className="font-bold text-slate-950 dark:text-white">Direct Tab Audio Streaming:</span>
              <p className="text-slate-600 dark:text-zinc-400 font-medium">
                The Chrome extension connects Google Meet sessions directly to your local HuskyNote workspace.
                All audio is captured via Chrome's native <code>tabCapture</code> API with zero external servers.
              </p>
            </div>
          </div>

          {/* ── 1-Click Install Action Bar ── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-zinc-900 dark:to-black border border-slate-700 dark:border-zinc-800 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white mb-0.5">Quick Install</div>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                Download the ZIP, then load it unpacked in Chrome — takes 30 seconds.
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
              {/* 1-Click Automated Setup Modal */}
              <button
                type="button"
                onClick={() => setIsExtensionModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm whitespace-nowrap"
              >
                <ChromeIcon className="w-3.5 h-3.5 shrink-0" colored={false} />
                <span>1-Click Setup</span>
              </button>
              {/* Download ZIP */}
              <a
                href="/api/chrome-extension/download-zip"
                download="HuskyNote-Chrome-Extension.zip"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-100 text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors shadow-sm whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                Download ZIP
              </a>
              {/* Open chrome://extensions */}
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/chrome-extension/open-extensions-page', { method: 'POST' });
                    addToast('Opened chrome://extensions in Google Chrome!', 'success');
                  } catch {
                    copyToClipboard('chrome://extensions', 'url');
                    addToast('chrome://extensions copied — paste it in your Chrome address bar', 'info');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 dark:bg-zinc-800 text-white text-xs font-bold hover:bg-slate-600 dark:hover:bg-zinc-700 transition-colors border border-slate-600 dark:border-zinc-700 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                Open Extensions
              </button>
            </div>
          </div>

          {/* Step-by-Step Installation Instructions */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider font-mono">
              Installation Steps (30 Seconds)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center font-mono">
                    1
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 font-medium">Open Extensions</span>
                </div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">Navigate to chrome://extensions</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Paste the address into your Chrome browser address bar and press Enter:
                </p>
                <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-canvas border border-slate-200 dark:border-zinc-800 font-mono text-xs text-slate-900 dark:text-zinc-200">
                  <span>chrome://extensions</span>
                  <button
                    onClick={() => copyToClipboard('chrome://extensions', 'url')}
                    className="flex items-center gap-1 text-[10px] text-slate-900 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors font-medium"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-slate-900 dark:text-white" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center font-mono">
                    2
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 font-medium">Enable Developer Mode</span>
                </div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">Toggle Developer Mode</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                  In the top-right corner of the Extensions page, switch the <strong className="text-slate-900 dark:text-zinc-200">Developer mode</strong> toggle to <span className="text-slate-950 dark:text-white font-black underline">ON</span>.
                </p>
                <div className="p-2 rounded bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-2 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0" />
                  <span>Reveals the "Load unpacked" button</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center font-mono">
                    3
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 font-medium">Load Unpacked</span>
                </div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">Click "Load unpacked"</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Click the <strong className="text-slate-900 dark:text-zinc-200">Load unpacked</strong> button on the top-left toolbar and select this repository's extension folder:
                </p>
                <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-canvas border border-slate-200 dark:border-zinc-800 font-mono text-xs text-slate-900 dark:text-zinc-200">
                  <span className="truncate">huskynote/browser-extension</span>
                  <button
                    onClick={() => copyToClipboard('browser-extension', 'path')}
                    className="flex items-center gap-1 text-[10px] text-slate-900 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors shrink-0 ml-2 font-medium"
                  >
                    {copiedPath ? <Check className="w-3 h-3 text-slate-900 dark:text-white" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPath ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center font-mono">
                    4
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500 font-medium">Ready to Capture</span>
                </div>
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">Start Meeting or Tab Audio</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Open Google Meet or any browser tab. Click the HuskyNote puzzle piece icon or floating badge to stream audio directly into your Meeting Secretary note!
                </p>
                <div className="p-2 rounded bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-white animate-pulse" />
                  <span>Streams audio directly to IndexedDB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multilingual Speech & Translation Preferences */}
        <div id="section-speech" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-5 scroll-mt-6 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-850 pb-4">
            <Languages className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Speech Recognition & Translation</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400">Configure default language and AI translation targets for meeting recordings</p>
            </div>
          </div>

          <TranscriptionSettings spokenLanguage={currentSpeechLang} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/60 dark:bg-zinc-900/40 space-y-2">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Default Spoken Language</span>
              </label>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                The primary language used when transcribing new meeting recordings.
              </p>
              <select
                value={currentSpeechLang}
                onChange={(e) => handleUpdateSpeechLanguage(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-slate-500 dark:focus:border-zinc-500 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.bcp47} value={lang.bcp47}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-850 bg-slate-50/60 dark:bg-zinc-900/40 space-y-2">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Supported Multilingual Capabilities</span>
              </label>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                Live transcription and AI translation dynamically support Filipino / Tagalog, English, Japanese, Chinese, Korean, French, Spanish, and German with offline phrasebooks and local model synthesis.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUPPORTED_LANGUAGES.slice(0, 8).map((l) => (
                  <span key={l.code} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300">
                    {l.flag} {l.name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Storage & Archive Management */}
        <div id="section-storage" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl p-6 space-y-5 scroll-mt-6 shadow-xs dark:shadow-xl transition-colors duration-500">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-850 pb-4">
            <Database className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-zinc-100">Local-First Storage (IndexedDB)</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400">All data is kept inside your browser database</p>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-center">
              <div className="text-lg font-bold text-slate-950 dark:text-white font-mono">{notesCount}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Notes</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-center">
              <div className="text-lg font-bold text-slate-950 dark:text-white font-mono">{meetingsCount}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Meetings</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-center">
              <div className="text-lg font-bold text-slate-950 dark:text-white font-mono">{documentsCount}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Documents</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-center">
              <div className="text-lg font-bold text-slate-950 dark:text-white font-mono">{manualsCount}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Manuals</div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-center">
              <div className="text-lg font-bold text-slate-950 dark:text-white font-mono">{blobsCount}</div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Files & Audio</div>
            </div>
          </div>

          {/* Export & Import */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <input
              type="file"
              ref={importFileRef}
              onChange={handleImport}
              accept="application/json"
              className="hidden"
            />
            <Button size="sm" variant="primary" onClick={handleExport}>
              <Download className="w-3.5 h-3.5" />
              <span>Export Workspace Archive</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Workspace JSON</span>
            </Button>
            <Button size="sm" variant="danger" onClick={handleClearDatabase} className="ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Data</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
