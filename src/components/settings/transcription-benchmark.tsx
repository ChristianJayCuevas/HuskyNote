import React, { useRef, useState } from 'react';
import { AlertCircle, Download, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Disclosure } from '../ui/disclosure';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { speechEngine, toWhisperLanguage } from '../../services/audio/speech-engine';
import { getPreferredTranscriptionEngine, engineSupportsLanguage } from '../../services/audio/transcription-engines';
import { resample } from '../../services/audio/pcm-capture';
import { SpeechHighPass, normalizeSpeech } from '../../services/audio/speech-dsp';
import { wordErrorRate } from '../../services/audio/transcription-evaluation';
import { activeRecordingIds } from '../../services/audio/recorder';

/** User-supplied, short reference clips. Runs the same browser worker as meetings. */
export function TranscriptionBenchmark({ language }: { language: string }) {
  const [file, setFile] = useState<File>();
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('Taglish');
  const [dsp, setDsp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Record<string, unknown>>();
  const cancelled = useRef(false);
  const run = async () => {
    if (!file) return;
    if (speechEngine.isBusy() || activeRecordingIds.size) { setError('Stop recording and transcription before benchmarking.'); return; }
    const engine = getPreferredTranscriptionEngine();
    if (!engineSupportsLanguage(engine, language)) { setError('Choose a compatible multilingual model in Advanced first.'); return; }
    setBusy(true); setError(''); setReport(undefined); cancelled.current = false;
    let context: AudioContext | undefined;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Use a reference clip smaller than 25 MB.');
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration > 60) throw new Error('Use clips of 60 seconds or less; run several clips for a full evaluation.');
      const mono = new Float32Array(decoded.length);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const channel = decoded.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
      }
      const audio = resample(dsp ? new SpeechHighPass(decoded.sampleRate).process(mono) : mono, decoded.sampleRate, 16000);
      const loadStart = performance.now();
      await speechEngine.load(engine);
      const loadMs = performance.now() - loadStart;
      const started = performance.now(); const texts: string[] = [];
      for (let offset = 0; offset < audio.length; offset += 25 * 16000) {
        if (cancelled.current) throw new Error('Benchmark cancelled.');
        const slice = audio.slice(offset, offset + 25 * 16000);
        const result = await speechEngine.transcribe(dsp ? normalizeSpeech(slice) : slice, toWhisperLanguage(language));
        texts.push(...result.map((p) => p.text));
      }
      const inferenceMs = performance.now() - started;
      const hypothesis = texts.join(' ');
      setReport({ engine: engine.id, revision: engine.revision, language, category, dsp, filename: file.name,
        browser: navigator.userAgent, durationSeconds: decoded.duration, loadMs, inferenceMs,
        processingRatio: inferenceMs / (decoded.duration * 1000),
        hypothesis, reference, ...(reference.trim() ? { wer: wordErrorRate(reference, hypothesis) } : {}),
        note: 'Per-clip result, not a validated Taglish benchmark. Keep held-out speakers separate from tuning clips.' });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { await context?.close(); setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'speech-benchmark.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Disclosure summary="Compare models on your own audio" contentClassName="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground">Select a model above, then a consented reference clip (up to 60 seconds). Audio stays on this device. Models may download when you run the test. Downloaded results contain your transcript and reference text.</p>
      <Input aria-label="Reference audio clip" type="file" accept="audio/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0])} className="max-w-md cursor-pointer text-muted-foreground file:mr-3 file:cursor-pointer file:text-foreground" />
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="benchmark-category">Category</Label>
        <NativeSelect id="benchmark-category" value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)}>
          {['Taglish', 'Filipino', 'English', 'Names and numbers', 'Noise', 'Silence'].map((c) => <option key={c}>{c}</option>)}
        </NativeSelect>
      </div>
      <Textarea aria-label="Correct reference transcript" placeholder="Correct transcript (optional, used to measure word errors)" value={reference} disabled={busy} onChange={(e) => setReference(e.target.value)} />
      <div className="flex items-center gap-2">
        <Switch id="benchmark-dsp" checked={dsp} disabled={busy} onCheckedChange={setDsp} />
        <Label htmlFor="benchmark-dsp" className="font-normal">Apply transcription DSP</Label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" disabled={busy || !file} onClick={run}><Play />{busy ? 'Evaluating…' : 'Run local benchmark'}</Button>
        {busy && <Button size="sm" variant="outline" onClick={() => { cancelled.current = true; speechEngine.cancel(); }}>Cancel benchmark</Button>}
      </div>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertDescription className="text-foreground">{error}</AlertDescription>
        </Alert>
      )}
      {report && (
        <div className="space-y-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-xs">{JSON.stringify(report, null, 2)}</pre>
          <Button size="sm" variant="outline" onClick={download}><Download />Download results</Button>
        </div>
      )}
    </Disclosure>
  );
}
