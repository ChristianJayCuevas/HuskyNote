import React, { useEffect, useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import type { Meeting } from '../../types';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Disclosure } from '../ui/disclosure';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { PasteTranscriptCollector } from './paste-transcript-collector';
import { useExtensionTranscript } from '../../services/meetings/extension-transcript';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES } from '../../services/ai/active-provider';
import { ai } from '../../services/ai/active-provider';
import { importKindOf, type ImportedCue } from '../../services/meetings/transcript-import';
import { readTranscriptFile } from '../../services/meetings/meeting-import';
import { alignTranscripts, buildWindows, supplementTranscript, type Alignment } from '../../services/meetings/transcript-supplement';
import { saveSupplementedTranscript } from '../../services/meetings/supplement-store';

const clock = (seconds: number) => {
  const s = Math.round(Math.abs(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "+3:12" / "-0:45" -> seconds */
const parseOffset = (value: string): number | null => {
  const m = value.trim().match(/^([+-])?(\d+):(\d{1,2})$/);
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
};

interface SupplementTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  onDone: (message: string) => void;
}

/** Improve a meeting's transcript with the Teams transcript of the same meeting */
export const SupplementTranscriptDialog: React.FC<SupplementTranscriptDialogProps> = ({ open, onOpenChange, meeting, onDone }) => {
  const { isConnected, selectedModel, provider } = useAI();
  const providerName = PROVIDER_NAMES[provider];
  const [source, setSource] = useState<'file' | 'paste'>('file');
  const collected = useExtensionTranscript();
  const [file, setFile] = useState<File | null>(null);
  const [cues, setCues] = useState<ImportedCue[] | null>(null);
  const [pasted, setPasted] = useState<ImportedCue[]>([]);
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [offsetText, setOffsetText] = useState('+0:00');
  const [useAi, setUseAi] = useState(true);
  const [problem, setProblem] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource(collected ? 'paste' : 'file'); setFile(null); setCues(null); setPasted([]); setAlignment(null); setOffsetText('+0:00'); setProblem(''); setProgress(null);
    setUseAi(isConnected);
  }, [open]);

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return;
    setFile(chosen); setProblem(''); setCues(null); setAlignment(null);
    const kind = importKindOf(chosen);
    if (kind !== 'transcript-vtt' && kind !== 'transcript-docx') {
      setProblem('Choose the Teams transcript: a .vtt or .docx file from the meeting recap.');
      return;
    }
    try {
      // Raw Teams lines (not joined into turns) line up more precisely
      applyLines(await readTranscriptFile(chosen, { merge: false }));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  /** Use these Teams lines and line them up with this meeting */
  const applyLines = (lines: ImportedCue[]) => {
    setCues(lines.length ? lines : null);
    const found = lines.length ? alignTranscripts(meeting.transcript, lines) : null;
    setAlignment(found);
    const offset = found?.offsetSeconds ?? 0;
    setOffsetText(`${offset < 0 ? '-' : '+'}${clock(offset)}`);
  };

  const offsetSeconds = parseOffset(offsetText);
  const windows = cues && offsetSeconds !== null ? buildWindows(meeting.transcript, cues, offsetSeconds) : [];
  const aiRequests = windows.filter((w) => w.ours.length && w.teams.length).length;
  const speakers = cues ? [...new Set(cues.map((c) => c.speaker))] : [];
  const running = progress !== null;

  const run = async () => {
    if (!cues || offsetSeconds === null || (source === 'file' && !file)) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: windows.length });
    setProblem('');
    try {
      const generate = useAi && isConnected && selectedModel
        ? (prompt: string) => ai.generate(prompt, { model: selectedModel, temperature: 0.1 })
        : null;
      const result = await supplementTranscript(meeting.transcript, cues, offsetSeconds, generate, {
        idPrefix: `${meeting.id}-supplemented-${Date.now()}`,
        signal: controller.signal,
        concurrency: provider === 'ollama' ? 1 : 3,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      await saveSupplementedTranscript(meeting.id, result.transcript, {
        at: Date.now(), fileName: source === 'paste' ? 'the Teams transcript (pasted)' : file!.name, offsetSeconds, windows: result.windows,
        aiWindows: result.aiWindows, addedFromTeams: result.addedFromTeams,
      });
      onOpenChange(false);
      const parts = [`Transcript supplemented: ${result.transcript.length} lines with Teams speaker names`];
      if (result.aiWindows) parts.push(`${result.aiWindows} of ${result.windows} parts checked by ${providerName}`);
      if (result.fallbackWindows) parts.push(`${result.fallbackWindows} kept as recorded because the AI answer was unusable`);
      if (result.addedFromTeams) parts.push(`${result.addedFromTeams} lines filled in from Teams`);
      onDone(`${parts.join('; ')}. Regenerate the report to use it.`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!running) onOpenChange(next); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Supplement with the Teams transcript</DialogTitle>
          <DialogDescription>
            Combines this transcript with the one Teams made of the same meeting: Teams' speaker names, the better wording of the two, and
            Teams' lines for any time this recording missed. Your current transcript is kept, so you can restore it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={source}
            onValueChange={(value) => {
              if (!value || running) return;
              setSource(value as 'file' | 'paste');
              setProblem('');
              applyLines(value === 'paste' ? pasted : []);
              if (value === 'paste') setFile(null);
            }}
            aria-label="Where the Teams transcript comes from"
          >
            <ToggleGroupItem value="file">Transcript file</ToggleGroupItem>
            <ToggleGroupItem value="paste">Paste from Teams</ToggleGroupItem>
          </ToggleGroup>

          {source === 'paste' && (
            <PasteTranscriptCollector cues={pasted} disabled={running} onChange={(next) => { setPasted(next); applyLines(next); }} />
          )}

          <input ref={inputRef} type="file" className="sr-only" accept=".vtt,.docx" aria-label="Teams transcript file"
            onChange={(e) => void choose(e.target.files?.[0])} />
          {source === 'file' && <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void choose(e.dataTransfer.files?.[0]); }}
            disabled={running}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center transition-colors duration-100 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {file ? <FileText className="size-6 text-muted-foreground" /> : <Upload className="size-6 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">{file ? file.name : 'Choose or drop the Teams transcript'}</span>
            <span className="text-xs text-muted-foreground">.vtt or .docx, from the meeting's Recap › Transcript › Download</span>
          </button>}

          {problem && <Alert variant="destructive" role="alert"><AlertDescription>{problem}</AlertDescription></Alert>}

          {cues && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Teams transcript: {cues.length} lines from {speakers.length} {speakers.length === 1 ? 'speaker' : 'speakers'}
                {speakers.length ? ` (${speakers.slice(0, 4).join(', ')}${speakers.length > 4 ? '…' : ''})` : ''}.
              </p>
              {alignment ? (
                <p className="text-muted-foreground">
                  Lined up using {alignment.anchors} phrases found in both.{' '}
                  {Math.abs(alignment.offsetSeconds) < 1 ? 'Both start at the same time.'
                    : `Teams started recording ${clock(alignment.offsetSeconds)} ${alignment.offsetSeconds < 0 ? 'before' : 'after'} HuskyNote did.`}
                </p>
              ) : (
                <Alert variant="warning"><AlertDescription>
                  The two transcripts couldn't be lined up automatically (too few phrases in common). Check that this is the same meeting, or set the offset below.
                </AlertDescription></Alert>
              )}
              <Disclosure summary="Adjust the time offset">
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Seconds to add to Teams times" className="w-28" value={offsetText} onChange={(e) => setOffsetText(e.target.value)} />
                  <span className="text-xs text-muted-foreground">
                    Added to every Teams time, as +m:ss or -m:ss. Negative when Teams started recording before HuskyNote.
                  </span>
                </div>
              </Disclosure>
              <label className="flex items-start gap-2">
                <Checkbox className="mt-0.5" checked={useAi && isConnected} disabled={!isConnected || running} onCheckedChange={(v) => setUseAi(v === true)} />
                <span>
                  <span className="font-medium text-foreground">Correct the wording with {providerName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {isConnected
                      ? `${aiRequests} request${aiRequests === 1 ? '' : 's'} of about 3 minutes each; this meeting's transcript text is sent to ${providerName}.`
                      : `${providerName} isn't connected, so only speaker names and missing lines are taken from Teams.`}
                  </span>
                </span>
              </label>
            </div>
          )}

          {running && (
            <div role="status" className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Supplementing… {progress!.done} of {progress!.total} parts</p>
              <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress!.total ? (progress!.done / progress!.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {running
            ? <Button variant="outline" onClick={() => abortRef.current?.abort()}>Stop</Button>
            : <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
          <Button onClick={() => void run()} disabled={running || !cues || offsetSeconds === null || windows.length === 0}>
            Supplement transcript
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
