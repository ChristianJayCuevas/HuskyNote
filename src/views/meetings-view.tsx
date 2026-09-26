import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { MeetingRecorder } from '../components/meetings/meeting-recorder';
import { MeetingSummaryView } from '../components/meetings/meeting-summary-view';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { formatSecondsToTime } from '../services/audio/transcriber';
import { Mic, Plus, Calendar, Clock, ChevronRight } from 'lucide-react';

export const MeetingsView: React.FC = () => {
  const { activeMeetingId, setActiveMeetingId } = useWorkspace();
  const [isRecordingMode, setIsRecordingMode] = useState<boolean>(false);

  const meetings = useLiveQuery(() => db.meetings.orderBy('startTime').reverse().toArray(), []) || [];

  // Auto-select first meeting if available and none selected
  useEffect(() => {
    if (!activeMeetingId && !isRecordingMode && meetings.length > 0) {
      setActiveMeetingId(meetings[0].id);
    }
  }, [meetings, activeMeetingId, isRecordingMode, setActiveMeetingId]);

  // Listen to Topbar trigger
  useEffect(() => {
    const handleStartEvent = () => setIsRecordingMode(true);
    window.addEventListener('huskynote:start-meeting', handleStartEvent);
    return () => window.removeEventListener('huskynote:start-meeting', handleStartEvent);
  }, []);

  const selectedMeeting = meetings.find((m) => m.id === activeMeetingId);

  const isDetailOpen = Boolean(isRecordingMode || selectedMeeting);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-black transition-colors duration-500">
      {/* Left Sidebar: Sessions List */}
      <div
        className={`${
          isDetailOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 border-r border-slate-200 dark:border-zinc-850 flex-col h-full bg-white dark:bg-zinc-950 shrink-0 select-none transition-colors duration-500`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-zinc-850 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
            Meetings ({meetings.length})
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setIsRecordingMode(true);
              setActiveMeetingId(null);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-850">
          {meetings.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-500">
              No meetings recorded yet. Start your first session to record audio and build your
              timeline.
            </div>
          ) : (
            meetings.map((m) => {
              const isSelected = !isRecordingMode && activeMeetingId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setIsRecordingMode(false);
                    setActiveMeetingId(m.id);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-zinc-900/90 text-slate-950 dark:text-white border-l-2 border-slate-900 dark:border-white'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-900/40 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-slate-950 dark:text-zinc-100 truncate pr-2">
                      {m.title}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 font-medium">
                      {formatSecondsToTime(m.durationSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-zinc-500 mb-1.5 font-medium">
                    <span>{new Date(m.startTime).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{m.transcript.length} transcript segments</span>
                  </div>
                  {m.summary?.overview && (
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {m.summary.overview}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Content Area */}
      <div className={`${isDetailOpen ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0 flex-col`}>
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
          <div className="flex-1 flex items-center justify-center">
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
