import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader } from '../ui/card';
import { Disclosure } from '../ui/disclosure';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Switch } from '../ui/switch';
import { useSpeechStatus } from '../ui/speech-status-indicator';
import { speechEngine } from '../../services/audio/speech-engine';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';
import { openMicrophone } from '../../services/audio/microphone';
import { resolveTranscriptionEngine } from '../../services/audio/transcription-engines';
import { diagnosticsEnabled, setDiagnosticsEnabled, getTranscriptionMetrics } from '../../services/audio/transcription-metrics';
import { tourTarget } from '@/features/guided-tour/tours/targets';

export function TranscriptionSetup({ language, onLanguageChange }: {
  language: string; onLanguageChange: (language: string) => void;
}) {
  const status = useSpeechStatus();
  const engine = resolveTranscriptionEngine(language);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [text, setText] = useState('');
  const [level, setLevel] = useState(0);
  const [available, setAvailable] = useState<number>();
  const [diagnostics, setDiagnostics] = useState(diagnosticsEnabled);
  const cleanup = useRef<() => void>(() => {});
  const mounted = useRef(true);
  const busy = status.state === 'loading' || status.state === 'transcribing' || testing;
  const ready = speechEngine.getEngine()?.id === engine.id && status.state === 'ready';
  useEffect(() => {
    mounted.current = true;
    navigator.storage?.estimate?.().then((s) => {
      if (mounted.current && s.quota !== undefined) setAvailable(s.quota - (s.usage ?? 0));
    }).catch(() => {});
    return () => { mounted.current = false; cleanup.current(); };
  }, []);

  const setup = async () => {
    setError('');
    try { await speechEngine.load(engine); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Setup failed. Please retry.'); }
  };

  const testMic = async () => {
    setTesting(true); setText(''); setError('');
    let stream: MediaStream | undefined;
    try {
      stream = await openMicrophone({ echoCancellation: true, noiseSuppression: true });
      if (!mounted.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const transcriber = new LiveSpeechTranscriber();
      transcriber.setInputStream(stream);
      transcriber.setLanguage(language);
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const meter = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        setLevel(Math.min(100, Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length) * 500));
      }, 100);
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true; clearInterval(meter); clearTimeout(timer);
        stream?.getTracks().forEach((t) => t.stop());
        void transcriber.stop().finally(() => {
          stream?.getTracks().forEach((t) => t.stop());
          source.disconnect(); void context.close();
          if (mounted.current) { setTesting(false); setLevel(0); }
        });
      };
      const timer = setTimeout(stop, 10_000);
      cleanup.current = stop;
      transcriber.start((segment) => { if (mounted.current) setText((prev) => `${prev} ${segment.text}`.trim()); });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      setTesting(false); setError(e instanceof Error ? e.message : 'Could not test microphone.');
    }
  };

  const exportMetrics = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(getTranscriptionMetrics(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'transcription-timings.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Card {...tourTarget('transcription-setup')}>
      <CardHeader>
        <h3 className="text-base font-semibold leading-snug">Set up local transcription</h3>
        <CardDescription>Choose your usual conversation language. No account, API key, Python, or Ollama is needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor="conversation-language">Conversation language</Label>
          <NativeSelect id="conversation-language" aria-label="Conversation language" value={['en-US', 'fil-PH', 'auto'].includes(language) ? language : 'other'} disabled={busy}
            onChange={(e) => { if (e.target.value !== 'other') onLanguageChange(e.target.value); }}>
            <option value="en-US">English</option><option value="fil-PH">Filipino / Taglish</option>
            <option value="auto">Other / mixed languages (auto)</option>
            {!['en-US', 'fil-PH', 'auto'].includes(language) && <option value="other">Current language: {language}</option>}
          </NativeSelect>
        </div>
        <div className="space-y-1 text-sm">
          <p>Estimated download: {engine.downloadMb.wasm}-{engine.downloadMb.webgpu} MB, depending on device.
            {available !== undefined && ` Available browser storage: ${(available / 1e9).toFixed(1)} GB.`}</p>
          <p className="text-muted-foreground">Internet is needed for the initial download. Speech is processed on this device.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" disabled={busy} onClick={setup}>{ready ? 'Check readiness' : error || status.state === 'error' ? 'Retry setup' : 'Set up transcription'}</Button>
          {status.state === 'loading' && <Button size="sm" variant="outline" onClick={() => speechEngine.cancel()}>Cancel setup</Button>}
          <Button size="sm" variant="outline" disabled={!ready || busy} onClick={testMic}>Test microphone (10 seconds)</Button>
          {testing && <Button size="sm" variant="outline" onClick={() => cleanup.current()}>Stop test</Button>}
        </div>
        <p role="status" className="text-xs text-muted-foreground">{testing ? 'Speak naturally. Test audio and text are not saved.' : ready
          ? `Ready on ${status.device === 'webgpu' ? 'GPU' : 'CPU'}. Audio stays on this device.`
          : status.state === 'loading' ? `Downloading / loading model${status.progress !== undefined ? `: ${status.progress}%` : '…'}` : 'Complete setup before your first meeting.'}</p>
        {testing && <meter aria-label="Microphone input level" min={0} max={100} value={level} className="h-2 w-full" />}
        {text && <p className="rounded-md bg-muted p-3 text-sm">{text}</p>}
        {(error || status.state === 'error') && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertDescription className="text-xs text-foreground">{error || status.message}</AlertDescription>
          </Alert>
        )}
        <Disclosure summary="Advanced setup details" contentClassName="space-y-3 text-muted-foreground">
          <p className="text-xs leading-relaxed">Model: {engine.name}. Updated model revisions may need another download. Completed files are reused when retrying.</p>
          <p className="text-xs leading-relaxed">Cached models do not guarantee offline web startup. Keep the app open, or use the desktop app. A microphone test verifies operation, not transcription accuracy.</p>
          <div className="flex items-start gap-2">
            <Switch id="transcription-diagnostics" checked={diagnostics} onCheckedChange={(checked) => {
              setDiagnostics(checked); setDiagnosticsEnabled(checked);
            }} />
            <Label htmlFor="transcription-diagnostics" className="text-xs font-normal leading-5 text-foreground">Collect local speed diagnostics (no audio or transcript; cleared on reload)</Label>
          </div>
          {diagnostics && <Button size="sm" variant="outline" onClick={exportMetrics}>Download timing results</Button>}
        </Disclosure>
      </CardContent>
    </Card>
  );
}
