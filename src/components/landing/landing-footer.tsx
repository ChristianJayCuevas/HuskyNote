import React from 'react';
import { HuskyLogo } from '../../brand';
import { GithubIcon } from '../ui/github-icon';
import type { LandingCopy } from './copy';
import { GITHUB_PUBLIC, GITHUB_URL } from './links';
import { Container } from './primitives';
import type { LandingActions } from './use-landing-actions';

const FootButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <li>
    <button type="button" className="hl-footlink" onClick={onClick}>
      {children}
    </button>
  </li>
);

export const LandingFooter: React.FC<{ copy: LandingCopy['footer']; actions: LandingActions }> = ({ copy, actions }) => (
  <footer className="hl-bg hl-rule-t pb-10 pt-14 lg:pt-16">
    <Container>
      <div className="grid grid-cols-2 gap-10 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div className="col-span-2 max-w-[320px] sm:col-span-1">
          <HuskyLogo size="sm" className="hl-ink" />
          <p className="hl-small mt-4">{copy.tagline}</p>
        </div>
        <nav aria-labelledby="hl-foot-product">
          <h2 id="hl-foot-product" className="hl-mono hl-ink-3 m-0 text-[12px] font-normal">
            {copy.product}
          </h2>
          <ul className="m-0 mt-3 flex list-none flex-col p-0">
            <FootButton onClick={() => actions.goTo('download')}>{copy.download}</FootButton>
            <FootButton onClick={() => actions.goTo('changelog')}>{copy.whatsNew}</FootButton>
            <FootButton onClick={() => actions.goTo('privacy')}>{copy.privacy}</FootButton>
          </ul>
        </nav>
        <nav aria-labelledby="hl-foot-project">
          <h2 id="hl-foot-project" className="hl-mono hl-ink-3 m-0 text-[12px] font-normal">
            {copy.project}
          </h2>
          <ul className="m-0 mt-3 flex list-none flex-col p-0">
            {GITHUB_PUBLIC && (
              <li>
                <a className="hl-footlink gap-2" href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GithubIcon className="h-4 w-4" />
                  {copy.github}
                </a>
              </li>
            )}
            <FootButton onClick={() => actions.goTo('about')}>{copy.about}</FootButton>
            <FootButton onClick={actions.openExtension}>{copy.extension}</FootButton>
          </ul>
        </nav>
      </div>
      <div className="hl-rule-t mt-12 flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="hl-ink-3 m-0 text-[13px]">{copy.legal}</p>
        <p className="hl-mono hl-ink-3 m-0 text-[12px]">v{__APP_VERSION__}</p>
      </div>
    </Container>
  </footer>
);
