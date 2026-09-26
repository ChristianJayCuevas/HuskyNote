import React from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Radio, ExternalLink, ShieldCheck } from 'lucide-react';

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
      <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-zinc-100 mb-1">Browser Security Standard</div>
            <p className="text-zinc-400">
              Web browsers intentionally prevent websites from silently capturing other browser tabs
              or system audio without explicit user permission. HuskyNote honors this privacy standard.
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-zinc-200 mb-2">Option 1: Browser Screen / Tab Share Audio (Immediate)</h4>
          <p className="text-zinc-400 mb-2">
            Click the button below to invoke the capture prompt. In a browser, select the <strong>tab</strong> containing your Google Meet call and ensure <strong>"Also share tab audio"</strong> is checked. In the HuskyNote desktop app, choose <strong>Entire screen</strong> and turn on <strong>"Share system audio"</strong>. Your microphone is mixed in automatically, and both sides are transcribed on this device.
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onClose();
              onStartTabCapture();
            }}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Select Google Meet Tab</span>
          </Button>
        </div>

        <div className="pt-2 border-t border-zinc-850">
          <h4 className="font-semibold text-zinc-200 mb-1">Option 2: HuskyNote Browser Extension</h4>
          <p className="text-zinc-400 mb-2">
            Load the included Manifest V3 extension located at <code>/browser-extension</code> in <code>chrome://extensions</code> to display a one-click launcher directly inside your Google Meet calls.
          </p>
        </div>
      </div>
    </Modal>
  );
};
