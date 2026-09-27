import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { OperationRecorder } from '../components/operations/operation-recorder';
import { ManualBuilder } from '../components/operations/manual-builder';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { Video, Plus, BookOpen } from 'lucide-react';

export const ManualsView: React.FC = () => {
  const { activeManualId, setActiveManualId } = useWorkspace();
  const [isRecordingMode, setIsRecordingMode] = useState(false);

  const manuals = useLiveQuery(() => db.manuals.orderBy('updatedAt').reverse().toArray(), []) || [];

  useEffect(() => {
    if (!activeManualId && !isRecordingMode && manuals.length > 0) {
      setActiveManualId(manuals[0].id);
    }
  }, [manuals, activeManualId, isRecordingMode, setActiveManualId]);

  const handleCreateBlankManual = async () => {
    const id = `manual-${Date.now()}`;
    await db.manuals.put({
      id,
      title: 'Untitled Operation Manual',
      purpose: '',
      requirements: [],
      steps: [
        {
          id: `mstep-1`,
          stepNumber: 1,
          title: 'Initial Step',
          description: 'Describe the initial setup or action...',
        },
      ],
      warnings: [],
      expectedResult: '',
      troubleshooting: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    setIsRecordingMode(false);
    setActiveManualId(id);
  };

  const selectedManual = manuals.find((m) => m.id === activeManualId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-canvas transition-colors duration-500 font-sans">
      {/* Left Sidebar: Manuals List */}
      <div className="w-80 border-r border-slate-200 dark:border-zinc-850 flex flex-col h-full bg-white dark:bg-zinc-950 shrink-0 select-none transition-colors duration-500">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-850 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
            Manuals ({manuals.length})
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateBlankManual}
              title="Create blank manual"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setIsRecordingMode(true);
                setActiveManualId(null);
              }}
              title="Record screen operation"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Capture</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-850">
          {manuals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-500">
              No operation manuals yet. Capture your screen or create a manual to get started.
            </div>
          ) : (
            manuals.map((m) => {
              const isSelected = !isRecordingMode && activeManualId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setIsRecordingMode(false);
                    setActiveManualId(m.id);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-zinc-900/90 text-slate-950 dark:text-white border-l-2 border-slate-900 dark:border-white'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-900/40 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-950 dark:text-zinc-100 truncate pr-2">
                      {m.title || 'Untitled Manual'}
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono font-medium">v{m.version}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-500 mb-1.5 font-medium">
                    <span>{m.steps.length} steps</span>
                    <span>•</span>
                    <span>{new Date(m.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {m.purpose && (
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {m.purpose}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        {isRecordingMode ? (
          <OperationRecorder
            onManualCreated={(manualId) => {
              setIsRecordingMode(false);
              setActiveManualId(manualId);
            }}
            onCancel={() => {
              setIsRecordingMode(false);
              if (manuals.length > 0) setActiveManualId(manuals[0].id);
            }}
          />
        ) : selectedManual ? (
          <ManualBuilder
            manualId={selectedManual.id}
            onDeleted={() => {
              const remaining = manuals.filter((m) => m.id !== selectedManual.id);
              setActiveManualId(remaining.length > 0 ? remaining[0].id : null);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={Video}
              title="No operation manual selected"
              description="Capture your screen states during an operation, or create a blank standard operating procedure."
              actionLabel="Capture Operation"
              onAction={() => setIsRecordingMode(true)}
              secondaryActionLabel="Blank Manual"
              onSecondaryAction={handleCreateBlankManual}
            />
          </div>
        )}
      </div>
    </div>
  );
};
