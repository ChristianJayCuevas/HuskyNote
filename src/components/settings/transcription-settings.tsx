import React, { useState } from 'react';
import { AudioLines } from 'lucide-react';
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

function formatSize(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

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

  const selected = getTranscriptionEngine(selectedId);
  const usesFallback = !engineSupportsLanguage(selected, spokenLanguage);

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
                  ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-zinc-900'
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
    </div>
  );
};
