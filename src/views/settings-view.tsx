import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAI, type PullProgressUpdate } from '../context/ai-context';
import { useWorkspace } from '../context/workspace-context';
import { db } from '../db';
import { BackupSettings } from '../components/settings/backup-settings';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Disclosure } from '../components/ui/disclosure';
import { Field } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { NativeSelect } from '../components/ui/native-select';
import { PageContainer, PageHeader, PageSection } from '../components/ui/page';
import { StatusDot } from '../components/ui/status-dot';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { SettingsRow, SettingsStatus, SettingsStep } from '../components/settings/settings-row';
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
  Download,
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
  Sparkles,
  ArrowDownCircle,
  XCircle,
  CheckCheck,
  Loader2,
  HardDrive,
  Calendar,
  Key,
  ExternalLink,
  AudioLines,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { ChromeIcon } from '../components/ui/chrome-icon';
import { useScrollFade } from '../components/ui/use-scroll-fade';
import { SUPPORTED_LANGUAGES } from '../services/ai/translation';
import { AIProviderSettings } from '../components/settings/ai-provider-settings';
import { TranscriptionSettings } from '../components/settings/transcription-settings';
import { UpdateSettings } from '../components/settings/update-settings';
import { APP_VERSION } from '../services/updates/update-checker';
import { HuskyMark } from '@/brand';

type SettingsTab = 'ai' | 'transcription' | 'integrations' | 'storage' | 'about';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: LucideIcon }[] = [
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'transcription', label: 'Transcription', icon: AudioLines },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'about', label: 'About', icon: Info },
];

const TIER_FILTERS: { value: ModelTier | 'all'; label: string }[] = [
  { value: 'all', label: `All (${COMPATIBLE_MODELS.length})` },
  { value: 'minimum', label: 'Minimal (1B–2B)' },
  { value: 'standard', label: 'Standard (3B–4B)' },
  { value: 'pro', label: 'Pro (7B–8B)' },
  { value: 'advanced', label: 'Advanced (14B)' },
];

const MODEL_OPTION_GROUPS: { tier: ModelTier; label: string }[] = [
  { tier: 'minimum', label: '─── Tier 1: Minimal / Ultra-Light (1B – 2B) • Low RAM ───' },
  { tier: 'standard', label: '─── Tier 2: Balanced / Standard (3B – 4B) • HuskyNote Recommended ───' },
  { tier: 'pro', label: '─── Tier 3: High Performance / Pro (7B – 8B) • Deep RAG & Transcripts ───' },
  { tier: 'advanced', label: '─── Tier 4: Advanced / Power (14B) • High-Memory Workstations ───' },
];

/** Monospace value with a copy button (setup guides) */
const CopyField: React.FC<{ value: string; copied: boolean; onCopy: () => void }> = ({ value, copied, onCopy }) => (
  <div className="flex max-w-md items-center justify-between gap-2 rounded-md border bg-muted py-1 pl-2.5 pr-1 font-mono text-xs text-foreground">
    <span className="truncate">{value}</span>
    <Button type="button" variant="ghost" size="xs" className="shrink-0 font-sans" onClick={onCopy}>
      {copied ? <Check /> : <Copy />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </Button>
  </div>
);

export const SETTINGS_TAB_STORAGE_KEY = 'huskynote-settings-tab';

const isSettingsTab = (v: unknown): v is SettingsTab => SETTINGS_TABS.some((t) => t.id === v);

/** Deep link (?tab=) wins, then the last tab used, then AI. */
const readInitialTab = (): SettingsTab => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (isSettingsTab(fromUrl)) return fromUrl;
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
    if (isSettingsTab(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'ai';
};

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
  const { addToast, setIsExtensionModalOpen, setActiveView } = useWorkspace();

  const [tab, setTab] = useState<SettingsTab>(readInitialTab);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    try {
      localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const handleTab = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (isSettingsTab(next)) selectTab(next);
    };
    window.addEventListener('huskynote:settings-tab', handleTab);
    return () => window.removeEventListener('huskynote:settings-tab', handleTab);
  }, []);

  const [inputUrl, setInputUrl] = useState(baseUrl);
  const [companionStatus, setCompanionStatus] = useState<string>('checking');

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
  // The tab strip scrolls sideways below lg; fade its clipped edge so the hidden tabs read as scrollable
  const tabStripRef = useRef<HTMLDivElement>(null);
  useScrollFade(tabStripRef);

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

  // Arrow keys / Home / End move between tabs (WAI-ARIA tabs pattern; vertical at lg, horizontal below)
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = SETTINGS_TABS.findIndex((t) => t.id === tab);
    const count = SETTINGS_TABS.length;
    let nextIndex: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % count;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + count) % count;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = count - 1;
    else return;
    event.preventDefault();
    const next = SETTINGS_TABS[nextIndex].id;
    selectTab(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  };

  const renderModelOption = (m: CompatibleModel) => {
    const isInst = isModelInstalled(m, models);
    const isRec = m.id === hardwareProfile.recommendedModelId;
    return (
      <option key={m.id} value={m.id}>
        {m.name} ({m.downloadSize}, {m.parameterSize}) — {isInst ? '● Installed' : '○ Available to pull'}{isRec ? ' · Best For System' : ''}
      </option>
    );
  };

  const storageMetrics: { label: string; value: number }[] = [
    { label: 'Notes', value: notesCount },
    { label: 'Meetings', value: meetingsCount },
    { label: 'Documents', value: documentsCount },
    { label: 'Manuals', value: manualsCount },
    { label: 'Files & Audio', value: blobsCount },
  ];

  return (
    <PageContainer width="default">
      <PageHeader
        title="Settings"
        description="Choose your AI, set up speech-to-text, connect other apps, and manage your data."
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div
          ref={tabStripRef}
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={handleTabKeyDown}
          className="flex h-10 shrink-0 items-stretch gap-4 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:sticky lg:top-6 lg:h-auto lg:w-48 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0"
        >
          {SETTINGS_TABS.map((t) => {
            const Icon = t.icon;
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`settings-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`settings-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.id)}
                className="relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm px-0.5 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:text-foreground aria-selected:shadow-[inset_0_-2px_0_0_hsl(var(--foreground))] lg:mb-0 lg:h-8 lg:w-full lg:rounded-md lg:px-2 lg:hover:bg-accent lg:aria-selected:bg-accent lg:aria-selected:shadow-none"
              >
                <Icon aria-hidden="true" className="hidden size-4 text-muted-foreground lg:block" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1">
          {tab === 'ai' && (
            <div role="tabpanel" id="settings-panel-ai" aria-labelledby="settings-tab-ai" className="space-y-12">
              <AIProviderSettings />

              {/* Local AI / Ollama Configuration */}
              {provider === 'ollama' && (
                <>
                  <PageSection
                    id="section-ai"
                    className="scroll-mt-6"
                    title="Local AI (Ollama)"
                    description="Direct connection to your local AI engine"
                    actions={
                      <SettingsStatus tone={isConnected ? 'success' : 'muted'}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </SettingsStatus>
                    }
                  >
                    {/* Service URL & Actions */}
                    <Card>
                      <CardContent className="space-y-4">
                        <Field label="Ollama address" htmlFor="ollama-address">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              id="ollama-address"
                              type="text"
                              value={inputUrl}
                              onChange={(e) => setInputUrl(e.target.value)}
                              placeholder="http://localhost:11434"
                              className="flex-1 font-mono"
                            />
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={handleSaveUrl}>
                                Save URL
                              </Button>
                              <Button variant="outline" onClick={() => checkConnection()} disabled={isChecking}>
                                <RefreshCw className={cn(isChecking && 'animate-spin')} />
                                <span>Test Connection</span>
                              </Button>
                            </div>
                          </div>
                        </Field>

                        {/* Automated Setup Trigger if Disconnected */}
                        {!isConnected && (
                          <Alert>
                            <Power />
                            <div className="col-start-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-0.5">
                                <AlertTitle>Start local AI</AlertTitle>
                                <AlertDescription>
                                  Ollama is not running at <span className="font-mono text-foreground">{baseUrl}</span>. Start it
                                  here in one click.
                                </AlertDescription>
                                <Disclosure
                                  summary="Details"
                                  className="pt-1"
                                  contentClassName="text-xs leading-relaxed text-muted-foreground"
                                >
                                  <p>
                                    The app starts Ollama with browser access (CORS) enabled. You can also run{' '}
                                    <code className="font-mono">./start.sh</code> in a terminal.
                                  </p>
                                </Disclosure>
                              </div>
                              <Button
                                size="sm"
                                variant="default"
                                className="shrink-0 self-start"
                                onClick={async () => {
                                  const res = await startOllamaService();
                                  addToast(res.message, res.success ? 'success' : 'warning');
                                }}
                              >
                                <Power />
                                <span>Start Service</span>
                              </Button>
                            </div>
                          </Alert>
                        )}

                        {/* Optional Local Companion Status */}
                        <div className="flex items-center justify-between gap-3 border-t pt-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Server className="size-4" />
                            <span>Optional helper app:</span>
                          </div>
                          <span
                            className={cn(
                              'font-medium',
                              companionStatus === 'online' ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {companionStatus === 'online' ? 'Active' : 'Offline (Optional)'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Hardware Diagnostic & Smart Recommendation */}
                    <Card>
                      <CardContent className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Cpu className="size-4" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                                <span>Your computer</span>
                                <Badge variant="secondary" className="tabular-nums">
                                  {hardwareProfile.cpuCores} cores • ~{hardwareProfile.memoryEstimateGb} GB
                                </Badge>
                                {hardwareProfile.isAppleSilicon && <Badge variant="outline">Apple Silicon</Badge>}
                              </div>
                              <p className="break-words text-xs text-muted-foreground">
                                Graphics: <span className="font-mono text-foreground">{hardwareProfile.gpuRenderer}</span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="whitespace-normal sm:max-w-[50%]">
                            <Sparkles />
                            <span>{hardwareProfile.recommendationTitle}</span>
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                            {hardwareProfile.recommendationReason}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {!isRecommendedInstalled ? (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePullModel(recommendedModel.id, recommendedModel.name)}
                                disabled={pullingModelId !== null}
                              >
                                <Download />
                                <span>Download Recommended ({recommendedModel.downloadSize})</span>
                              </Button>
                            ) : selectedModel !== recommendedModel.id ? (
                              <Button size="sm" variant="outline" onClick={() => handleSelectModel(recommendedModel.id)}>
                                <Check />
                                <span>Use Recommended</span>
                              </Button>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <CheckCircle className="size-3.5 text-success" />
                                Recommended Model Active
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Active Model Selection (Compatible Models Only, Ranked from Min to Higher) */}
                    <div className="space-y-2 pt-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <Label htmlFor="ollama-active-model">Active Model (Compatible with HuskyNote)</Label>
                        <span className="text-xs text-muted-foreground">{models.length} model(s) installed on Ollama</span>
                      </div>

                      <NativeSelect
                        id="ollama-active-model"
                        value={resolvedSelectedValue}
                        onChange={(e) => handleSelectModel(e.target.value)}
                      >
                        {!COMPATIBLE_MODELS.some((m) => m.id === resolvedSelectedValue) && selectedModel && (
                          <optgroup label="─── Currently Active Model ───">
                            <option value={selectedModel}>{selectedModel} — ● Currently Active in Ollama</option>
                          </optgroup>
                        )}
                        {MODEL_OPTION_GROUPS.map((group) => (
                          <optgroup key={group.tier} label={group.label}>
                            {COMPATIBLE_MODELS.filter((m) => m.tier === group.tier).map(renderModelOption)}
                          </optgroup>
                        ))}
                      </NativeSelect>

                      {/* Status of Selected Model */}
                      {selectedModel && (
                        <div className="flex items-start gap-1.5 text-xs">
                          {isActiveModelInstalled ? (
                            <>
                              <CheckCircle className="mt-px size-3.5 shrink-0 text-success" />
                              <span className="text-muted-foreground">
                                Ready: <strong className="font-medium text-foreground">{activeCompatible?.name || selectedModel}</strong> is installed and powering workspace notes, meetings, and documents.
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="mt-px size-3.5 shrink-0 text-warning" />
                              <span className="text-muted-foreground">
                                <strong className="font-medium text-foreground">{activeCompatible?.name || selectedModel}</strong> is selected but not yet downloaded locally.
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Prompt to pull if currently selected model is not installed */}
                      {!isActiveModelInstalled && selectedModel && (
                        <Alert className="mt-3">
                          <ArrowDownCircle />
                          <div className="col-start-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-0.5">
                              <AlertTitle>Download Required: {activeCompatible?.name || selectedModel}</AlertTitle>
                              <AlertDescription className="text-xs">
                                Download size: <strong className="font-medium text-foreground">{activeCompatible?.downloadSize || 'Standard'}</strong> • Requires ~{activeCompatible?.ramRequiredGb || 4} GB RAM
                              </AlertDescription>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              className="shrink-0 self-start sm:self-center"
                              onClick={() => handlePullModel(selectedModel, activeCompatible?.name)}
                              disabled={pullingModelId !== null}
                            >
                              <Download />
                              <span>Pull {activeCompatible?.name || selectedModel}</span>
                            </Button>
                          </div>
                        </Alert>
                      )}
                    </div>

                    {/* Live Pull Progress Display */}
                    {pullingModelId && (
                      <Card>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                              <span className="truncate">
                                Pulling Model: <span className="font-mono">{pullingModelId}</span>
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {pullProgress?.percent !== undefined && (
                                <span className="font-mono text-xs tabular-nums text-foreground">{pullProgress.percent}%</span>
                              )}
                              <Button variant="ghost" size="xs" onClick={handleCancelPull}>
                                <XCircle />
                                <span>Cancel</span>
                              </Button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div
                            role="progressbar"
                            aria-label={`Pulling ${pullingModelId}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pullProgress?.percent}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                              style={{ width: `${Math.max(5, pullProgress?.percent || 20)}%` }}
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{pullProgress?.status || 'Downloading model layers from Ollama...'}</span>
                            {pullProgress?.completed && pullProgress?.total ? (
                              <span className="tabular-nums">
                                {(pullProgress.completed / 1024 / 1024).toFixed(1)} MB / {(pullProgress.total / 1024 / 1024).toFixed(1)} MB
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </PageSection>

                  {/* Compatible Models Hub (Ranked From Min to Higher) */}
                  <PageSection
                    id="section-models"
                    className="scroll-mt-6"
                    title="Compatible Models Catalog (Min to Higher Tiers)"
                    description={'Pre-screened models optimized for HuskyNote. Click "Pull Model" on any tier to install directly.'}
                  >
                    {/* Tier Filter */}
                    <ToggleGroup
                      type="single"
                      size="sm"
                      value={activeTierFilter}
                      onValueChange={(value) => value && setActiveTierFilter(value as ModelTier | 'all')}
                      aria-label="Filter models by tier"
                      className="flex-wrap"
                    >
                      {TIER_FILTERS.map((filter) => (
                        <ToggleGroupItem key={filter.value} value={filter.value}>
                          {filter.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>

                    {/* Model Cards Grid */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {COMPATIBLE_MODELS.filter((m) => activeTierFilter === 'all' || m.tier === activeTierFilter).map((model) => {
                        const isInstalled = isModelInstalled(model, models);
                        const isCurrentlySelected = selectedModel === model.id;
                        const isRec = model.id === hardwareProfile.recommendedModelId;
                        const isPullingThis = pullingModelId === model.id;
                        const tierInfo = MODEL_TIERS[model.tier];

                        return (
                          <Card
                            key={model.id}
                            className={cn(
                              'flex flex-col justify-between gap-3 p-4',
                              isCurrentlySelected && 'border-primary/60 bg-accent/30'
                            )}
                          >
                            <div className="space-y-2">
                              {/* Title & Badges */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-medium text-foreground">{model.name}</span>
                                    {isRec && (
                                      <Badge variant="secondary">
                                        <Sparkles />
                                        Best For System
                                      </Badge>
                                    )}
                                    {model.isAppDefault && <Badge variant="outline">Default</Badge>}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                                    <span>{model.provider}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{model.parameterSize} params</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{model.downloadSize}</span>
                                  </div>
                                </div>

                                <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
                                  {tierInfo.minRam}
                                </Badge>
                              </div>

                              {/* Summary */}
                              <p className="text-xs leading-relaxed text-muted-foreground">{model.summary}</p>
                            </div>

                            {/* Card Action Row */}
                            <div className="flex min-h-7 items-center justify-between gap-2 border-t pt-3">
                              <div className="text-xs text-muted-foreground">
                                Speed: <span className="font-medium text-foreground">{model.speedRating}</span>
                              </div>

                              {isPullingThis ? (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Downloading...</span>
                                </div>
                              ) : isCurrentlySelected && isInstalled ? (
                                <Badge variant="success">
                                  <CheckCheck />
                                  Active Model
                                </Badge>
                              ) : isInstalled ? (
                                <Button size="xs" variant="outline" onClick={() => handleSelectModel(model.id)}>
                                  <Check />
                                  <span>Select Active</span>
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handlePullModel(model.id, model.name)}
                                  disabled={pullingModelId !== null}
                                >
                                  <Download />
                                  <span>Pull Model</span>
                                </Button>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Custom Model Pull Input */}
                    <Field label="Pull any Ollama model" htmlFor="ollama-custom-model" className="pt-2">
                      <div className="flex gap-2">
                        <Input
                          id="ollama-custom-model"
                          type="text"
                          value={customModelTag}
                          onChange={(e) => setCustomModelTag(e.target.value)}
                          placeholder="e.g. deepseek-r1:7b, mistral-nemo, codellama:7b"
                          className="flex-1 font-mono"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (customModelTag.trim()) {
                              handlePullModel(customModelTag.trim());
                              setCustomModelTag('');
                            }
                          }}
                          disabled={!customModelTag.trim() || pullingModelId !== null}
                        >
                          <Download />
                          <span>Pull Tag</span>
                        </Button>
                      </div>
                    </Field>
                  </PageSection>
                </>
              )}
            </div>
          )}

          {tab === 'transcription' && (
            <div role="tabpanel" id="settings-panel-transcription" aria-labelledby="settings-tab-transcription" className="space-y-12">
              {/* Multilingual Speech & Translation Preferences */}
              <PageSection
                id="section-speech"
                className="scroll-mt-6"
                title="Speech Recognition & Translation"
                description="Choose the speech engine and default language for meeting recordings"
              >
                <TranscriptionSettings spokenLanguage={currentSpeechLang} onLanguageChange={handleUpdateSpeechLanguage}>
                  <div>
                    <SettingsRow
                      htmlFor="default-spoken-language"
                      label="Default Spoken Language"
                      description="The primary language used when transcribing new meeting recordings."
                    >
                      <NativeSelect
                        id="default-spoken-language"
                        value={currentSpeechLang}
                        onChange={(e) => handleUpdateSpeechLanguage(e.target.value)}
                        containerClassName="sm:w-80"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.bcp47} value={lang.bcp47}>
                            {lang.name} ({lang.nativeName})
                          </option>
                        ))}
                      </NativeSelect>
                    </SettingsRow>

                    <SettingsRow
                      stacked
                      label="Supported Multilingual Capabilities"
                      description="Live transcription and AI translation dynamically support Filipino / Tagalog, English, Japanese, Chinese, Korean, French, Spanish, and German with offline phrasebooks and local model synthesis."
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {SUPPORTED_LANGUAGES.slice(0, 8).map((l) => (
                          <Badge key={l.code} variant="secondary" className="font-normal">
                            {l.name.split(' ')[0]}
                          </Badge>
                        ))}
                      </div>
                    </SettingsRow>
                  </div>
                </TranscriptionSettings>
              </PageSection>
            </div>
          )}

          {tab === 'integrations' && (
            <div role="tabpanel" id="settings-panel-integrations" aria-labelledby="settings-tab-integrations" className="space-y-12">
              {/* Google Calendar & Cloud Sync Section */}
              <PageSection
                id="section-google-calendar"
                className="scroll-mt-6"
                title="Google Calendar"
                description="Add meeting events to your calendar, or sync both ways"
                actions={
                  <SettingsStatus tone={gcalConfig.isConnected ? 'success' : 'muted'}>
                    {gcalConfig.isConnected ? `Connected (${gcalConfig.userEmail || 'Google User'})` : 'Disconnected'}
                  </SettingsStatus>
                }
              >
                {/* Sync Architecture & OAuth Client ID Explanation */}
                <Alert>
                  <Key />
                  <AlertTitle>How it works:</AlertTitle>
                  <AlertDescription className="space-y-1.5">
                    <p>There are two ways to add events to Google Calendar:</p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        <strong className="font-medium text-foreground">Quick add (no setup):</strong> HuskyNote opens Google Calendar in your browser with the event already filled in.
                      </li>
                      <li>
                        <strong className="font-medium text-foreground">Two-way sync:</strong> Pull events into HuskyNote and push them back automatically. This needs a free Google Client ID, which you paste below.
                        <Disclosure summary="Details" className="mt-1" contentClassName="text-xs leading-relaxed text-muted-foreground">
                          <p>
                            Google requires an OAuth 2.0 Client ID for background sync. HuskyNote ships without one; paste your own below or set{' '}
                            <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in <code className="font-mono">.env</code>.
                          </p>
                        </Disclosure>
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Dynamic Client ID Input & Connection Controls */}
                <Field label="Google Client ID" htmlFor="google-client-id">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="google-client-id"
                      type="text"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                      className="flex-1 font-mono"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleSaveGoogleClientId}>
                        Save Client ID
                      </Button>
                      {gcalConfig.isConnected ? (
                        <Button variant="destructive" onClick={handleDisconnectGoogle}>
                          Disconnect
                        </Button>
                      ) : (
                        <Button variant="default" onClick={handleConnectGoogle} disabled={isConnectingGoogle}>
                          <Calendar />
                          <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Google'}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Field>

                {/* Step-by-Step Guide: How to generate your Client ID in Google Cloud */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold text-foreground">Setup Guide: How to Get a Free Client ID (3 Minutes)</h3>
                  <ol className="space-y-5">
                    <SettingsStep step={1} title="Enable Calendar API">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">console.cloud.google.com</a>, create a project, and search for and enable <strong className="font-medium text-foreground">Google Calendar API</strong>.
                      </p>
                    </SettingsStep>
                    <SettingsStep step={2} title="Consent Screen">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Under <strong className="font-medium text-foreground">OAuth consent screen</strong>, select <strong className="font-medium text-foreground">External</strong>, enter your app name (e.g. <em>HuskyNote</em>) and email, and save.
                      </p>
                    </SettingsStep>
                    <SettingsStep step={3} title="Create Credentials">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Go to <strong className="font-medium text-foreground">Credentials &gt; Create Credentials &gt; OAuth client ID</strong>. Select <strong className="font-medium text-foreground">Web application</strong>.
                      </p>
                    </SettingsStep>
                    <SettingsStep step={4} title="Authorized URIs">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Add your origin (e.g. <code className="rounded-sm bg-muted px-1 font-mono">http://localhost:5176</code> and <code className="rounded-sm bg-muted px-1 font-mono">http://127.0.0.1:5176</code>) to both <strong className="font-medium text-foreground">Authorized JavaScript origins</strong> and <strong className="font-medium text-foreground">Authorized redirect URIs</strong>.
                      </p>
                      <Button variant="outline" size="xs" onClick={copyOriginToClipboard}>
                        {copiedRedirectOrigin ? <Check /> : <Copy />}
                        <span>Copy Origin</span>
                      </Button>
                    </SettingsStep>
                  </ol>
                </div>
              </PageSection>

              {/* Chrome Browser Extension Companion Setup */}
              <PageSection
                id="section-companion"
                className="scroll-mt-6"
                title="Chrome Browser Extension"
                description="Meeting & Tab Audio Companion (Google Meet, Microsoft Teams, Browser Tabs)"
                actions={<Badge variant="secondary">Built in</Badge>}
              >
                {/* Quick Explanation */}
                <Alert>
                  <Shield />
                  <AlertTitle>Record meeting audio:</AlertTitle>
                  <AlertDescription>
                    The Chrome extension sends Google Meet and browser tab audio straight to your HuskyNote workspace.
                    Audio is captured by Chrome itself and never leaves your computer.
                  </AlertDescription>
                </Alert>

                {/* 1-Click Install Actions */}
                <Card>
                  <CardContent className="space-y-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">Quick Install</div>
                      <p className="text-xs text-muted-foreground">
                        Download the ZIP, then load it unpacked in Chrome — takes 30 seconds.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1-Click Automated Setup Modal */}
                      <Button type="button" size="sm" variant="default" onClick={() => setIsExtensionModalOpen(true)}>
                        <ChromeIcon className="size-3.5 shrink-0" colored={false} />
                        <span>1-Click Setup</span>
                      </Button>
                      {/* Download ZIP */}
                      <Button size="sm" variant="outline" asChild>
                        <a href="/api/chrome-extension/download-zip" download="HuskyNote-Chrome-Extension.zip">
                          <Download />
                          Download ZIP
                        </a>
                      </Button>
                      {/* Open chrome://extensions */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await fetch('/api/chrome-extension/open-extensions-page', { method: 'POST' });
                            addToast('Opened chrome://extensions in Google Chrome!', 'success');
                          } catch {
                            copyToClipboard('chrome://extensions', 'url');
                            addToast('chrome://extensions copied — paste it in your Chrome address bar', 'info');
                          }
                        }}
                      >
                        <ExternalLink />
                        Open Extensions
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Step-by-Step Installation Instructions */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-foreground">Installation Steps (30 Seconds)</h3>
                  <ol className="space-y-5">
                    <SettingsStep step={1} title="Navigate to chrome://extensions" caption="Open Extensions">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Paste the address into your Chrome browser address bar and press Enter:
                      </p>
                      <CopyField
                        value="chrome://extensions"
                        copied={copiedUrl}
                        onCopy={() => copyToClipboard('chrome://extensions', 'url')}
                      />
                    </SettingsStep>

                    <SettingsStep step={2} title="Toggle Developer Mode" caption="Enable Developer Mode">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        In the top-right corner of the Extensions page, switch the <strong className="font-medium text-foreground">Developer mode</strong> toggle on.
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle className="size-3.5 shrink-0" />
                        <span>Reveals the "Load unpacked" button</span>
                      </p>
                    </SettingsStep>

                    <SettingsStep step={3} title={'Click "Load unpacked"'} caption="Load Unpacked">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Click the <strong className="font-medium text-foreground">Load unpacked</strong> button on the top-left toolbar and select this repository's extension folder:
                      </p>
                      <CopyField
                        value="huskynote/browser-extension"
                        copied={copiedPath}
                        onCopy={() => copyToClipboard('browser-extension', 'path')}
                      />
                    </SettingsStep>

                    <SettingsStep step={4} title="Start Meeting or Tab Audio" caption="Ready to Capture">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Open Google Meet or any browser tab. Click the HuskyNote puzzle piece icon or floating badge to stream audio directly into your Meeting Secretary note!
                      </p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusDot tone="success" />
                        <span>Audio is saved on this device</span>
                      </p>
                    </SettingsStep>
                  </ol>
                </div>
              </PageSection>
            </div>
          )}

          {tab === 'storage' && (
            <div role="tabpanel" id="settings-panel-storage" aria-labelledby="settings-tab-storage" className="space-y-12">
              {/* Storage & Archive Management */}
              <PageSection
                id="section-storage"
                className="scroll-mt-6"
                title="Your data"
                description="Everything is stored on this device"
              >
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-5">
                  {storageMetrics.map((metric, index) => (
                    <div
                      key={metric.label}
                      className={cn('bg-card px-4 py-3', index === storageMetrics.length - 1 && 'col-span-2 sm:col-span-1')}
                    >
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{metric.value}</div>
                    </div>
                  ))}
                </div>

                {/* Export & Import */}
                <BackupSettings />

                <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium text-foreground">Erase this workspace</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Deletes all notes, meetings, documents, manuals, and files stored on this device. This cannot be undone.
                    </p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={handleClearDatabase} className="shrink-0 self-start sm:self-center">
                    <Trash2 />
                    <span>Clear Local Data</span>
                  </Button>
                </div>
              </PageSection>
            </div>
          )}

          {tab === 'about' && (
            <div role="tabpanel" id="settings-panel-about" aria-labelledby="settings-tab-about" className="space-y-12">
              <section aria-label="HuskyNote version" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <HuskyMark size={40} />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">HuskyNote</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="tabular-nums">Version {APP_VERSION}</span> · MIT License
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setActiveView('about')}>
                    About HuskyNote
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActiveView('changelog')}>
                    Changelog
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActiveView('privacy')}>
                    Privacy
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href="https://github.com/ChristianJayCuevas/HuskyNote" target="_blank" rel="noopener noreferrer">
                      GitHub <ExternalLink />
                    </a>
                  </Button>
                </div>
              </section>
              <UpdateSettings />
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
};
