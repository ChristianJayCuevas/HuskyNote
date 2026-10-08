import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileAudio, FileText, Upload } from 'lucide-react';
import { db } from '../../db';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Field } from '../ui/field';
import { NativeSelect } from '../ui/native-select';
import { Alert, AlertDescription } from '../ui/alert';
import { Disclosure } from '../ui/disclosure';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { PasteTranscriptCollector } from './paste-transcript-collector';
import { useExtensionTranscript } from '../../services/meetings/extension-transcript';
import { SUPPORTED_LANGUAGES } from '../../services/ai/translation';
import { importKindOf, type ImportedCue } from '../../services/meetings/transcript-import';
import { importTranscriptCues, importTranscriptFile, readTranscriptFile, startRecordingImport } from '../../services/meetings/meeting-import';

const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const sizeOf = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
  : bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface ImportMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (meetingId: string) => void;
  onStarted: () => void;
  onError: (message: string) => void;
}

/** Import a Teams (or other) meeting from its transcript file or its recording */
export const ImportMeetingDialog: React.FC<ImportMeetingDialogProps> = ({ open, onOpenChange, onImported, onStarted, onError }) => {
  const settings = useLiveQuery(() => db.settings.get('current'), []);
  const [source, setSource] = useState<'file' | 'paste'>('file');
  const collected = useExtensionTranscript();
  const [pasted, setPasted] = useState<ImportedCue[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [language, setLanguage] = useState('auto');
  const [preview, setPreview] = useState<ImportedCue[] | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSource(collected ? 'paste' : 'file'); setPasted([]); setFile(null); setTitle(''); setWhen(''); setPreview(null); setProblem(''); setBusy(false);
  }, [open]);
  useEffect(() => { if (settings?.speechLanguage) setLanguage(settings.speechLanguage); }, [settings?.speechLanguage, open]);

  const kind = file ? importKindOf(file) : null;
  const isTranscript = kind === 'transcript-vtt' || kind === 'transcript-docx';

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return;
    setFile(chosen);
    setProblem('');
    setPreview(null);
    setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
    setWhen(toLocalInput(chosen.lastModified || Date.now()));
    const chosenKind = importKindOf(chosen);
    if (chosenKind === 'unsupported') setProblem('Choose a transcript (.vtt or .docx) or a recording (.mp4, .m4a, .mp3, .wav, .webm).');
    if (chosenKind === 'transcript-vtt' || chosenKind === 'transcript-docx') {
      try { setPreview(await readTranscriptFile(chosen)); }
      catch (error) { setProblem(error instanceof Error ? error.message : String(error)); }
    }
  };

  const speakers = preview ? [...new Set(preview.map((c) => c.speaker))] : [];
  const startTime = when ? new Date(when).getTime() : Date.now();

  const handleImport = async () => {
    if (source === 'paste') {
      setBusy(true);
      try {
        const id = await importTranscriptCues(pasted, { title: title || 'Teams meeting', startTime });
        onOpenChange(false);
        onImported(id);
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!file) return;
    setBusy(true);
    try {
      if (isTranscript) {
        const id = await importTranscriptFile(file, { title, startTime });
        onOpenChange(false);
        onImported(id);
      } else {
        // Runs in the background; progress shows above the meetings list
        const job = startRecordingImport(file, { title, startTime, language });
        onStarted();
        onOpenChange(false);
        job.then(onImported).catch((error) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) onError(error instanceof Error ? error.message : String(error));
        });
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import a meeting</DialogTitle>
          <DialogDescription>
            Bring in a Teams meeting from its recap: the transcript file keeps Teams' speaker names, or the recording is transcribed on this computer.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={source}
            onValueChange={(value) => {
              if (!value || busy) return;
              setSource(value as 'file' | 'paste');
              setProblem('');
              if (value === 'paste' && !when) { setWhen(toLocalInput(Date.now())); setTitle('Teams meeting'); }
            }}
            aria-label="Import from"
          >
            <ToggleGroupItem value="file">File</ToggleGroupItem>
            <ToggleGroupItem value="paste">Paste Teams transcript</ToggleGroupItem>
          </ToggleGroup>

          {source === 'paste' && <PasteTranscriptCollector cues={pasted} onChange={setPasted} disabled={busy} />}

          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".vtt,.docx,.mp4,.m4a,.m4v,.mov,.mp3,.wav,.webm,.ogg,.opus,.aac,.flac,audio/*,video/*"
            onChange={(e) => void choose(e.target.files?.[0])}
            aria-label="Transcript or recording file"
          />
          {source === 'file' && <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void choose(e.dataTransfer.files?.[0]); }}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors duration-100 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {file ? (isTranscript ? <FileText className="size-6 text-muted-foreground" /> : <FileAudio className="size-6 text-muted-foreground" />) : <Upload className="size-6 text-muted-foreground" />}
            <span className="text-sm font-medium text-foreground">{file ? file.name : 'Choose or drop a file'}</span>
            <span className="text-xs text-muted-foreground">
              {file ? `${sizeOf(file.size)} · ${isTranscript ? 'transcript' : kind === 'recording' ? 'recording' : 'not supported'}` : 'Transcript: .vtt or .docx · Recording: .mp4, .m4a, .mp3, .wav, .webm'}
            </span>
          </button>}

          {problem && <Alert variant="destructive" role="alert"><AlertDescription>{problem}</AlertDescription></Alert>}

          {source === 'file' && preview && (
            <p className="text-sm text-muted-foreground" role="status">
              {preview.length} speaker turns from {speakers.length} {speakers.length === 1 ? 'speaker' : 'speakers'}
              {speakers.length ? `: ${speakers.slice(0, 5).join(', ')}${speakers.length > 5 ? '…' : ''}` : ''}.
            </p>
          )}

          {((source === 'file' && file && kind !== 'unsupported' && !problem) || (source === 'paste' && pasted.length > 0)) && (
            <>
              <Field label="Title" htmlFor="import-title">
                <Input id="import-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Meeting date and time" htmlFor="import-when">
                  <Input id="import-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </Field>
                {source === 'file' && kind === 'recording' && (
                  <Field label="Spoken language" htmlFor="import-language">
                    <NativeSelect id="import-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                      {SUPPORTED_LANGUAGES.map((l) => <option key={l.bcp47} value={l.bcp47}>{l.name}</option>)}
                    </NativeSelect>
                  </Field>
                )}
              </div>
              {source === 'file' && kind === 'recording' && (
                <p className="text-xs text-muted-foreground">
                  Transcribed on this computer, a window at a time; it keeps running if you switch pages, and the transcript is saved as it grows.
                  Speaker names aren't detected from a recording; import the Teams transcript for those.
                </p>
              )}
            </>
          )}

          <Disclosure summary="Where to find these files in Teams">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open the meeting in your Teams calendar or chat and choose <span className="font-medium text-foreground">Recap</span>.</li>
              <li>Transcript: open <span className="font-medium text-foreground">Transcript</span>, then <span className="font-medium text-foreground">Download</span> and pick .vtt or .docx.</li>
              <li>Recording: on the recording, choose <span className="font-medium text-foreground">⋯ › Download</span>, or find it in the organizer's OneDrive or the channel's SharePoint <span className="font-medium text-foreground">Recordings</span> folder. Download only works if the organizer allows it.</li>
            </ol>
          </Disclosure>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            onClick={() => void handleImport()}
            disabled={busy || (source === 'paste' ? pasted.length === 0 : !file || kind === 'unsupported' || Boolean(problem))}
          >
            {source === 'paste' || isTranscript ? 'Import transcript' : 'Transcribe recording'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
