import React from 'react';
import type { LandingCopy } from './copy';
import { Section, SectionHeading } from './primitives';
import { PawGlyph } from './snowline';

/** Three steps on a dotted paw-print trail: across on wide screens, down the left on phones. */
export const HowItWorksSection: React.FC<{ copy: LandingCopy['how'] }> = ({ copy }) => (
  <Section id="how-it-works" labelledBy="hl-how-title" band>
    <SectionHeading id="hl-how-title" eyebrow={copy.eyebrow} title={copy.title} />
    <ol className="relative m-0 mt-12 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8 lg:mt-14">
      {copy.steps.map((step, i) => (
        <li key={step.title} className="hl-reveal relative flex gap-5 md:flex-col md:gap-6">
          {/* trail to the next badge: down on phones (gap-10), across on wider screens (gap-8) */}
          {i < copy.steps.length - 1 && (
            <>
              <span aria-hidden="true" className="hl-trail hl-trail--v absolute left-[19px] top-6 h-[calc(100%+40px)] w-[10px] md:hidden" />
              <span aria-hidden="true" className="hl-trail absolute left-6 top-[19px] hidden h-[10px] w-[calc(100%+32px)] md:block" />
            </>
          )}
          <span className="hl-paw-badge" aria-hidden="true">
            <PawGlyph size={22} />
            <span className="hl-paw-num">{i + 1}</span>
          </span>
          <div className="min-w-0 md:pr-4">
            <p className="hl-mono hl-ink-3 m-0 text-[12px]">
              {copy.step} {i + 1}
            </p>
            <h3 className="hl-ink m-0 mt-1 text-[18px] font-semibold leading-snug tracking-[-0.01em]">{step.title}</h3>
            <p className="hl-small mt-2">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  </Section>
);
