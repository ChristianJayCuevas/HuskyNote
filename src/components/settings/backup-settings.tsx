import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import { exportBackup, inspectBackup, restoreBackup, type BackupPreview } from '../../services/backup/archive';
import { activeRecordingIds } from '../../services/audio/recorder';
import { getActiveProfile } from '../../services/profiles';

export function BackupSettings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [download, setDownload] = useState('');
  const [preview, setPreview] = useState<BackupPreview>();
  const [name, setName] = useState('');
  const [storage, setStorage] = useState('');
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  useEffect(() => {
    let mounted = true;
    void Promise.allSettled([
      Promise.resolve().then(() => navigator.storage?.estimate?.()),
      Promise.resolve().then(() => navigator.storage?.persisted?.()),
    ]).then(([estimateResult, persistenceResult]) => {
      if (!mounted) return;
      const estimate = estimateResult.status === 'fulfilled' ? estimateResult.value : undefined;
      const persistent = persistenceResult.status === 'fulfilled' ? persistenceResult.value : undefined;
      const usage = Number.isFinite(estimate?.usage) ? `${((estimate!.usage!) / 1048576).toFixed(1)} MiB used` : 'Usage estimate unavailable';
      const quota = Number.isFinite(estimate?.quota) ? ` of ${(estimate!.quota! / 1048576).toFixed(0)} MiB estimated quota` : '; quota estimate unavailable';
      const persistence = persistent === true ? 'Persistent storage granted.' : persistent === false ? 'Storage may be evicted; keep an external backup.' : 'Persistence status unavailable; keep an external backup.';
      setStorage(`${usage}${quota}. ${persistence}`);
    });
    return () => { mounted = false; };
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try {
      if (activeRecordingIds.size) throw new Error('Stop the active recording before backup or restore.');
      await action();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold leading-snug">Portable backup & recovery</h3>
        <CardDescription className="leading-relaxed">
          Back up the active profile ({getActiveProfile().name}), including recordings, PDFs, screenshots, note history, and pending transcription. The same .huskybackup file can be imported in the Windows app, macOS app, or web app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p>{storage} Browser estimates may include model caches and other profiles.</p>
          <p>Stop capture and allow edits to save first. Back up other profiles separately. API keys, service URLs, calendar connections, device preferences, and downloaded models are excluded. Files are not encrypted. Maximum archive size: 512 MiB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" disabled={busy} onClick={() => void run(async () => {
            setDownload(''); const blob = await exportBackup(); setDownload(URL.createObjectURL(blob));
            setMessage('Backup prepared. Save it outside app storage, then verify it using Choose backup.');
          })}>Prepare complete backup</Button>
          {download && (
            <Button variant="outline" size="sm" asChild>
              <a href={download} download={`huskynote-${new Date().toISOString().slice(0, 10)}.huskybackup`}>
                <Download />
                Save backup file
              </a>
            </Button>
          )}
        </div>
        <div className="space-y-3 border-t pt-4">
          <label className="grid gap-1.5 text-sm font-medium">Choose backup to verify and restore
            <Input className="cursor-pointer font-normal text-muted-foreground file:mr-3 file:cursor-pointer file:text-foreground" type="file" accept=".huskybackup,.json" disabled={busy} onChange={(event) => {
              const file = event.target.files?.[0]; event.target.value = ''; setPreview(undefined);
              if (file) void run(async () => {
                const result = await inspectBackup(file); setPreview(result);
                setName(`${result.profileName.slice(0, 22)} restored`); setMessage('Integrity and references verified. Review before restoring.');
              });
            }} />
          </label>
          {preview && (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium">Source: {preview.profileName} · {preview.createdAt} · {(preview.bytes / 1048576).toFixed(1)} MiB</p>
                <p className="text-xs text-muted-foreground">{Object.entries(preview.counts).map(([key, count]) => `${key}: ${count}`).join(' · ')}</p>
                {preview.warnings.map((warning) => <p className="text-xs text-warning" key={warning}>{warning}</p>)}
              </div>
              <label className="grid max-w-xs gap-1.5 text-sm font-medium">New profile name <Input className="font-normal" value={name} maxLength={40} disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
              <p className="text-xs text-muted-foreground">Restore creates a separate profile. Existing profiles are never merged or overwritten.</p>
              <Button variant="default" size="sm" disabled={busy} onClick={() => void run(async () => {
                const profile = await restoreBackup(preview, name); setPreview(undefined);
                setMessage(`Restored to “${profile.name}”. Reload the app, then select it in the profile menu. Your current profile is unchanged.`);
              })}>Restore into new profile</Button>
            </div>
          )}
        </div>
        <p role="status" className="text-sm text-muted-foreground empty:!mt-0">{busy ? 'Working locally; keep this window open…' : message}</p>
      </CardContent>
    </Card>
  );
}
