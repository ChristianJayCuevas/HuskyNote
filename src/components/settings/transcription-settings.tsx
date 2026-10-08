import React, { useCallback, useEffect, useState } from 'react';
import { AudioLines, HardDrive, Trash2 } from 'lucide-react';
import { db, DEFAULT_SETTINGS } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import {
  TRANSCRIPTION_ENGINES,
  MULTILINGUAL_FALLBACK_ENGINE,
  engineSupportsLanguage,
  getPreferredTranscriptionEngine,
  getTranscriptionEngine,
  setPreferredTranscriptionEngine,
  recommendTranscriptionEngine,
} from '../../services/audio/transcription-engines';
import { getCachedModel, removeCachedModel, type CachedModelInfo, type CachedModelVariant } from '../../services/audio/model-cache';
import { detectWebGpu, type WebGpuSupport } from '../../services/audio/asr-protocol';
import { useSpeechStatus } from '../ui/speech-status-indicator';
import { TranscriptionSetup } from './transcription-setup';
import { speechEngine } from '../../services/audio/speech-engine';
import { TranscriptionBenchmark } from './transcription-benchmark';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Disclosure } from '../ui/disclosure';
import { optionCardClass } from './settings-row';

function formatSize(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

const formatBytes = (bytes: number) => formatSize(Math.round(bytes / 1_000_000));

const VARIANT_LABEL: Record<CachedModelVariant['id'], string> = {
  gpu: 'GPU version',
  cpu: 'CPU version',
  all: 'Downloaded',
};

/** Picks the on-device speech-to-text engine used for meetings and dictation. */
export const TranscriptionSettings: React.FC<{
  spokenLanguage: string;
  onLanguageChange: (lang: string) => void;
  /** Rendered between the setup card and the advanced sections (e.g. language rows) */
  children?: React.ReactNode;
}> = ({ spokenLanguage, onLanguageChange, children }) => {
  const { addToast } = useWorkspace();
  const [selectedId, setSelectedId] = useState(() => getPreferredTranscriptionEngine().id);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setPreferredTranscriptionEngine(id);
    try {
      const existing = await db.settings.get('current');
      if (existing) await db.settings.update('current', { transcriptionEngine: id });
      else await db.settings.put({ ...DEFAULT_SETTINGS, transcriptionEngine: id });
      addToast(`${getTranscriptionEngine(id).name} will be used for the next recording.`, 'success');
    } catch {
      addToast('Failed to save the transcription engine.', 'error');
    }
  };

  const speech = useSpeechStatus();
  const [gpu, setGpu] = useState<WebGpuSupport | null>(null);
  const [downloads, setDownloads] = useState<Record<string, CachedModelInfo | null> | null>(null);

  // Whether the GPU versions of the models can run in this browser, before anything is loaded
  useEffect(() => {
    detectWebGpu().then(setGpu);
  }, []);
  const [removing, setRemoving] = useState<string | null>(null);

  const refreshDownloads = useCallback(async () => {
    const entries = await Promise.all(TRANSCRIPTION_ENGINES.map(async (e) => [e.id, await getCachedModel(e)] as const));
    setDownloads(Object.fromEntries(entries));
  }, []);

  // Re-read after a model finishes downloading and loading
  useEffect(() => {
    if (speech.state === 'idle' || speech.state === 'ready') refreshDownloads();
  }, [speech.state, refreshDownloads]);

  const handleRemove = async (engineId: string, variant: CachedModelVariant['id']) => {
    const engine = getTranscriptionEngine(engineId);
    const label = variant === 'all' ? engine.name : `${engine.name} ${VARIANT_LABEL[variant]}`;
    setRemoving(`${engineId}:${variant}`);
    try {
      if (speechEngine.isBusy()) throw new Error('Transcription is active. Stop it before removing a model.');
      if (speechEngine.getEngine()?.id === engine.id) speechEngine.cancel();
      await removeCachedModel(engine, variant);
      addToast(`Removed ${label} from this device. It downloads again the next time it is needed.`, 'success');
    } catch {
      addToast(`Could not remove ${label}.`, 'error');
    } finally {
      setRemoving(null);
      refreshDownloads();
    }
  };

  const selected = getTranscriptionEngine(selectedId);
  const usesFallback = !engineSupportsLanguage(selected, spokenLanguage);
  const downloaded = downloads ? TRANSCRIPTION_ENGINES.filter((e) => downloads[e.id]) : [];

  return (
    <div className="space-y-8">
      <TranscriptionSetup language={spokenLanguage} onLanguageChange={(lang) => {
        onLanguageChange(lang);
        const cached = Object.entries(downloads ?? {}).filter(([, info]) => info?.completeDevices.length).map(([id]) => id);
        void handleSelect(recommendTranscriptionEngine(lang, cached).id);
      }} />
      {children}
      <div className="space-y-2 border-t pt-4">
        <Disclosure summary="Advanced: models and storage" contentClassName="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AudioLines className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Transcription Engine</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              All engines run on this device. The model downloads once on first use; the GPU size applies when your computer
              supports WebGPU, otherwise the smaller CPU version is used.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Transcription engine">
            {TRANSCRIPTION_ENGINES.map((engine) => {
              const active = engine.id === selectedId;
              const languages =
                engine.languages === 'multilingual'
                  ? 'Multilingual'
                  : engine.languages.length === 1
                  ? 'English'
                  : `${engine.languages.length} languages`;
              return (
                <button
                  key={engine.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelect(engine.id)}
                  disabled={speech.state === 'loading' || speech.state === 'transcribing'}
                  className={cn(optionCardClass, 'justify-between')}
                >
                  <div className="w-full space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{engine.name}</span>
                      {active && <Badge variant="secondary">Active</Badge>}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{engine.description}</p>
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {languages} · GPU {formatSize(engine.downloadMb.webgpu)} · CPU {formatSize(engine.downloadMb.wasm)}
                  </div>
                </button>
              );
            })}
          </div>

          {usesFallback && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {selected.name} does not support your default spoken language, so recordings in that language use{' '}
              {getTranscriptionEngine(MULTILINGUAL_FALLBACK_ENGINE).name} automatically.
            </p>
          )}

          {gpu && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {gpu.available && gpu.fp16 ? (
                <>
                  GPU acceleration is available{gpu.vendor ? ` (${gpu.vendor.toUpperCase()})` : ''}, so engines download and run their
                  GPU version.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">GPU acceleration is not available.</span>{' '}
                  {gpu.available
                    ? 'Whisper and Moonshine still use the GPU, but Parakeet needs fp16 support and runs its slower CPU version.'
                    : 'Every engine runs its slower CPU version.'}{' '}
                  {gpu.reason}
                </>
              )}
            </p>
          )}

          {speech.engineName && speech.device && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {speech.engineName} is running on the {speech.device === 'webgpu' ? 'GPU' : 'CPU'}.
              {speech.gpuError && (
                <span className="mt-0.5 block break-words">
                  The GPU could not be used: {speech.gpuError}
                </span>
              )}
            </p>
          )}

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Downloaded on this device</span>
              </div>

              {downloads === null ? (
                <p className="text-xs text-muted-foreground">Checking...</p>
              ) : downloaded.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No speech models downloaded yet. The selected engine downloads the first time you record.
                </p>
              ) : (
                <ul className="divide-y">
                  {downloaded.map((engine) => {
                    const info = downloads[engine.id]!;
                    return (
                      <li key={engine.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                        <span className="min-w-[8rem] text-sm font-medium text-foreground">{engine.name}</span>
                        <span className="text-xs text-muted-foreground">{info.completeDevices.length ? `Required files cached: ${info.completeDevices.join(', ')}. Run setup to verify.` : 'Partial or older revision. Run setup to complete.'}</span>
                        {info.variants.map((v) => {
                          const busy = removing === `${engine.id}:${v.id}`;
                          return (
                            <span key={v.id} className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                              {VARIANT_LABEL[v.id]} · {formatBytes(v.bytes)}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemove(engine.id, v.id)}
                                disabled={busy}
                                className="size-6 text-muted-foreground hover:text-destructive"
                                title={`Remove ${engine.name} ${v.id === 'all' ? '' : VARIANT_LABEL[v.id]}`.trim()}
                                aria-label={`Remove ${engine.name} ${v.id === 'all' ? 'download' : VARIANT_LABEL[v.id]}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </span>
                          );
                        })}
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="text-xs leading-relaxed text-muted-foreground">
                Models are stored by this browser for this app address ({window.location.origin}). Opening HuskyNote in another
                browser, at another address, or in the desktop app downloads them again.
              </p>
            </CardContent>
          </Card>
        </Disclosure>
        <TranscriptionBenchmark language={spokenLanguage} />
      </div>
    </div>
  );
};
