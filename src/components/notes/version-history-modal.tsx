import React, { useState } from 'react';
import type { Note, NoteVersion } from '../../types';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { RotateCcw, Clock } from 'lucide-react';

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
      <div className="flex flex-col gap-4 sm:h-[480px] sm:flex-row sm:gap-6">
        {/* Left: Versions list */}
        <div className="flex max-h-48 w-full flex-col sm:max-h-none sm:w-64 sm:shrink-0">
          <div className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">
            Revisions ({note.versions.length})
          </div>
          <div className="min-h-0 flex-1 space-y-px overflow-y-auto">
            {note.versions.length === 0 ? (
              <div className="px-2 py-4 text-sm text-muted-foreground">No previous revisions stored.</div>
            ) : (
              note.versions
                .slice()
                .reverse()
                .map((ver, idx) => {
                  const isSelected = selectedVersion?.id === ver.id;
                  const timeStr = new Date(ver.timestamp).toLocaleString();
                  return (
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      key={ver.id}
                      onClick={() => setSelectedVersion(ver)}
                      className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:bg-accent"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>Version {note.versions.length - idx}</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">{timeStr}</span>
                      {ver.changeSummary && (
                        <span className="line-clamp-2 text-xs italic text-muted-foreground">{ver.changeSummary}</span>
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* Right: Selected Version Preview & Restore */}
        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col sm:border-l sm:pl-6">
          {selectedVersion ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Snapshot from</div>
                  <div className="truncate text-sm font-medium tabular-nums text-foreground">
                    {new Date(selectedVersion.timestamp).toLocaleString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    onRestore(selectedVersion);
                    onClose();
                  }}
                >
                  <RotateCcw />
                  <span>Restore Version</span>
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-5 text-foreground">
                <div className="mb-2 font-semibold">{selectedVersion.title}</div>
                {selectedVersion.content}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a version from the left panel to inspect.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
