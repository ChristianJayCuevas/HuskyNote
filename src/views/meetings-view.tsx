import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { MeetingRecorder } from '../components/meetings/meeting-recorder';
import { MeetingSummaryView } from '../components/meetings/meeting-summary-view';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { formatSecondsToTime } from '../services/audio/transcriber';
import { meetingDurationSeconds } from '../services/meetings/meeting-report';
import { Mic, Plus, HardDrive, FileUp } from 'lucide-react';
import { ResizableListPanel } from '../components/ui/resizable-list-panel';
import { ListPane, ListPaneBody, ListPaneEmpty, ListPaneHeader, ListItem } from '../components/ui/list-pane';
import { SimpleTooltip } from '../components/ui/tooltip';
import { RecordingsLibrary } from '../components/meetings/recordings-library';
import { ImportMeetingDialog } from '../components/meetings/import-meeting-dialog';
import { ImportProgress } from '../components/meetings/import-progress';
import { tourTarget } from '@/features/guided-tour/tours/targets';

export const MeetingsView: React.FC = () => {
  const { activeMeetingId, setActiveMeetingId, addToast } = useWorkspace();
  const [showImport, setShowImport] = useState(false);
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get('action') === 'meeting');
  const [showRecordings, setShowRecordings] = useState(false);

  const meetings = useLiveQuery(() => db.meetings.orderBy('startTime').reverse().filter((m) => !m.mergedInto).toArray(), []) || [];

  // Auto-select first meeting if available and none selected
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches && !activeMeetingId && !isRecordingMode && meetings.length > 0) {
      setActiveMeetingId(meetings[0].id);
    }
  }, [meetings, activeMeetingId, isRecordingMode, setActiveMeetingId]);

  // Listen to Topbar trigger
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('action') === 'meeting') {
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', url.toString());
    }
    const handleStartEvent = () => {
      const current = new URL(window.location.href);
      current.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', current.toString());
      setIsRecordingMode(true);
    };
    window.addEventListener('huskynote:start-meeting', handleStartEvent);
    return () => window.removeEventListener('huskynote:start-meeting', handleStartEvent);
  }, []);

  const selectedMeeting = meetings.find((m) => m.id === activeMeetingId);

  const isDetailOpen = Boolean(isRecordingMode || selectedMeeting);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <ImportMeetingDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={(id) => {
          setIsRecordingMode(false);
          setActiveMeetingId(id);
          addToast('Meeting imported. Generate a report from its transcript.', 'success');
        }}
        onStarted={() => addToast('Transcribing the recording. Progress shows above your meetings list.', 'info')}
        onError={(message) => addToast(`Import failed: ${message}`, 'error')}
      />
      {showRecordings && <RecordingsLibrary onClose={() => setShowRecordings(false)} onOpen={(id) => {
        setActiveMeetingId(id);
        setShowRecordings(false);
      }} />}

      {/* Left: sessions list */}
      <ResizableListPanel storageKey="meetings" label="Meetings" hiddenOnMobile={isDetailOpen}>
        {/* Phones show the list full width, so it needs no right border there */}
        <ListPane className="border-r-0 md:border-r">
          <ListPaneHeader
            title="Meetings"
            count={meetings.length}
            actions={
              <>
                <SimpleTooltip content="Import a Teams meeting (transcript or recording)" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Import a meeting"
                    {...tourTarget('meetings-import')}
                    disabled={isRecordingMode}
                    onClick={() => setShowImport(true)}
                    className="text-muted-foreground"
                  >
                    <FileUp />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Recordings & storage" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Recordings & storage"
                    disabled={isRecordingMode}
                    onClick={() => setShowRecordings(true)}
                    className="text-muted-foreground"
                  >
                    <HardDrive />
                  </Button>
                </SimpleTooltip>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setIsRecordingMode(true);
                    setActiveMeetingId(null);
                  }}
                >
                  <Plus />
                  <span>New Session</span>
                </Button>
              </>
            }
          />

          <ImportProgress onOpen={(id) => { setIsRecordingMode(false); setActiveMeetingId(id); }} />
          <ListPaneBody>
            {meetings.length === 0 ? (
              <ListPaneEmpty
                icon={<Mic />}
                title="No meetings recorded yet."
                description="Start your first session to record audio and build your timeline."
              />
            ) : (
              meetings.map((m) => (
                <ListItem
                  key={m.id}
                  selected={!isRecordingMode && activeMeetingId === m.id}
                  onClick={() => {
                    setIsRecordingMode(false);
                    setActiveMeetingId(m.id);
                  }}
                  title={m.title}
                  trailing={<span className="font-mono tabular-nums">{formatSecondsToTime(meetingDurationSeconds(m))}</span>}
                  meta={`${new Date(m.startTime).toLocaleDateString()} · ${m.transcript.length} transcript segments`}
                  description={m.summary?.overview || undefined}
                />
              ))
            )}
          </ListPaneBody>
        </ListPane>
      </ResizableListPanel>

      {/* Right: recorder, meeting or empty state */}
      <div className={`${isDetailOpen ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col`}>
        {isRecordingMode ? (
          <MeetingRecorder
            onMeetingSaved={(savedMeeting) => {
              setIsRecordingMode(false);
              setActiveMeetingId(savedMeeting.id);
            }}
            onCancel={() => {
              setIsRecordingMode(false);
              if (meetings.length > 0) setActiveMeetingId(meetings[0].id);
            }}
          />
        ) : selectedMeeting ? (
          <MeetingSummaryView
            meeting={selectedMeeting}
            onBackToList={() => {
              setActiveMeetingId(null);
              setIsRecordingMode(false);
            }}
            onDeleted={() => {
              const remaining = meetings.filter((m) => m.id !== selectedMeeting.id);
              setActiveMeetingId(remaining.length > 0 ? remaining[0].id : null);
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Mic}
              title="No meeting selected"
              description="Start a new recording session to capture browser microphone audio and generate AI minutes."
              actionLabel="Start Meeting"
              onAction={() => setIsRecordingMode(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
