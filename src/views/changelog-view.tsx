import React from 'react';
import releases from '../data/changelog.json';
import { GitCommit } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { PageContainer, PageHeader } from '../components/ui/page';

// Also the source of the GitHub release notes (scripts/release-notes.mjs)
const RELEASES: { version: string; date: string; title: string; highlights: string[] }[] = releases;

export const ChangelogView: React.FC = () => {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Changelog"
        description="What changed in each release of HuskyNote."
        icon={<GitCommit />}
      />

      {/* Release ledger */}
      <div className="divide-y">
        {RELEASES.map((rel) => (
          <article key={rel.version} className="py-8 first:pt-0 last:pb-0" aria-labelledby={`release-${rel.version}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">{rel.version}</Badge>
              <time dateTime={rel.date} className="text-xs tabular-nums text-muted-foreground">{rel.date}</time>
            </div>
            <h2 id={`release-${rel.version}`} className="mt-2 text-lg font-semibold text-foreground">{rel.title}</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground marker:text-muted-foreground/60">
              {rel.highlights.map((item, idx) => (
                <li key={idx} className="pl-1">{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </PageContainer>
  );
};
