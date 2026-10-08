import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listRecordings, deleteRecording, getRecordingAudio, type RecordingEntry } from '../../services/audio/recording-storage';
import { processMeetingJobs, pauseMeetingTranscription } from '../../services/audio/speech-jobs';
import { activeRecordingIds } from '../../services/audio/recorder';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { SearchInput } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useWorkspace } from '../../context/workspace-context';

const sizeLabel = (bytes: number) => bytes < 1024 * 1024
  ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function RecordingRow({ entry, onOpen }: { entry: RecordingEntry; onOpen: (id: string) => void }) {
  const { addToast } = useWorkspace();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const load = async () => {
    setLoading(true);
    try {
      const audio = await getRecordingAudio(entry.id);
      if (!mounted.current) return;
      setUrl(URL.createObjectURL(audio));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not open recording.', 'error');
    } finally { setLoading(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Permanently delete audio and pending transcription for "${entry.title}" (${sizeLabel(entry.size + (entry.processingBytes ?? 0))})? Existing transcript, notes, and summary will be kept. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteRecording(entry.id);
      addToast('Recording audio deleted. Meeting text was kept.', 'success');
    } catch {
      addToast('Could not delete recording. Please try again.', 'error');
      setDeleting(false);
    }
  };
  const resume = async () => {
    if (!entry.meetingId) return;
    setProcessing(true);
    try {
      await processMeetingJobs(entry.meetingId, undefined, true);
      const pending = await db.speechJobs.where('meetingId').equals(entry.meetingId).count();
      addToast(pending ? 'Some phrases remain pending. Check transcription setup and retry.' : 'Transcription completed.', pending ? 'warning' : 'success');
    } catch { addToast('Could not resume transcription. Your saved audio was kept.', 'error'); }
    finally { if (mounted.current) setProcessing(false); }
  };
  const extension = entry.mimeType.includes('mp4') ? 'm4a' : entry.mimeType.includes('ogg') ? 'ogg'
    : entry.mimeType.includes('wav') ? 'wav' : entry.mimeType.includes('mpeg') ? 'mp3' : 'webm';
  return <>
    <TableRow className={url ? 'border-b-0' : undefined}>
      <TableCell className="min-w-0 py-3 align-top">
        <p className="text-sm font-medium text-foreground">{entry.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString()}
          {entry.durationSeconds !== undefined && ` · ${Math.floor(entry.durationSeconds / 60)}m ${entry.durationSeconds % 60}s`}
          <span className="sm:hidden"> · {sizeLabel(entry.size)}</span>
        </p>
        {(!entry.meetingId || entry.partial || !!entry.pendingJobs) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {!entry.meetingId && <Badge variant="outline">No linked meeting</Badge>}
            {entry.partial && <Badge variant="warning">Interrupted / unfinished recording</Badge>}
            {!!entry.pendingJobs && <Badge variant="secondary">{entry.pendingJobs} phrases pending ({sizeLabel(entry.processingBytes ?? 0)})</Badge>}
          </div>
        )}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap py-3 text-right align-top text-sm tabular-nums text-muted-foreground sm:table-cell">
        {sizeLabel(entry.size)}
      </TableCell>
      <TableCell className="py-3 align-top">
        <div className="flex flex-wrap justify-end gap-1.5">
          {!url && <Button size="sm" variant="outline" disabled={loading || deleting} onClick={load}>{loading ? 'Opening…' : 'Play / download'}</Button>}
          {entry.meetingId && <Button size="sm" variant="outline" onClick={() => onOpen(entry.meetingId!)}>Open meeting</Button>}
          {!!entry.pendingJobs && !processing && <Button size="sm" variant="outline" disabled={activeRecordingIds.has(entry.id)} onClick={resume}>Resume transcription</Button>}
          {processing && <Button size="sm" variant="outline" onClick={() => {
            if (entry.meetingId) pauseMeetingTranscription(entry.meetingId);
          }}>Finish later</Button>}
          <Button size="sm" variant="outline" className="hover:bg-destructive/10 hover:text-destructive" disabled={deleting || activeRecordingIds.has(entry.id)} onClick={remove}>{deleting ? 'Deleting…' : 'Delete audio'}</Button>
        </div>
      </TableCell>
    </TableRow>
    {url && (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={3} className="space-y-2 pb-4 pt-0">
          {entry.partial && <p className="text-xs text-muted-foreground">Interrupted audio may not play in every browser. Download it for recovery if playback fails.</p>}
          <audio controls preload="metadata" src={url} className="w-full" aria-label={`Recording: ${entry.title}`} />
          <a href={url} download={`recording-${entry.id}.${extension}`} className="inline-block text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground">Download audio</a>
        </TableCell>
      </TableRow>
    )}
  </>;
}

export function RecordingsLibrary({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const result = useLiveQuery(async () => {
    try { return { entries: await listRecordings(), error: false }; }
    catch { return { entries: [], error: true }; }
  }, []);
  const entries = result?.entries ?? [];
  const filtered = entries.filter((r) => `${r.title} ${new Date(r.createdAt).toLocaleDateString()}`.toLowerCase().includes(query.toLowerCase()));
  return <Modal isOpen onClose={onClose} title="Recordings & storage" maxWidth="4xl"
    description="Audio stored on this device in the current profile. Deleting audio keeps your meeting text.">
    <div className="space-y-3 text-foreground">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums" role="status">{result ? `${entries.length} recordings · ${sizeLabel(entries.reduce((sum, r) => sum + r.size + (r.processingBytes ?? 0), 0))} including pending speech` : 'Loading recordings…'}</p>
        <SearchInput data-dialog-autofocus aria-label="Search recordings by title or date" placeholder="Search title or date…" value={query}
          onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} containerClassName="sm:w-64" />
      </div>
      {result?.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="text-destructive">Could not read recordings. Close this window and try again.</AlertDescription>
        </Alert>
      )}
      {result && !result.error && filtered.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{query ? 'No matching recordings.' : 'No saved audio in this profile.'}</p>
      )}
      {filtered.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recording</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{filtered.map((entry) => <RecordingRow key={entry.id} entry={entry} onOpen={onOpen} />)}</TableBody>
          </Table>
        </div>
      )}
    </div>
  </Modal>;
}
