import React, { useState } from 'react';
import type { Note, NoteVersion } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { RotateCcw, Clock, ArrowRight } from 'lucide-react';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onRestore: (version: NoteVersion) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  note,
  onRestore,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(
    note.versions.length > 0 ? note.versions[note.versions.length - 1] : null
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Version History"
      description={`Revision history for "${note.title || 'Untitled Note'}"`}
      maxWidth="4xl"
    >
      <div className="flex gap-6 h-[480px]">
        {/* Left: Versions list */}
        <div className="w-64 border-r dark:border-zinc-850 pr-4 overflow-y-auto space-y-2">
          <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Revisions ({note.versions.length})
          </div>
          {note.versions.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-zinc-500 py-4">No previous revisions stored.</div>
          ) : (
            note.versions
              .slice()
              .reverse()
              .map((ver, idx) => {
                const isSelected = selectedVersion?.id === ver.id;
                const timeStr = new Date(ver.timestamp).toLocaleString();
                return (
                  <div
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-50 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-950 dark:text-white'
                        : 'bg-white dark:bg-zinc-950 dark:border-zinc-850 text-slate-600 dark:text-zinc-400 hover:bg-slate-50/60 dark:hover:bg-zinc-900/60 hover:text-slate-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-zinc-200">
                      <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
                      <span>Version {note.versions.length - idx}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">{timeStr}</div>
                    {ver.changeSummary && (
                      <div className="text-[10px] text-slate-600 dark:text-zinc-400 mt-1 italic">
                        {ver.changeSummary}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* Right: Selected Version Preview & Restore */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedVersion ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b dark:border-zinc-850 mb-3">
                <div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400">Snapshot from</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    {new Date(selectedVersion.timestamp).toLocaleString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onRestore(selectedVersion);
                    onClose();
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Version</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50/40 dark:bg-zinc-900/40 p-4 rounded-lg border dark:border-zinc-850 font-mono text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                <div className="font-bold text-slate-900 dark:text-zinc-100 mb-2">{selectedVersion.title}</div>
                {selectedVersion.content}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 dark:text-zinc-500">
              Select a version from the left panel to inspect.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
