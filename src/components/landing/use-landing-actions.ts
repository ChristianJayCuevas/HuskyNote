import { useCallback, useMemo } from 'react';
import type React from 'react';
import { useWorkspace, type ViewType } from '../../context/workspace-context';
import { isDesktopShell } from '../../services/environment';
import { detectOS, getCtas, type Cta, type LandingOS } from './cta';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function currentOS(): LandingOS {
  if (typeof navigator === 'undefined') return 'unknown';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOS(nav.userAgent, nav.userAgentData?.platform || nav.platform || '');
}

/** Scrolls the landing (which scrolls inside AppLayout's <main>) to a section and moves focus there. */
export function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
}

/** Click handler for in-page links that keep a real href="#id" but scroll without touching the URL. */
export function sectionLink(id: string, after?: () => void) {
  return (event: React.MouseEvent) => {
    event.preventDefault();
    after?.();
    scrollToSection(id);
  };
}

export function useLandingActions() {
  const { setActiveView, setIsExtensionModalOpen, isCloudHost } = useWorkspace();
  const isDesktop = useMemo(() => isDesktopShell(), []);
  const os = useMemo(() => currentOS(), []);
  const ctas = useMemo(() => getCtas({ isCloudHost, isDesktop, os }), [isCloudHost, isDesktop, os]);

  const goTo = useCallback(
    (view: ViewType) => {
      setActiveView(view);
      document.querySelector('main')?.scrollTo({ top: 0 });
    },
    [setActiveView]
  );

  const runCta = useCallback(
    (cta: Cta) => {
      if (cta.action === 'open-app') goTo('dashboard');
      else if (cta.action === 'how-it-works') scrollToSection('how-it-works');
      else goTo('download');
    },
    [goTo]
  );

  const openExtension = useCallback(() => setIsExtensionModalOpen(true), [setIsExtensionModalOpen]);

  return { goTo, runCta, openExtension, ctas, os, isCloudHost, isDesktop };
}

export type LandingActions = ReturnType<typeof useLandingActions>;
