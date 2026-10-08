import React from 'react';
import { Shield, Lock, EyeOff, Server } from 'lucide-react';
import { useAI } from '../context/ai-context';
import { PROVIDER_RECIPIENTS } from '../services/ai/active-provider';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { PageContainer, PageHeader } from '../components/ui/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const sectionTitle = 'mt-10 mb-3 text-lg font-semibold text-foreground';
const strong = 'font-medium text-foreground';

export const PrivacyView: React.FC = () => {
  const { provider } = useAI();
  const recipient = PROVIDER_RECIPIENTS[provider];
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Privacy"
        description="Honest transparency regarding your data, permissions, and network activity."
      />

      {/* Guarantees */}
      <div className="space-y-3">
        <Alert>
          <Lock />
          <AlertTitle>Local Storage by Default</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              All notes, meeting audio recordings, transcripts, uploaded PDF files, screenshot captures,
              and custom templates are stored on this device, in the app's local database.
            </p>
            <p>
              HuskyNote has no accounts and no cloud sync. Nothing is uploaded unless you turn on a cloud
              AI provider such as Claude or ChatGPT (Codex).
            </p>
          </AlertDescription>
        </Alert>
        <Alert>
          <EyeOff />
          <AlertTitle>Zero Third-Party Tracking</AlertTitle>
          <AlertDescription>
            HuskyNote includes no Google Analytics, no tracking pixels, no advertising scripts, and no
            data collectors. Your notes, recordings, and files remain solely your own.
          </AlertDescription>
        </Alert>
      </div>

      {/* AI providers */}
      <section>
        <h2 className={sectionTitle}>AI providers</h2>
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            <strong className={strong}>Ollama (local):</strong> prompts and document
            excerpts go to Ollama on your own computer (<code className="rounded-sm bg-muted-foreground/10 px-1 py-0.5 font-mono text-xs text-foreground">http://localhost:11434</code>) and never leave it.
          </p>
          <p>
            <strong className={strong}>Claude (cloud):</strong> only if you choose Claude
            in Settings, the text of your request, such as note content, transcripts and document excerpts, is sent to
            Anthropic to generate the answer. Nothing is sent to Anthropic while Ollama is selected.
          </p>
          <p>
            <strong className={strong}>ChatGPT through Codex (cloud):</strong> only if you choose it in Settings,
            HuskyNote runs the Codex app installed on this computer, signed in with your ChatGPT account, and the text
            of your request is sent to OpenAI. HuskyNote never sees your ChatGPT password or sign-in tokens, and Codex
            runs with its tools turned off, so it can read only what HuskyNote sends it.
          </p>
        </div>
        <Alert variant={recipient ? 'info' : 'success'} className="mt-4">
          <Server />
          <AlertDescription className="text-foreground">
            Currently selected: <strong className="font-medium">{recipient ? `${recipient} (requests leave this computer)` : 'Ollama (stays on this computer)'}</strong>.
          </AlertDescription>
        </Alert>
      </section>

      {/* Permissions */}
      <section>
        <h2 className={sectionTitle}>Hardware & Browser Permissions</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Permission</TableHead>
                <TableHead className="hidden sm:table-cell">Why</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell className="align-top font-medium text-foreground sm:whitespace-nowrap">
                  Microphone
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground sm:hidden">Record and transcribe meetings</div>
                </TableCell>
                <TableCell className="hidden min-w-36 align-top text-muted-foreground sm:table-cell">Record and transcribe meetings</TableCell>
                <TableCell className="align-top leading-6 text-muted-foreground sm:min-w-56">
                  Invoked exclusively when you click "Start Microphone" in
                  the Meeting Secretary. The browser will ask for confirmation, and an active red pulse
                  indicator will show during recording.
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell className="align-top font-medium text-foreground sm:whitespace-nowrap">
                  Screen Sharing
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground sm:hidden">Capture screens for guides and manuals</div>
                </TableCell>
                <TableCell className="hidden min-w-36 align-top text-muted-foreground sm:table-cell">Capture screens for guides and manuals</TableCell>
                <TableCell className="align-top leading-6 text-muted-foreground sm:min-w-56">
                  Invoked exclusively when you click "Start Screen
                  Capture" in the Operation Manual section. You choose which window or screen to share.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <Alert className="mt-4">
          <Shield />
          <AlertTitle>No Silent Recording</AlertTitle>
          <AlertDescription>
            HuskyNote does not and cannot bypass browser
            permission systems to secretly capture desktop audio or screens.
          </AlertDescription>
        </Alert>
      </section>
    </PageContainer>
  );
};
