import React from 'react';
import '../components/landing/landing.css';
import { useLandingCopy } from '../components/landing/use-landing-copy';
import { useLandingActions } from '../components/landing/use-landing-actions';
import { LandingNav } from '../components/landing/landing-nav';
import { HeroSection, HERO_TITLE_ID } from '../components/landing/hero-section';
import { FactsStrip } from '../components/landing/facts-strip';
import { FeatureChapters } from '../components/landing/feature-chapters';
import { AiChoiceSection } from '../components/landing/ai-choice-section';
import { PrivacySection } from '../components/landing/privacy-section';
import { HowItWorksSection } from '../components/landing/how-it-works-section';
import { FaqSection } from '../components/landing/faq-section';
import { DownloadSection } from '../components/landing/download-section';
import { LandingFooter } from '../components/landing/landing-footer';

/**
 * The HuskyNote landing page ("Snowline"). Renders full width inside AppLayout's
 * <main>, which is the scroll container, so this never renders a <main> of its own.
 *
 * Bands alternate: hero (bg), facts (band), features (bg), AI (band), privacy (bg),
 * how it works (band), FAQ (bg), download (band), footer (bg).
 */
export const LandingPage: React.FC = () => {
  const copy = useLandingCopy();
  const actions = useLandingActions();

  const skipToContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const title = document.getElementById(HERO_TITLE_ID);
    title?.focus({ preventScroll: true });
    title?.scrollIntoView({ block: 'center' });
  };

  return (
    <div className="hn-landing">
      <a href={`#${HERO_TITLE_ID}`} className="hl-skip" onClick={skipToContent}>
        {copy.skip}
      </a>
      <LandingNav copy={copy.nav} actions={actions} />
      <HeroSection copy={copy} actions={actions} />
      <FactsStrip copy={copy.facts} />
      <FeatureChapters copy={copy} onOpenExtension={actions.openExtension} />
      <AiChoiceSection copy={copy.ai} />
      <PrivacySection copy={copy.privacy} onDetails={() => actions.goTo('privacy')} />
      <HowItWorksSection copy={copy.how} />
      <FaqSection copy={copy.faq} />
      <DownloadSection copy={copy.download} os={actions.os} onDownloads={() => actions.goTo('download')} />
      <LandingFooter copy={copy.footer} actions={actions} />
    </div>
  );
};

export default LandingPage;
