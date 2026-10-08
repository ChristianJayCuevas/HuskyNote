import React, { useState } from 'react';
import { useWorkspace } from '../../context/workspace-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Disclosure } from '../ui/disclosure';
import {
  CloudOff,
  Download,
  Copy,
  Check,
  X,
  Terminal,
  Shield,
} from 'lucide-react';
import { GithubIcon } from '../ui/github-icon';

interface CloudEnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudEnvironmentModal: React.FC<CloudEnvironmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { setActiveView, isCloudHost } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const cloneCommand = 'git clone https://github.com/ChristianJayCuevas/HuskyNote.git && cd HuskyNote && ./start.sh';

  const handleCopy = () => {
    navigator.clipboard.writeText(cloneCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    onClose();
    if (isCloudHost) {
      setActiveView('landing');
    }
  };

  const handleGoToLanding = () => {
    onClose();
    setActiveView('landing');
  };

  const handleGoToDownload = () => {
    onClose();
    setActiveView('download');
  };

  return (
    // Escape and the overlay close the dialog the same way as the close button
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="xl" hideClose aria-describedby="cloud-environment-description">
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 text-muted-foreground"
            title="Close and return to landing page"
            aria-label="Close"
          >
            <X />
          </Button>
        </DialogClose>

        {/* Header */}
        <DialogHeader className="flex-row items-start gap-4 space-y-0">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <CloudOff className="size-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Badge variant="secondary">Viewing the hosted website</Badge>
            <DialogTitle className="text-lg">The desktop app is required</DialogTitle>
            <DialogDescription id="cloud-environment-description">
              HuskyNote is a private app that runs on your own computer.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Explanation */}
        <Alert>
          <Shield />
          <AlertTitle>Why is the workspace unavailable here?</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              A website cannot reach the AI running on your computer, keep your recordings and notes on your device, or record meeting audio without sending it to someone else's servers. The desktop app does all of this privately.
            </p>
            <Disclosure summary="Details" contentClassName="pt-1">
              <p className="leading-relaxed text-muted-foreground">
                Hosted servers cannot connect to a local Ollama instance (<code className="font-mono text-xs">localhost:11434</code>) or to the
                browser storage where HuskyNote keeps audio and notes.
              </p>
            </Disclosure>
          </AlertDescription>
        </Alert>

        {/* Quick start command */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Terminal className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Run it on your computer</span>
            </span>
            <Button variant="ghost" size="xs" className="-mr-1 text-muted-foreground" onClick={handleCopy}>
              {copied ? <Check className="text-success" /> : <Copy />}
              <span>{copied ? 'Copied command' : 'Copy command'}</span>
            </Button>
          </div>
          <code className="block whitespace-pre-wrap break-words rounded-md border bg-muted px-3 py-2.5 font-mono text-xs leading-5 text-foreground">
            {cloneCommand}
          </code>
        </div>

        {/* Actions */}
        <DialogFooter className="items-stretch gap-2 pt-2 sm:items-center sm:justify-between">
          <Button variant="outline" size="sm" asChild>
            <a href="https://github.com/ChristianJayCuevas/HuskyNote" target="_blank" rel="noopener noreferrer">
              <GithubIcon className="size-4" />
              <span>GitHub Repository</span>
            </a>
          </Button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" size="sm" onClick={handleGoToLanding}>
              <span>Back to Landing Page</span>
            </Button>
            <Button variant="default" size="sm" onClick={handleGoToDownload}>
              <Download />
              <span>Download Desktop App</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
