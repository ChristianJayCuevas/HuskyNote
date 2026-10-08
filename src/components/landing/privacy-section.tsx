import React from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpRight, AudioLines, Captions, FileText, LaptopMinimal, ListChecks, Mic, NotebookPen } from 'lucide-react';
import type { LandingCopy } from './copy';
import { Section, SectionHeading } from './primitives';

const TILE_ICONS = [Mic, Captions, NotebookPen, FileText, ListChecks, AudioLines];
const SERVICE_ICONS = [ArrowDownToLine, ArrowUpRight, ArrowLeftRight];

/** "Your computer" holds the data; the three optional outside services hang off it with dashed connectors. */
const DataDiagram: React.FC<{ copy: LandingCopy['privacy'] }> = ({ copy }) => (
  <div className="hl-reveal">
    <div className="hl-device px-4 pb-4 pt-7 sm:px-6 sm:pb-6 sm:pt-8">
      <p className="hl-device-label m-0 inline-flex items-center gap-1.5">
        <LaptopMinimal size={13} strokeWidth={2} aria-hidden="true" />
        {copy.computer}
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3">
        {copy.tiles.map((tile, i) => {
          const Icon = TILE_ICONS[i];
          return (
            <li key={tile} className="hl-card flex min-h-[48px] items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium">
              <Icon size={16} strokeWidth={1.9} className="hl-accent flex-none" aria-hidden="true" />
              <span className="hl-ink min-w-0">{tile}</span>
            </li>
          );
        })}
      </ul>
    </div>

    <ul className="m-0 grid list-none gap-3 p-0 pl-8 pt-3 sm:grid-cols-3 sm:gap-4 sm:pl-0 sm:pt-0">
      {copy.services.map((service, i) => {
        const Icon = SERVICE_ICONS[i];
        return (
          <li key={service.name} className="relative sm:pt-9">
            {/* phones: a trunk down the left with a branch to each card */}
            <span
              aria-hidden="true"
              className={`hl-connector absolute -left-[19px] top-[-12px] sm:hidden ${i < copy.services.length - 1 ? 'bottom-0' : 'h-[calc(50%+12px)]'}`}
            />
            <span aria-hidden="true" className="hl-connector-h absolute -left-[19px] top-1/2 w-[19px] sm:hidden" />
            {/* wider screens: a drop from the box to each card */}
            <span aria-hidden="true" className="hl-connector absolute left-1/2 top-0 hidden h-9 sm:block" />
            <div className="hl-card flex h-full items-start gap-3 px-4 py-3">
              <Icon size={15} strokeWidth={2} className="hl-ink-3 mt-[3px] flex-none" aria-hidden="true" />
              <div className="min-w-0">
                <p className="hl-ink m-0 text-[14px] font-semibold leading-snug">{service.name}</p>
                <p className="hl-ink-3 m-0 mt-0.5 text-[13px] leading-[1.45]">{service.detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);

export const PrivacySection: React.FC<{ copy: LandingCopy['privacy']; onDetails: () => void }> = ({ copy, onDetails }) => (
  <Section id="privacy" labelledBy="hl-privacy-title">
    <SectionHeading id="hl-privacy-title" eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />
    <div className="mt-12 grid items-start gap-12 lg:mt-14 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
      <DataDiagram copy={copy} />
      <div className="hl-reveal">
        <h3 className="hl-h4 m-0">{copy.goodToKnow}</h3>
        <ul className="m-0 mt-4 list-none p-0">
          {copy.notes.map((note) => (
            <li key={note} className="hl-rule-b hl-small flex gap-3 py-4 first:pt-2">
              <span aria-hidden="true" className="mt-[9px] h-[5px] w-[5px] flex-none rounded-full" style={{ background: 'var(--hl-accent)' }} />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="hl-btn hl-btn--ghost mt-3" onClick={onDetails}>
          <span>{copy.details}</span>
          <ArrowRight className="hl-btn-arrow" size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  </Section>
);
