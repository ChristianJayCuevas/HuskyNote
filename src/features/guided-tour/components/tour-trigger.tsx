import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { startTour } from '../state/active-tour-store';
import type { TourId } from '../tours/registry';

export interface TourTriggerProps {
  tourId: TourId;
  /** Label; defaults to "Take me for a tour" in the app's language. */
  children?: ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

/**
 * Button that starts a registered tour manually. Flag-agnostic: gate where it is rendered.
 * Focuses itself first: Safari/Firefox on macOS do not focus a button on click, and the tour's
 * focus trap returns focus to whatever was focused when it opened.
 */
export function TourTrigger({ tourId, children, variant = 'ghost', size, className }: TourTriggerProps) {
  const { t } = useLanguage();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        event.currentTarget.focus({ preventScroll: true });
        startTour(tourId, { source: 'manual' });
      }}
    >
      {children ?? t('tour.trigger')}
    </Button>
  );
}
