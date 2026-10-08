import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, LogIn, RefreshCw, TerminalSquare } from 'lucide-react';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { isClaudeSubscriptionReady } from '../../services/ai/claude-subscription';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Spinner } from '../ui/spinner';

const link = 'inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2';

export const ClaudeSubscriptionSettings: React.FC = () => {
  const { claudeSubscriptionStatus: account, refreshClaudeSubscriptionStatus, signInWithClaude, isChecking, selectedModel, setSelectedModel } = useAI();
  const { addToast } = useWorkspace();
  const [signingIn, setSigningIn] = useState(false);
  const [signInUrl, setSignInUrl] = useState('');
  const ready = isClaudeSubscriptionReady(account);

  const handleSignIn = async () => {
    setSigningIn(true); setSignInUrl('');
    try {
      const ok = await signInWithClaude(setSignInUrl);
      addToast(ok ? 'Signed in with Claude. HuskyNote can use your subscription now.' : 'Sign-in did not finish. Try again.', ok ? 'success' : 'error');
    } catch (err) { addToast(err instanceof Error ? err.message : 'Could not start Claude sign-in.', 'error'); }
    finally { setSigningIn(false); }
  };
  const recheck = <Button variant="outline" onClick={() => refreshClaudeSubscriptionStatus()} disabled={isChecking || signingIn}>
    <RefreshCw className={cn(isChecking && 'animate-spin')} /><span>Check again</span>
  </Button>;

  let status: React.ReactNode;
  if (!account) {
    status = <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-3.5" />Looking for Claude Code on this computer…</div>;
  } else if (!account.reachable) {
    status = <div className="space-y-3"><Alert variant="info"><TerminalSquare /><AlertTitle>Claude Subscription needs the HuskyNote app</AlertTitle>
      <AlertDescription>Use the HuskyNote desktop app for Windows, or run HuskyNote with <code>npm run dev</code> to connect to Claude Code on this computer.</AlertDescription>
    </Alert>{recheck}</div>;
  } else if (!account.installed) {
    status = <div className="space-y-3"><p className="text-sm">Claude Code is not installed on this computer.</p>
      <p className="text-xs leading-relaxed text-muted-foreground">Install <a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noopener noreferrer" className={link}>Claude Code <ExternalLink className="size-3" /></a>, then check again.</p>{recheck}</div>;
  } else if (!ready || signingIn || account.loginInProgress) {
    status = <div className="space-y-3">
      {account.loggedIn && account.authMethod !== 'subscription' && <p className="text-sm text-muted-foreground">Claude Code is using an API account. Sign in with your Claude subscription to use this option.</p>}
      <div className="flex flex-wrap items-center gap-2"><Button onClick={handleSignIn} disabled={signingIn || account.loginInProgress}>
        {signingIn || account.loginInProgress ? <Spinner className="size-3.5" /> : <LogIn />}<span>{signingIn || account.loginInProgress ? 'Waiting for sign-in…' : 'Sign in with Claude'}</span>
      </Button>{recheck}</div>
      {(signingIn || account.loginInProgress) && <p className="text-xs leading-relaxed text-muted-foreground" role="status">Finish signing in with your Claude account in the browser window that opened.
        {(signInUrl || account.loginUrl) && <> No window? <a href={signInUrl || account.loginUrl} target="_blank" rel="noopener noreferrer" className={link}>Open the sign-in page <ExternalLink className="size-3" /></a></>}
      </p>}
      {!signingIn && account.loginError && <p className="text-xs text-destructive">{account.loginError}</p>}
      <p className="text-xs text-muted-foreground">You can also run <code>claude auth login</code> in a terminal, then check again.</p>
    </div>;
  } else {
    status = <div className="flex flex-wrap items-center gap-2"><div className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md bg-muted px-2.5 text-sm">
      <CheckCircle2 className="size-3.5 text-success" /><span>Signed in with Claude</span>
      {account.version && <span className="ml-auto text-xs text-muted-foreground">Claude Code {account.version}</span>}
    </div>{recheck}</div>;
  }
  return <Card><CardContent className="space-y-5">
    <div className="space-y-2"><div className="text-sm font-medium">Claude account</div>{status}</div>
    {ready && <div className="space-y-2"><Label htmlFor="claude-subscription-model">Model</Label>
      <NativeSelect id="claude-subscription-model" containerClassName="sm:w-72" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
        {account?.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </NativeSelect><p className="text-xs text-muted-foreground">{account?.models.find((m) => m.id === selectedModel)?.description}</p>
    </div>}
    <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">HuskyNote uses Claude Code on this computer with your Claude subscription. You need a plan that includes Claude Code; requests count toward its usage limits. The text you ask about is sent to Anthropic. Sign-in stays inside Claude Code, and its tools are turned off for these requests. Audio is transcribed and stored on this device. Each request starts Claude Code and returns the answer when complete.</p>
  </CardContent></Card>;
};
