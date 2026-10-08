import React from 'react';
import { Cpu, Info, KeyRound } from 'lucide-react';
import type { LandingCopy } from './copy';
import { Section, SectionHeading } from './primitives';

const ChoiceCard: React.FC<{ icon: React.ReactNode; id: string; title: string; body: string; tags: string[] }> = ({ icon, id, title, body, tags }) => (
  <article aria-labelledby={id} className="hl-card hl-reveal flex flex-col p-6 sm:p-8">
    <span className="hl-icon-tile hl-icon-tile--lg" aria-hidden="true">
      {icon}
    </span>
    <h3 id={id} className="hl-h4 mt-5">
      {title}
    </h3>
    <p className="hl-body mt-3 flex-1">{body}</p>
    <ul className="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">
      {tags.map((tag) => (
        <li key={tag} className="hl-tag">
          {tag}
        </li>
      ))}
    </ul>
  </article>
);

export const AiChoiceSection: React.FC<{ copy: LandingCopy['ai'] }> = ({ copy }) => (
  <Section id="ai" labelledBy="hl-ai-title" band>
    <SectionHeading id="hl-ai-title" eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />
    <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-14 lg:gap-6">
      <ChoiceCard id="hl-ai-local" icon={<Cpu size={19} strokeWidth={1.9} />} title={copy.local.title} body={copy.local.body} tags={copy.local.tags} />
      <ChoiceCard id="hl-ai-claude" icon={<KeyRound size={19} strokeWidth={1.9} />} title={copy.claude.title} body={copy.claude.body} tags={copy.claude.tags} />
    </div>
    <p className="hl-small mt-8 flex items-start gap-2.5">
      <Info size={16} strokeWidth={2} className="hl-ink-3 mt-[2px] flex-none" aria-hidden="true" />
      <span>{copy.footnote}</span>
    </p>
  </Section>
);
