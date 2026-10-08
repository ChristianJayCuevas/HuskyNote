import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HuskyFetch } from '../../brand';
import type { LandingCopy } from './copy';
import type { LandingOS } from './cta';
import { GITHUB_PUBLIC, README_URL } from './links';
import { Chip, Container, LButton } from './primitives';

type DesktopOS = Exclude<LandingOS, 'unknown'>;

// Real release asset names (see .github/workflows/ and src/views/download-view.tsx)
const FILES: Record<DesktopOS, string[]> = {
  windows: ['HuskyNote-Setup-x64.exe', 'HuskyNote-Windows-Portable.zip'],
  macos: ['HuskyNote-macOS-arm64.dmg', 'HuskyNote-macOS-x64.dmg', 'HuskyNote-macOS-Universal.dmg'],
  linux: ['HuskyNote-Linux-x86_64.AppImage', 'HuskyNote-Linux-x64.tar.gz'],
};
const ORDER: DesktopOS[] = ['windows', 'macos', 'linux'];

interface DownloadSectionProps {
  copy: LandingCopy['download'];
  os: LandingOS;
  onDownloads: () => void;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({ copy, os, onDownloads }) => (
  <section id="download" aria-labelledby="hl-download-title" tabIndex={-1} className="hl-band hl-rule-t py-20 lg:py-28">
    <Container>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
        <HuskyFetch animated className="w-[128px] flex-none sm:w-[160px]" />
        <div className="max-w-[640px] sm:pb-2">
          <p className="hl-eyebrow">{copy.eyebrow}</p>
          <h2 id="hl-download-title" className="hl-h2 mt-4">
            {copy.title}
          </h2>
          <p className="hl-lede mt-5">{copy.lede.replace('{version}', __APP_VERSION__)}</p>
        </div>
      </div>

      <ul className="m-0 mt-12 grid list-none gap-5 p-0 md:grid-cols-3 lg:mt-14 lg:gap-6">
        {ORDER.map((key) => {
          const item = copy[key] as { name: string; detail: string; button: string; note?: string };
          const current = key === os;
          return (
            <li key={key} className="hl-card hl-os-card hl-reveal flex flex-col p-6" data-current={current}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="hl-h4 m-0">{item.name}</h3>
                {current && (
                  <Chip accent className="hl-chip--xs">
                    {copy.yourSystem}
                  </Chip>
                )}
              </div>
              <p className="hl-small mt-2">{item.detail}</p>
              <ul className="hl-rule-t m-0 mt-5 flex list-none flex-col gap-1.5 p-0 pt-4">
                {FILES[key].map((file) => (
                  <li key={file} className="hl-file">
                    {file}
                  </li>
                ))}
              </ul>
              {item.note && <p className="hl-ink-3 mt-4 text-[13px] leading-[1.5]">{item.note}</p>}
              <div className="mt-auto pt-6">
                <LButton variant={current ? 'primary' : 'secondary'} onClick={onDownloads} className="w-full" arrow={current}>
                  {item.button}
                </LButton>
              </div>
            </li>
          );
        })}
      </ul>

      {GITHUB_PUBLIC && (
        <p className="hl-small mt-8">
          <a className="hl-link inline-flex items-center gap-1.5" href={README_URL} target="_blank" rel="noreferrer">
            {copy.source}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </a>
        </p>
      )}
    </Container>
  </section>
);
