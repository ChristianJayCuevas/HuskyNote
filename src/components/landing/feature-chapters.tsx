import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { LandingCopy } from './copy';
import { DocumentsMock, GuidesMock, MeetingsMock, NotesMock } from './feature-mocks';
import { LButton, Section, SectionHeading, cx } from './primitives';

interface ChapterProps {
  index: number;
  id: string;
  chapter: { label: string; title: string; body: string; bullets: string[] };
  mock: React.ReactNode;
  extra?: React.ReactNode;
}

const Chapter: React.FC<ChapterProps> = ({ index, id, chapter, mock, extra }) => {
  const mockFirst = index % 2 === 1;
  return (
    <article aria-labelledby={id} className="hl-rule-t grid items-center gap-10 pt-12 lg:grid-cols-2 lg:gap-16 lg:pt-16">
      <div className={cx('hl-reveal max-w-[480px]', mockFirst && 'lg:order-2 lg:justify-self-end')}>
        <p className="hl-chapter m-0">
          <span className="hl-ink-3">{String(index + 1).padStart(2, '0')}</span>
          <span className="ml-3">{chapter.label}</span>
        </p>
        <h3 id={id} className="hl-h3 mt-4">
          {chapter.title}
        </h3>
        <p className="hl-body mt-4">{chapter.body}</p>
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {chapter.bullets.map((bullet) => (
            <li key={bullet} className="hl-ink-2 flex gap-3 text-[15px] leading-[1.5]">
              <Check size={16} strokeWidth={2.25} className="hl-accent mt-[3px] flex-none" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        {extra}
      </div>
      <div className={cx('hl-reveal', mockFirst && 'lg:order-1')}>{mock}</div>
    </article>
  );
};

export const FeatureChapters: React.FC<{ copy: LandingCopy; onOpenExtension: () => void }> = ({ copy, onOpenExtension }) => {
  const f = copy.features;
  return (
    <Section id="features" labelledBy="hl-features-title">
      <SectionHeading id="hl-features-title" eyebrow={f.eyebrow} title={f.title} lede={f.lede} />
      <div className="mt-12 flex flex-col gap-16 lg:mt-14 lg:gap-20">
        <Chapter
          index={0}
          id="hl-ch-meetings"
          chapter={f.meetings}
          mock={<MeetingsMock copy={copy.mocks.meetings} />}
          extra={
            <LButton variant="ghost" onClick={onOpenExtension} className="mt-5">
              <span className="inline-flex items-center gap-1.5">
                {f.meetings.extension}
                <ArrowRight className="hl-btn-arrow" size={15} strokeWidth={2} aria-hidden="true" />
              </span>
            </LButton>
          }
        />
        <Chapter index={1} id="hl-ch-documents" chapter={f.documents} mock={<DocumentsMock copy={copy.mocks.documents} />} />
        <Chapter index={2} id="hl-ch-guides" chapter={f.guides} mock={<GuidesMock copy={copy.mocks.guides} />} />
        <Chapter index={3} id="hl-ch-notes" chapter={f.notes} mock={<NotesMock copy={copy.mocks.notes} />} />
      </div>
    </Section>
  );
};
