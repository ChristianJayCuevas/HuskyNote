import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { LandingCopy } from './copy';
import { Section, SectionHeading } from './primitives';

export const FaqSection: React.FC<{ copy: LandingCopy['faq'] }> = ({ copy }) => (
  <Section id="faq" labelledBy="hl-faq-title">
    <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
      <SectionHeading id="hl-faq-title" eyebrow={copy.eyebrow} title={copy.title} />
      <div className="hl-rule-t">
        {copy.items.map((item) => (
          <details key={item.q} className="hl-faq hl-rule-b">
            <summary className="flex min-h-[64px] items-center justify-between gap-6 py-4">
              <span className="hl-faq-q hl-ink text-[17px] font-medium leading-snug tracking-[-0.01em] transition-colors duration-150">{item.q}</span>
              <ChevronDown className="hl-faq-chevron" size={18} strokeWidth={2} aria-hidden="true" />
            </summary>
            <p className="hl-body m-0 max-w-[620px] pb-6 pr-10">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  </Section>
);
