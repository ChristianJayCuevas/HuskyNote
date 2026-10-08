import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { HuskyMark } from '@/brand';
import { GithubIcon } from '../components/ui/github-icon';
import { HuskyMascot } from '../components/ui/husky-mascot';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { PageContainer, PageHeader } from '../components/ui/page';
import { Table, TableBody, TableCell, TableRow } from '../components/ui/table';

const TECHNOLOGY: Array<[area: string, detail: string]> = [
  ['Frontend', 'React 18, TypeScript 5, Vite 6, Tailwind CSS'],
  ['Transcription', 'On-device speech recognition (Whisper via Transformers.js, Parakeet)'],
  ['Local Storage', 'IndexedDB via Dexie'],
  ['Local Intelligence', 'Ollama REST API (streaming generate and chat)'],
  ['Document Ingestion', 'PDF.js, Mammoth (.docx), JSZip (.pptx)'],
  ['Audio Processing', 'Web Audio API and MediaRecorder'],
  ['Screen Recording', 'Standard Navigator MediaDevices DisplayMedia'],
  ['Deployment', 'Static client-side Single Page Application'],
];

const sectionTitle = 'mt-10 mb-3 text-lg font-semibold text-foreground';

export const AboutView: React.FC = () => {
  return (
    <PageContainer width="narrow">
      <HuskyMark size={64} title="HuskyNote" className="mb-4" />
      <PageHeader
        title="About HuskyNote"
        titleClassName="text-3xl font-bold"
        description="A local-first AI secretary for meetings, documents, and notes."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="https://github.com/ChristianJayCuevas/HuskyNote" target="_blank" rel="noopener noreferrer">
              <GithubIcon className="size-3.5" />
              <span>GitHub</span>
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
            </a>
          </Button>
        }
      />

      {/* Mascot */}
      <section className="flex flex-col-reverse items-center gap-6 rounded-lg border bg-card p-6 sm:flex-row sm:justify-between">
        <div className="max-w-md space-y-3">
          <Badge variant="secondary">
            <Sparkles aria-hidden="true" />
            Focus Companion
          </Badge>
          <h2 className="text-base font-semibold text-foreground">Meet HuskyNote's Husky Companion</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            A quiet helper in the corner of your workspace. Open it for a quick status check (your work stays on
            this device, and which AI model is connected) and a one-click way into Focus mode.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Turn it on from Help &amp; about, then Show Husky companion.
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center">
          <HuskyMascot size="lg" />
        </div>
      </section>

      {/* Concept & purpose */}
      <section>
        <h2 className={sectionTitle}>What is HuskyNote?</h2>
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p className="text-foreground">
            HuskyNote is an open-source, local-first workspace designed to capture, organize, and synthesize
            what happens across your meetings, documents, and notes.
          </p>
          <p>
            Instead of storing your information on third-party cloud servers, HuskyNote operates
            entirely inside your browser and local machine. It combines a distraction-free markdown notes editor,
            an automated meeting secretary, a multi-format document reader (PDF, DOCX, PPTX, TXT), and a step-by-step
            guide generator.
          </p>
        </div>
      </section>

      {/* Open source credits */}
      <section>
        <h2 className={sectionTitle}>Open Source Credits</h2>
        <ul className="divide-y rounded-lg border">
          <li className="space-y-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href="https://github.com/darknecrocities/DomoNote"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                DomoNote by darknecrocities
                <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
              </a>
              <Badge variant="outline">MIT License</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              HuskyNote is built on DomoNote, used under the MIT License. The original copyright notice is retained in the LICENSE file.
            </p>
          </li>
        </ul>
      </section>

      {/* Technology foundation */}
      <section>
        <h2 className={sectionTitle}>Technology Foundation</h2>
        <div className="rounded-lg border">
          <Table>
            <TableBody>
              {TECHNOLOGY.map(([area, detail]) => (
                <TableRow key={area} className="hover:bg-transparent">
                  <TableCell className="w-36 align-top text-muted-foreground sm:w-48">{area}</TableCell>
                  <TableCell className="text-sm text-foreground">{detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </PageContainer>
  );
};
