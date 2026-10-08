import React from 'react';
import { AudioLines, DoorOpen, Scale, SlidersHorizontal } from 'lucide-react';
import type { LandingCopy } from './copy';
import { Container } from './primitives';

const ICONS = [DoorOpen, AudioLines, SlidersHorizontal, Scale];

export const FactsStrip: React.FC<{ copy: LandingCopy['facts'] }> = ({ copy }) => (
  <section id="facts" aria-labelledby="hl-facts-title" className="hl-band pb-16 pt-10 lg:pb-20 lg:pt-12">
    <Container>
      <h2 id="hl-facts-title" className="sr-only">
        {copy.label}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-x-10 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {copy.items.map((item, i) => {
          const Icon = ICONS[i];
          return (
            <li key={item.title} className="hl-reveal flex gap-4 lg:flex-col lg:gap-4">
              <span className="hl-icon-tile" aria-hidden="true">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <div>
                <h3 className="hl-ink m-0 text-[16px] font-semibold leading-snug tracking-[-0.01em]">{item.title}</h3>
                <p className="hl-small mt-1.5">{item.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Container>
  </section>
);
