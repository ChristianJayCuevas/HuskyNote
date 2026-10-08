import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { HuskyLogo } from '../../brand';
import { useTheme } from '../../context/theme-context';
import { GithubIcon } from '../ui/github-icon';
import type { LandingCopy } from './copy';
import { HERO_TITLE_ID } from './hero-section';
import { GITHUB_PUBLIC, GITHUB_URL } from './links';
import { Container, LButton } from './primitives';
import { sectionLink, type LandingActions } from './use-landing-actions';

const LINKS = [
  { id: 'features', key: 'features' },
  { id: 'privacy', key: 'privacy' },
  { id: 'faq', key: 'faq' },
  { id: 'download', key: 'download' },
] as const;

const PANEL_ID = 'hl-mobile-menu';

export const LandingNav: React.FC<{ copy: LandingCopy['nav']; actions: LandingActions }> = ({ copy, actions }) => {
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) close(false);
    };
    const wide = window.matchMedia('(min-width: 768px)');
    const onWide = () => {
      if (wide.matches) close(headerRef.current?.contains(document.activeElement) ?? false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    wide.addEventListener?.('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      wide.removeEventListener?.('change', onWide);
    };
  }, [open, close]);

  const onTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  const backToTop = () => {
    setOpen(false);
    const main = document.querySelector('main');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    main?.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById(HERO_TITLE_ID)?.focus({ preventScroll: true });
  };

  const ctaLabel = actions.ctas.nav.action === 'download' ? copy.downloadCta : copy.openApp;
  const runNavCta = () => {
    setOpen(false);
    actions.runCta(actions.ctas.nav);
  };

  return (
    <header ref={headerRef} className="hl-nav sticky top-0 z-40">
      <Container className="flex h-[60px] items-center justify-between gap-4">
        <button type="button" onClick={backToTop} aria-label={copy.home} className="hl-ink -ml-1.5 inline-flex h-10 items-center rounded-[8px] px-1.5">
          <HuskyLogo size="md" title="" />
        </button>

        <nav aria-label={copy.label} className="hidden md:block">
          <ul className="m-0 flex list-none items-center gap-1 p-0">
            {LINKS.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} className="hl-navlink" onClick={sectionLink(link.id)}>
                  {copy[link.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          {GITHUB_PUBLIC && (
            <span className="hidden md:block">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={copy.github} className="hl-icon-btn">
                <GithubIcon className="h-[18px] w-[18px]" />
              </a>
            </span>
          )}
          <button type="button" onClick={onTheme} aria-label={isDark ? copy.toLight : copy.toDark} className="hl-icon-btn">
            {isDark ? <Sun size={18} strokeWidth={1.9} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.9} aria-hidden="true" />}
          </button>
          <span className="ml-1.5 hidden md:block">
            <LButton variant="primary" size="sm" onClick={runNavCta}>
              {ctaLabel}
            </LButton>
          </span>
          <span className="md:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              className="hl-icon-btn hl-icon-btn--lg"
              aria-label={open ? copy.closeMenu : copy.openMenu}
              aria-expanded={open}
              aria-controls={PANEL_ID}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={20} strokeWidth={1.9} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.9} aria-hidden="true" />}
            </button>
          </span>
        </div>
      </Container>

      <div id={PANEL_ID} hidden={!open} className="hl-menu-panel absolute inset-x-0 top-full md:hidden">
        <Container className="pb-5 pt-1">
          <nav aria-label={copy.label}>
            <ul className="m-0 list-none p-0">
              {LINKS.map((link) => (
                <li key={link.id}>
                  <a href={`#${link.id}`} className="hl-menu-link" onClick={sectionLink(link.id, () => setOpen(false))}>
                    {copy[link.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <LButton variant="primary" onClick={runNavCta} className="mt-5 w-full">
            {ctaLabel}
          </LButton>
        </Container>
      </div>
    </header>
  );
};
