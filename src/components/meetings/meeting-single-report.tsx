import React, { useMemo, useState } from 'react';
import type { Meeting } from '../../types';
import { formatSecondsToTime } from '../../services/audio/transcriber';
import { setActionItemDone } from '../../services/meetings/action-items';
import { Camera, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { SearchInput } from '../ui/input';
import { ScreenshotLightbox } from './screenshot-lightbox';
import { speakerColorMap, speakerDotClass } from './speaker-colors';

interface MeetingSingleReportProps {
  meeting: Meeting;
  onBack?: () => void;
  /** Buttons shown beside the Topics Discussed heading */
  topicsActions?: React.ReactNode;
}

/** A document section: h3 heading with an optional muted count and actions on the right */
const ReportSection: React.FC<{
  id: string;
  title: string;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, count, actions, description, children }) => (
  <section aria-labelledby={id} className="space-y-3">
    <div className="flex min-h-7 flex-wrap items-center gap-2">
      <h3 id={id} className="text-base font-semibold text-foreground">
        {title}
        {count !== undefined && <span className="font-normal text-muted-foreground"> ({count})</span>}
      </h3>
      {actions}
    </div>
    {description && <p className="-mt-2 text-xs text-muted-foreground">{description}</p>}
    {children}
  </section>
);

/**
 * MeetingSingleReport compiles the meeting's summary, decisions, action items, topics, notes,
 * screenshots and transcript into one document-style report.
 */
export const MeetingSingleReport: React.FC<MeetingSingleReportProps> = ({ meeting, onBack, topicsActions }) => {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const filteredTranscript = meeting.transcript.filter((s) =>
    transcriptSearch ? s.text.toLowerCase().includes(transcriptSearch.toLowerCase()) || s.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()) : true
  );
  const speakerColors = useMemo(() => speakerColorMap(meeting.transcript.map((s) => s.speaker)), [meeting.transcript]);

  const fullScreenshotsCount = meeting.screenshots?.filter((s) => s.type !== 'portion').length || 0;
  const portionSnipsCount = meeting.screenshots?.filter((s) => s.type === 'portion').length || 0;

  return (
    <div className="space-y-10 text-foreground">
      <ScreenshotLightbox src={lightboxImg} title="Screenshot Preview" alt="Screenshot Preview" onClose={() => setLightboxImg(null)} />

      {/* 1. Executive Summary */}
      <ReportSection id="report-summary" title="Executive Summary">
        <p className={cn('text-sm leading-6', !meeting.summary?.overview && 'text-muted-foreground')}>
          {meeting.summary?.overview ||
            'No summary available. Transcription segments recorded without offline AI synthesis.'}
        </p>
      </ReportSection>

      {/* 2. Key Decisions */}
      <ReportSection id="report-decisions" title="Key Decisions" count={meeting.summary?.decisions.length || 0}>
        {meeting.summary && meeting.summary.decisions.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-muted-foreground">
            {meeting.summary.decisions.map((decision, idx) => (
              <li key={idx} className="pl-1">{decision}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No formal decisions logged in this session.</p>
        )}
      </ReportSection>

      {/* 3. Action Items (ticking one off saves it, also on Home) */}
      <ReportSection id="report-actions" title="Action Items" count={meeting.summary?.actionItems.length || 0}>
        {meeting.summary && meeting.summary.actionItems.length > 0 ? (
          <ul className="-mx-2 space-y-px">
            {meeting.summary.actionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors duration-100 hover:bg-accent/60">
                <Checkbox
                  id={`report-action-${meeting.id}-${idx}`}
                  checked={Boolean(item.done)}
                  onCheckedChange={(checked) => void setActionItemDone(meeting.id, idx, checked === true)}
                  className="mt-1"
                />
                <label
                  htmlFor={`report-action-${meeting.id}-${idx}`}
                  className={cn('min-w-0 flex-1 cursor-pointer text-sm leading-6', item.done && 'text-muted-foreground line-through')}
                >
                  {item.task}
                </label>
                {item.owner && (
                  <Badge variant="secondary" className="mt-0.5 max-w-[40%] truncate">
                    @{item.owner}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No action items detected.</p>
        )}
      </ReportSection>

      {/* 4. Topics */}
      {(meeting.summary?.topics.length || 0) > 0 && (
        <ReportSection id="report-topics" title="Topics Discussed" actions={topicsActions}>
          <ul className="flex flex-wrap gap-1.5" aria-label="Discussion topics">
            {meeting.summary?.topics.map((t, idx) => (
              <li key={idx} className="max-w-full">
                <Badge variant="outline" className="h-auto max-w-full whitespace-normal break-words px-2 py-1 text-left font-normal leading-snug">
                  {t}
                </Badge>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {/* 5. Participant Notes */}
      {meeting.manualNotes?.trim() && (
        <ReportSection id="report-notes" title="Participant Notes">
          <div className="whitespace-pre-wrap rounded-lg bg-muted px-4 py-3 text-sm leading-6">
            {meeting.manualNotes}
          </div>
        </ReportSection>
      )}

      {/* 6. Screenshots (full screen + portion snips) */}
      {meeting.screenshots && meeting.screenshots.length > 0 && (
        <ReportSection
          id="report-screenshots"
          title="Screenshots"
          count={meeting.screenshots.length}
          description={`${meeting.screenshots.length} total (${fullScreenshotsCount} full, ${portionSnipsCount} snips) · Click any image to enlarge`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {meeting.screenshots.map((ss, idx) => {
              const isPortion = ss.type === 'portion';
              return (
                <button
                  key={ss.id}
                  type="button"
                  onClick={() => setLightboxImg(ss.dataUrl)}
                  className="group overflow-hidden rounded-md border bg-card text-left transition-colors duration-100 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="aspect-video w-full overflow-hidden border-b bg-muted">
                    <img src={ss.dataUrl} alt={ss.caption || `Artifact ${idx + 1}`} className="size-full object-cover" />
                  </div>
                  <div className="space-y-0.5 px-2.5 py-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {ss.caption || (isPortion ? `Portion Snip at ${formatSecondsToTime(ss.timestampSeconds)}` : `Full Snapshot at ${formatSecondsToTime(ss.timestampSeconds)}`)}
                    </p>
                    <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">{formatSecondsToTime(ss.timestampSeconds)}</span>
                      <span aria-hidden="true">·</span>
                      {isPortion ? <Crop className="size-3 shrink-0" aria-hidden="true" /> : <Camera className="size-3 shrink-0" aria-hidden="true" />}
                      <span>{isPortion ? 'Portion' : 'Full'}</span>
                    </p>
                    {ss.cropDimensions && (
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {ss.cropDimensions.width} × {ss.cropDimensions.height} px
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ReportSection>
      )}

      {/* 7. Complete transcript */}
      <ReportSection
        id="report-transcript"
        title="Transcript"
        count={`${meeting.transcript.length} segments`}
        actions={
          <SearchInput
            value={transcriptSearch}
            onChange={(e) => setTranscriptSearch(e.target.value)}
            onClear={() => setTranscriptSearch('')}
            placeholder="Search transcript..."
            containerClassName="w-full sm:ml-auto sm:w-56"
            className="h-7"
          />
        }
      >
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          {filteredTranscript.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {transcriptSearch ? 'No segments match your search query.' : 'No verbal transcript recorded.'}
            </p>
          ) : (
            <ol className="divide-y">
              {filteredTranscript.map((seg) => (
                <li key={seg.id} className="grid grid-cols-[auto_1fr] gap-x-3 px-3 py-2.5">
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatSecondsToTime(seg.timestampSeconds)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', speakerDotClass(speakerColors, seg.speaker))} />
                      {seg.speaker}
                    </p>
                    <p className="mt-0.5 text-sm leading-6">{seg.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </ReportSection>

      {/* Footer */}
      <footer className="border-t pb-4 pt-6 text-xs text-muted-foreground">
        <span>Generated by HuskyNote</span>
      </footer>
    </div>
  );
};
