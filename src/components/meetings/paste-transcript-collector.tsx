import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { parsePastedTranscript, stitchCues, type ImportedCue } from '../../services/meetings/transcript-import';
import { collectedAgo, useExtensionTranscript } from '../../services/meetings/extension-transcript';

const clock = (seconds: number) => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

interface PasteTranscriptCollectorProps {
  cues: ImportedCue[];
  onChange: (cues: ImportedCue[]) => void;
  disabled?: boolean;
}

/**
 * Collect a Teams transcript copied a screenful at a time. Teams only keeps the
 * lines on screen loaded, so one long selection gets cut off; each paste here
 * is added to the rest, in time order, with overlapping lines kept once.
 */
export const PasteTranscriptCollector: React.FC<PasteTranscriptCollectorProps> = ({ cues, onChange, disabled }) => {
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const collected = useExtensionTranscript();

  const addText = (text: string) => {
    const parsed = parsePastedTranscript(text);
    if (!parsed.length) {
      setIsError(true);
      setMessage('No transcript lines found in that paste. Start the selection at a speaker name so the name and time are included.');
      return;
    }
    const next = stitchCues(cues, parsed);
    const added = next.length - cues.length;
    onChange(next);
    setIsError(false);
    setMessage(added > 0 ? `Added ${added} line${added === 1 ? '' : 's'}. Scroll down in Teams, copy the next part and paste again.` : 'Those lines were already here. Scroll further in Teams for new ones.');
  };

  const speakers = new Set(cues.map((c) => c.speaker)).size;

  return (
    <div className="space-y-2">
      {collected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="min-w-0 text-foreground">
            Collected by the HuskyNote extension: {collected.lines} lines from {collected.speakers.length} {collected.speakers.length === 1 ? 'speaker' : 'speakers'}
            <span className="text-muted-foreground"> · {collectedAgo(collected.collectedAt)}{collected.partial ? ' · stopped early' : ''}</span>
          </span>
          <Button
            size="xs"
            variant="default"
            disabled={disabled}
            onClick={() => {
              onChange(stitchCues([], parsePastedTranscript(collected.vtt)));
              setIsError(false);
              setMessage('Using the transcript collected by the extension.');
            }}
          >
            Use it
          </Button>
        </div>
      )}
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>In Teams, open the meeting's transcript and select from a speaker's name down to the bottom of the screen.</li>
        <li>Copy (Ctrl+C) and paste (Ctrl+V) into the box below.</li>
        <li>Scroll down in Teams and repeat until the end. Overlapping is fine; repeated lines are kept once.</li>
      </ol>
      <Textarea
        aria-label="Paste the Teams transcript here"
        placeholder="Paste here (Ctrl+V)…"
        rows={4}
        disabled={disabled}
        value=""
        onChange={() => {}}
        onPaste={(e) => {
          e.preventDefault();
          addText(e.clipboardData.getData('text/plain'));
        }}
        className="resize-none"
      />
      {message && <p className={isError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} role="status">{message}</p>}
      {cues.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
          <span className="text-foreground">
            {cues.length} lines from {speakers} {speakers === 1 ? 'speaker' : 'speakers'} · {clock(cues[0].startSeconds)} – {clock(cues[cues.length - 1].startSeconds)}
          </span>
          <Button size="xs" variant="ghost" disabled={disabled} onClick={() => { onChange([]); setMessage(''); }}>Start over</Button>
        </div>
      )}
    </div>
  );
};
