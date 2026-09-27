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
} from '../../services/audio/transcription-engines';
import { getCachedModel, removeCachedModel, type CachedModelInfo, type CachedModelVariant } from '../../services/audio/model-cache';
import { useSpeechStatus } from '../ui/speech-status-indicator';

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
export const TranscriptionSettings: React.FC<{ spokenLanguage: string }> = ({ spokenLanguage }) => {
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
  const [downloads, setDownloads] = useState<Record<string, CachedModelInfo | null> | null>(null);
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AudioLines className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
        <span className="text-xs font-bold text-slate-900 dark:text-white">Transcription Engine</span>
      </div>
      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
        All engines run on this device. The model downloads once on first use; the GPU size applies when your computer
        supports WebGPU, otherwise the smaller CPU version is used.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Transcription engine">
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
              className={`text-left p-4 rounded-xl border transition-colors ${
                active
                  ? 'border-slate-900 dark:border-zinc-400 bg-slate-50 dark:bg-zinc-900'
                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-950 dark:text-zinc-100">{engine.name}</span>
                {active && <span className="text-[10px] font-mono uppercase tracking-wider">Active</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">{engine.description}</p>
              <div className="mt-2 text-[10px] font-mono text-slate-500 dark:text-zinc-500">
                {languages} · GPU {formatSize(engine.downloadMb.webgpu)} · CPU {formatSize(engine.downloadMb.wasm)}
              </div>
            </button>
          );
        })}
      </div>

      {usesFallback && (
        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
          {selected.name} does not support your default spoken language, so recordings in that language use{' '}
          {getTranscriptionEngine(MULTILINGUAL_FALLBACK_ENGINE).name} automatically.
        </p>
      )}

      {speech.engineName && speech.device && (
        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
          {speech.engineName} is running on the {speech.device === 'webgpu' ? 'GPU' : 'CPU'}.
          {speech.gpuError && (
            <span className="block mt-0.5 text-slate-500 dark:text-zinc-500 break-words">
              The GPU could not be used: {speech.gpuError}
            </span>
          )}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">Downloaded on this device</span>
        </div>

        {downloads === null ? (
          <p className="text-[11px] text-slate-500 dark:text-zinc-500">Checking...</p>
        ) : downloaded.length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-zinc-500">
            No speech models downloaded yet. The selected engine downloads the first time you record.
          </p>
        ) : (
          <ul className="space-y-2">
            {downloaded.map((engine) => {
              const info = downloads[engine.id]!;
              return (
                <li key={engine.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-xs font-medium text-slate-900 dark:text-zinc-100 min-w-[8rem]">{engine.name}</span>
                  {info.variants.map((v) => {
                    const busy = removing === `${engine.id}:${v.id}`;
                    return (
                      <span key={v.id} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400">
                        {VARIANT_LABEL[v.id]} · {formatBytes(v.bytes)}
                        <button
                          type="button"
                          onClick={() => handleRemove(engine.id, v.id)}
                          disabled={busy}
                          className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-850 disabled:opacity-50 transition-colors"
                          title={`Remove ${engine.name} ${v.id === 'all' ? '' : VARIANT_LABEL[v.id]}`.trim()}
                          aria-label={`Remove ${engine.name} ${v.id === 'all' ? 'download' : VARIANT_LABEL[v.id]}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed">
          Models are stored by this browser for this app address ({window.location.origin}). Opening HuskyNote in another
          browser, at another address, or in the desktop app downloads them again.
        </p>
      </div>
    </div>
  );
};
