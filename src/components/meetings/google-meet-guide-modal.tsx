import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Radio, ShieldCheck } from 'lucide-react';

interface GoogleMeetGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTabCapture: () => void;
}

export const GoogleMeetGuideModal: React.FC<GoogleMeetGuideModalProps> = ({
  isOpen,
  onClose,
  onStartTabCapture,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Meet & Tab Capture"
      description="Standard browser privacy requirements for external meeting audio"
      maxWidth="lg"
    >
      <div className="space-y-5 text-sm leading-6 text-foreground">
        <Alert>
          <ShieldCheck />
          <AlertTitle>Browser Security Standard</AlertTitle>
          <AlertDescription>
            Web browsers intentionally prevent websites from silently capturing other browser tabs
            or system audio without explicit user permission. HuskyNote honors this privacy standard.
          </AlertDescription>
        </Alert>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Option 1: Browser Screen / Tab Share Audio (Immediate)</h4>
          <p className="text-muted-foreground">
            Click the button below to invoke the capture prompt. In a browser, select the <strong className="font-medium text-foreground">tab</strong> containing your Google Meet call and ensure <strong className="font-medium text-foreground">"Also share tab audio"</strong> is checked. In the HuskyNote desktop app, choose <strong className="font-medium text-foreground">Entire screen</strong> and turn on <strong className="font-medium text-foreground">"Share system audio"</strong>. Your microphone is mixed in automatically, and both sides are transcribed on this device.
          </p>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              onClose();
              onStartTabCapture();
            }}
          >
            <Radio />
            <span>Select Google Meet Tab</span>
          </Button>
        </section>

        <Separator />

        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Option 2: HuskyNote Browser Extension</h4>
          <p className="text-muted-foreground">
            Load the included Manifest V3 extension located at <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">/browser-extension</code> in <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">chrome://extensions</code> to display a one-click launcher directly inside your Google Meet calls.
          </p>
        </section>
      </div>
    </Modal>
  );
};
