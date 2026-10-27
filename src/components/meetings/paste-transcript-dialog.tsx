import React, { useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { PasteTranscriptField } from './paste-transcript-field';
import { addPastedTranscript } from '../../services/meetings/meeting-import';

interface PasteTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  onDone: (message: string) => void;
}

/** Give a meeting without a transcript one pasted from another app */
export const PasteTranscriptDialog: React.FC<PasteTranscriptDialogProps> = ({ open, onOpenChange, meetingId, onDone }) => {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setText(''); setProblem(''); setBusy(false); }
  }, [open]);

  const save = async () => {
    setBusy(true);
    try {
      const turns = await addPastedTranscript(meetingId, text);
      onOpenChange(false);
      onDone(`Transcript saved: ${turns} speaker ${turns === 1 ? 'turn' : 'turns'}. Generate a report from it.`);
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
          <DialogTitle>Paste a transcript</DialogTitle>
          <DialogDescription>
            Add this meeting's transcript from another app. It is saved like a recorded transcript, so reports, action items and search use it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <PasteTranscriptField id="paste-transcript-text" value={text} onChange={(value) => { setText(value); setProblem(''); }} disabled={busy} />
          {problem && <Alert variant="destructive" role="alert"><AlertDescription>{problem}</AlertDescription></Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !text.trim()}>Save transcript</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
