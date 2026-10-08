import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HuskyPeek } from '../../brand';
import type { LandingCopy } from './copy';
import type { Cta } from './cta';
import { HeroMeetingMock } from './hero-meeting-mock';
import { Container, Figure, LButton } from './primitives';
import { SnowlineRidge } from './snowline';
import { sectionLink, type LandingActions } from './use-landing-actions';

export const HERO_TITLE_ID = 'hl-hero-title';

function ctaLabel(cta: Cta, copy: LandingCopy['hero']): string {
  switch (cta.action) {
    case 'open-app':
      return copy.openApp;
    case 'desktop-app':
      return copy.getDesktop;
    case 'how-it-works':
      return copy.howItWorks;
    case 'download':
      if (cta.os === 'windows') return copy.downloadWindows;
      if (cta.os === 'macos') return copy.downloadMacos;
      if (cta.os === 'linux') return copy.downloadLinux;
      return copy.downloadAny;
  }
}

export const HeroSection: React.FC<{ copy: LandingCopy; actions: LandingActions }> = ({ copy, actions }) => {
  const hero = copy.hero;
  const { primary, secondary } = actions.ctas;

  return (
    <section id="top" aria-labelledby={HERO_TITLE_ID} className="hl-bg relative overflow-hidden">
      <div className="hl-ruled" aria-hidden="true" />
      <div className="hl-margin-line hidden lg:block" aria-hidden="true" />

      <Container className="relative pb-14 pt-14 sm:pt-20 lg:pb-20 lg:pt-24">
        <div className="grid items-start gap-y-[124px] lg:grid-cols-[1fr_1.08fr] lg:gap-x-14">
          <div className="max-w-[560px] lg:pt-[52px]">
            <button type="button" className="hl-chip" onClick={() => actions.goTo('changelog')}>
              <span className="hl-mono hl-ink">v{__APP_VERSION__}</span>
              <span aria-hidden="true" className="hl-ink-3">
                ·
              </span>
              <span>{hero.whatsNew}</span>
              <ArrowRight size={13} strokeWidth={2} aria-hidden="true" className="hl-ink-3" />
            </button>

            <h1 id={HERO_TITLE_ID} tabIndex={-1} className="hl-display mt-7">
              <span className="block">
                {hero.titleStart} <span className="hl-marker">{hero.titleMark}</span>
              </span>{' '}
              <span className="block">{hero.titleEnd}</span>
            </h1>

            <p className="hl-lede mt-6 max-w-[520px]">{hero.sub}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LButton variant="primary" arrow onClick={() => actions.runCta(primary)}>
                {ctaLabel(primary, hero)}
              </LButton>
              {secondary &&
                (secondary.action === 'how-it-works' ? (
                  <LButton variant="secondary" href="#how-it-works" onClick={sectionLink('how-it-works')}>
                    {ctaLabel(secondary, hero)}
                  </LButton>
                ) : (
                  <LButton variant="secondary" onClick={() => actions.runCta(secondary)}>
                    {ctaLabel(secondary, hero)}
                  </LButton>
                ))}
            </div>
            <p className="hl-ink-3 mt-5 text-[14px]">{hero.note}</p>
          </div>

          <Figure caption={hero.caption} className="hn-twitch relative lg:pt-[52px]">
            <div className="relative">
              <HuskyPeek
                animated
                className="hl-peek hl-peek-in left-[calc(50%-42px)] top-[-82px] w-[84px] sm:left-auto sm:right-[188px] sm:top-[-117px] sm:w-[120px]"
              />
              <HeroMeetingMock copy={copy.mock} />
            </div>
          </Figure>
        </div>
      </Container>

      <SnowlineRidge />
    </section>
  );
};
