import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, LogIn, RefreshCw, TerminalSquare } from 'lucide-react';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Spinner } from '../ui/spinner';

const link = 'inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2';

/** ChatGPT through Codex: install check, ChatGPT sign-in, and the model to use */
export const CodexSettings: React.FC = () => {
  const { codexStatus, refreshCodexStatus, signInWithChatGPT, isChecking, selectedModel, setSelectedModel } = useAI();
  const { addToast } = useWorkspace();
  const [signingIn, setSigningIn] = useState(false);
  const [signInUrl, setSignInUrl] = useState('');

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInUrl('');
    try {
      const ok = await signInWithChatGPT((url) => setSignInUrl(url));
      addToast(ok ? 'Signed in with ChatGPT. HuskyNote can use Codex now.' : 'Sign-in did not finish. Try again.', ok ? 'success' : 'error');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not start Codex sign-in.', 'error');
    } finally {
      setSigningIn(false);
    }
  };

  const recheck = (
    <Button variant="outline" onClick={() => refreshCodexStatus()} disabled={isChecking}>
      <RefreshCw className={cn(isChecking && 'animate-spin')} />
      <span>Check again</span>
    </Button>
  );

  let status: React.ReactNode;
  if (!codexStatus) {
    status = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-3.5" aria-hidden="true" /> Looking for Codex on this computer…
      </div>
    );
  } else if (!codexStatus.reachable) {
    status = (
      <Alert variant="info">
        <TerminalSquare />
        <AlertTitle>Codex needs the HuskyNote app</AlertTitle>
        <AlertDescription>
          A browser page cannot start Codex. Use the HuskyNote desktop app for Windows, or run HuskyNote with <code>npm run dev</code>.
        </AlertDescription>
      </Alert>
    );
  } else if (!codexStatus.installed) {
    status = (
      <div className="space-y-3">
        <p className="text-sm text-foreground">Codex is not installed on this computer.</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Install the{' '}
          <a href="https://developers.openai.com/codex" target="_blank" rel="noopener noreferrer" className={link}>
            Codex app or CLI <ExternalLink className="size-3" />
          </a>{' '}
          (or run <code>npm install -g @openai/codex</code>), then check again.
        </p>
        {recheck}
      </div>
    );
  } else if (!codexStatus.loggedIn) {
    status = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? <Spinner className="size-3.5" aria-hidden="true" /> : <LogIn />}
            <span>{signingIn ? 'Waiting for sign-in…' : 'Sign in with ChatGPT'}</span>
          </Button>
          {recheck}
        </div>
        {signingIn && (
          <p className="text-xs leading-relaxed text-muted-foreground" role="status">
            Finish signing in with your ChatGPT account in the browser window that opened.
            {signInUrl && (
              <>
                {' '}No window?{' '}
                <a href={signInUrl} target="_blank" rel="noopener noreferrer" className={link}>
                  Open the sign-in page <ExternalLink className="size-3" />
                </a>
              </>
            )}
          </p>
        )}
        {!signingIn && codexStatus.loginError && <p className="text-xs text-destructive">{codexStatus.loginError}</p>}
      </div>
    );
  } else {
    status = (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md bg-muted px-2.5 text-sm text-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          <span>{codexStatus.authMethod === 'apikey' ? 'Signed in to Codex with an OpenAI API key' : 'Signed in with ChatGPT'}</span>
          {codexStatus.version && <span className="ml-auto text-xs text-muted-foreground">Codex {codexStatus.version}</span>}
        </div>
        {recheck}
      </div>
    );
  }

  const models = codexStatus?.models ?? [];
  const ready = Boolean(codexStatus?.installed && codexStatus.loggedIn);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">ChatGPT account</div>
          {status}
        </div>

        {ready && models.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="codex-model">Model</Label>
            <NativeSelect id="codex-model" containerClassName="sm:w-72" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{models.find((m) => m.id === selectedModel)?.description}</p>
          </div>
        )}

        <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          HuskyNote runs Codex on this computer with your ChatGPT plan, so there is no API key to manage. Requests count toward your
          plan's Codex usage limits. With Codex selected, the text you ask about (transcripts, notes, document excerpts) is sent to
          OpenAI. Codex runs with its tools turned off: it can only read what HuskyNote sends and write text back. Each request
          takes a few seconds longer than Claude because Codex starts fresh every time.
        </p>
      </CardContent>
    </Card>
  );
};
