/**
 * ScreenshotLightbox: full-size preview of a meeting screenshot in a Dialog (size 6xl).
 * Closes with Escape, the close button or a click outside; focus returns to the thumbnail.
 */
import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';

interface ScreenshotLightboxProps {
  /** Image to show; null keeps the dialog closed */
  src: string | null;
  /** Dialog name, shown above the image */
  title: string;
  alt: string;
  onClose: () => void;
}

export const ScreenshotLightbox: React.FC<ScreenshotLightboxProps> = ({ src, title, alt, onClose }) => (
  <Dialog open={!!src} onOpenChange={(open) => !open && onClose()}>
    <DialogContent size="6xl" className="gap-3 p-3" aria-describedby={undefined}>
      <DialogTitle className="truncate px-1 pr-10 text-sm font-medium leading-7">{title}</DialogTitle>
      {src && (
        // design-exception: screenshots are shown on a black stage in both themes, like other media
        <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-md bg-black">
          <img src={src} alt={alt} className="max-h-[75vh] w-auto max-w-full object-contain" />
        </div>
      )}
    </DialogContent>
  </Dialog>
);
