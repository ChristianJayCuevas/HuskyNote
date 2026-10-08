import React, { useEffect } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ManualBuilder } from '../components/operations/manual-builder';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { ResizableListPanel } from '../components/ui/resizable-list-panel';
import { ListPane, ListPaneBody, ListPaneEmpty, ListPaneHeader, ListItem } from '../components/ui/list-pane';
import { cn } from '../lib/utils';
import { Video, Plus, BookOpen } from 'lucide-react';

export const ManualsView: React.FC = () => {
  const { activeManualId, setActiveManualId, setActiveView } = useWorkspace();

  const manuals = useLiveQuery(() => db.manuals.orderBy('updatedAt').reverse().toArray(), []) || [];

  // Auto-select the newest manual on desktop; phones start on the list
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches && !activeManualId && manuals.length > 0) {
      setActiveManualId(manuals[0].id);
    }
  }, [manuals, activeManualId, setActiveManualId]);

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
    setActiveManualId(id);
  };

  const selectedManual = manuals.find((m) => m.id === activeManualId);
  const isDetailOpen = Boolean(selectedManual);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* Left column: manuals list */}
      <ResizableListPanel storageKey="manuals" label="Manuals" hiddenOnMobile={isDetailOpen}>
        <ListPane>
          <ListPaneHeader
            title="Manuals"
            count={manuals.length}
            actions={
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleCreateBlankManual}
                  className="text-muted-foreground"
                  title="Create blank manual"
                  aria-label="Create blank manual"
                >
                  <Plus />
                </Button>
                <Button
                  size="sm"
                  onClick={() => setActiveView('studio')}
                  title="Record your screen to create a step-by-step guide"
                >
                  <Video />
                  <span>Record a guide</span>
                </Button>
              </>
            }
          />

          <ListPaneBody>
            {manuals.length === 0 ? (
              <ListPaneEmpty
                icon={<BookOpen />}
                title="No operation manuals yet."
                description="Record a guide or create a manual to get started."
              />
            ) : (
              manuals.map((m) => {
                const isSelected = activeManualId === m.id;
                return (
                  <ListItem
                    key={m.id}
                    selected={isSelected}
                    title={m.title || 'Untitled Manual'}
                    trailing={<span className="tabular-nums">v{m.version}</span>}
                    meta={
                      <span className="tabular-nums">
                        {m.steps.length} steps · {new Date(m.updatedAt).toLocaleDateString()}
                      </span>
                    }
                    description={m.purpose || undefined}
                    onClick={() => setActiveManualId(m.id)}
                  />
                );
              })
            )}
          </ListPaneBody>
        </ListPane>
      </ResizableListPanel>

      {/* Right content area */}
      <div className={cn('h-full min-w-0 flex-1 flex-col', isDetailOpen ? 'flex' : 'hidden md:flex')}>
        {selectedManual ? (
          <ManualBuilder
            manualId={selectedManual.id}
            onBack={() => setActiveManualId(null)}
            onDeleted={() => {
              const remaining = manuals.filter((m) => m.id !== selectedManual.id);
              setActiveManualId(remaining.length > 0 ? remaining[0].id : null);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center overflow-y-auto">
            <EmptyState
              icon={Video}
              title="No operation manual selected"
              description="Record your screen to build a step-by-step guide, or start a blank manual."
              actionLabel="Record a guide"
              onAction={() => setActiveView('studio')}
              secondaryActionLabel="Blank Manual"
              onSecondaryAction={handleCreateBlankManual}
            />
          </div>
        )}
      </div>
    </div>
  );
};
