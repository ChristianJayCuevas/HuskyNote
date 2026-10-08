# Transcription improvement plan

Status: first browser implementation delivered, September 30, 2026. Extends milestone M2 in [ROADMAP.md](ROADMAP.md). Benchmark-dependent recommendations and optional native acceleration remain gated.

## Implemented delivery and remaining validation

- Correct Filipino/Taglish language aliases and multilingual Auto routing; language preferences survive reload.
- One setup action, download/storage estimates, pinned model revisions, warm-up, cancel/retry, microphone test, and conservative complete-cache detection. No automatic browser/cloud speech fallback.
- Warm worker reuse, inference deadlines, serialized inference, stale-worker isolation, and opt-in local load/inference timing. Phrase-end latency and peak-memory instrumentation remain future work.
- Per-second recording persistence, durable phrase jobs, idempotent completion, final AudioWorklet flush, explicit retry/finish-later controls, and atomic deletion of audio plus pending PCM while preserving notes/transcripts.
- Experimental multilingual Whisper Small and Turbo, plus a local reference-clip benchmark with WER, processing ratio, and DSP comparison. Neither candidate has been promoted as a better Taglish default.

Validation: 159 automated tests passed. An isolated Edge browser smoke test verified persisted capture chunks, decodable finalized audio, deletion preserving notes, and Taglish settings persistence. Run `npm run test:transcription-browser` against a dev server on port 5187 (or set `TEST_BASE_URL`; `BROWSER_CHANNEL` defaults to `msedge`). The smoke test uses synthetic audio and a fresh profile, not the microphone or existing user data.

Still required: consented held-out Taglish recordings, CPU/GPU accuracy and speed comparisons, real-speech DSP/VAD tuning, 60-minute memory/backlog tests, interrupted-container playback on each supported browser, and clean-machine/offline checks. Full offline web startup is not advertised. Native acceleration and specialist CT2 models are not installed. The phase checklists below retain the original acceptance scope; an unchecked item may be partially implemented but not yet meet its full evidence gate.

## Outcome

Give users useful local transcripts with minimal setup, including conversations that mix Filipino and English. Optimize three separate measurements: recognition accuracy, delay before text appears, and sustained processing speed. A faster model is useful only if it preserves the words being spoken.

The default experience requires no Python, terminal commands, API key, Ollama installation, or account. Optional desktop acceleration comes later. Audio stays on the device; model downloads require internet access initially.

## User experience

1. Choose the usual conversation language: **English**, **Filipino / Taglish**, or **Other / mixed languages**. Existing users keep their saved preferences, with a clear explanation if their selected model does not support the language.
2. The app recommends one model using the language, available hardware, storage, and cached models. Show estimated download size before the user starts setup. Model names and tuning controls live under Advanced.
3. **Set up transcription** downloads the required files, verifies loading, warms the model, and runs a short local readiness check. Show separate download, loading, and ready states, with cancel and retry.
4. Offer a brief microphone test and show input level, actual sample text, and whether live transcription can keep up. Do not upload the test or save it as a meeting.
5. Subsequent sessions reuse the downloaded model. Show **Ready offline**, **Downloading**, **Transcribing**, or **Catching up** accurately. Browser offline readiness requires the application itself to be available offline as well as its model files; desktop bundles already provide the app shell.

Users may start recording while a model is being prepared once durable capture is implemented. The UI must say that transcription will follow later. Before that prerequisite is complete, keep recording-only behavior explicit and do not promise automatic recovery.

## Model policy

| Conversation | Initial supported path | Candidate upgrade | Guardrail |
| --- | --- | --- | --- |
| English | Existing English-capable engine; favor a compatible cached model | Recommend Parakeet where device benchmarks justify its download and runtime cost | Do not download a large model merely because WebGPU exists |
| Filipino / Taglish | Existing multilingual Whisper Base with corrected language mapping | Benchmark multilingual Whisper Small and Large v3 Turbo; test specialist Taglish weights separately | Run whole mixed-language phrases through a multilingual model |
| Other / mixed languages | A multilingual model supporting the requested language(s) | Same hardware-aware comparison | Do not treat Parakeet's automatic detection as universal language support |
| Device cannot keep up | Preserve recording and finish transcription afterward | Optional smaller compatible model or desktop accelerator | Never silently drop queued audio or switch to an English-only engine |

Use **Recommended** as the default quality setting. Advanced settings can offer **Lower resource use** and **Higher accuracy**, with measured tradeoffs. Do not silently download a different model or run two large models at once.

An explicit Taglish mode is more predictable than switching models word by word. For Whisper, benchmark automatic language detection against a Tagalog language hint while always using `task: transcribe`. Preserve spoken English words and Filipino words; translation is a separate user action.

Parakeet v3 does not list Tagalog among its supported languages. Fine-tuning it for Taglish is deferred until we have evidence that available multilingual models are inadequate, licensed training data, a training budget, and an export-validation path.

## Phase 1: Correct language routing and establish a baseline

- [ ] Map `fil`, `fil-PH`, `tl`, and `tl-PH` to Whisper's `tl` language code at the ASR boundary. Keep display labels independent of runtime codes.
- [ ] Add an explicit Filipino / Taglish session choice and tests showing that Parakeet and English-only Moonshine cannot be selected as its effective engine.
- [ ] Clarify Auto: detection happens within the selected model's supported languages. For unrestricted mixed-language sessions, select a multilingual model.
- [ ] Preserve existing saved engine choices and show the effective engine whenever a language-based fallback applies.
- [ ] Remove unqualified claims such as "fastest and most accurate" from engine descriptions.
- [ ] Add local timing measurements: cold download/load, warm load, inference time, audio duration, queue depth in seconds, and time from phrase end to displayed text. Diagnostics are opt-in and contain no transcript or audio by default.

Primary files: `transcription-engines.ts`, `speech-engine.ts`, `transcriber.ts`, `transcription-settings.tsx`, language selection UI, and corresponding tests.

Exit gate: every supported language alias resolves correctly; Taglish never reaches an incompatible engine; existing English settings still work; measured baseline results are recorded before optimizing.

## Phase 2: Make browser setup dependable

- [ ] Put a single recommended setup action ahead of the engine catalog, with the download size and available space shown.
- [ ] Detect WebGPU capability, attempt a real inference, and report CPU fallback. Hardware availability alone is not a speed benchmark.
- [ ] Identify cached model variants precisely. A partial download must not count as an offline-ready model.
- [ ] Reuse completed cached files after interruption; resume individual file downloads only if the runtime and server support it. Provide cancel, retry, and cleanup of incomplete files.
- [ ] Pin model revisions and record the selected runtime/precision. Make model updates explicit so a working installation remains reproducible.
- [ ] Reuse the existing cache-management UI for model size and deletion. Explain that browser profiles and app addresses have separate caches.
- [ ] Verify startup without network access. Cache/version the browser app shell and required workers/runtimes if full web offline startup is advertised.
- [ ] Keep browser speech recognition out of automatic fallback when it cannot guarantee on-device processing; any such alternative needs a clear disclosure and explicit opt-in.

Exit gate: a fresh user can select a language and complete setup without developer tools. Interrupted downloads retry successfully. Reload and offline tests succeed on the supported browser/desktop matrix, or the unavailable capability is clearly stated.

## Phase 3: Reduce delay and retain every captured phrase

- [ ] Keep one model warm across recording sessions. Release it intentionally under memory pressure or when changing engines; do not recreate it for every chunk.
- [ ] Benchmark voice activity detection against the existing RMS threshold. Preserve a short pre-roll and end-of-speech buffer so consonants and quiet words are retained.
- [ ] Sweep phrase endpoint silence around 400-800 ms and chunk limits around 4-10 seconds. Select settings by measured latency and word errors, not by the shortest buffer alone.
- [ ] Fix the AudioWorklet stop handshake so its final partial PCM block is delivered before the chunker flushes. Test phrases ending immediately before Stop.
- [ ] Keep the current anti-alias resampling. Evaluate the recently added high-pass filter and gain normalization with real speech; retain or adjust them based on accuracy, not synthetic signal tests alone.
- [ ] Persist recording chunks and transcription progress. Reference ordered audio ranges from durable jobs; bound in-memory queue size and avoid keeping duplicate full recordings in memory.
- [ ] Add worker deadlines, restart/retry behavior, stable segment IDs, and resumable jobs. Failed or timed-out ranges must remain recoverable and must not produce duplicate transcript segments.
- [ ] Replace the current shutdown behavior that clears the queue after 30 seconds with "recording saved, transcription pending". Finish later from stored audio.
- [ ] Show when transcription falls behind and provide "Finish later". Block destructive recording deletion during an active job or explicitly cancel that job before atomically deleting its audio and queue records.

Dependencies: durable audio storage and recovery from roadmap M1/M2. Extend the existing Recordings & storage view to include interrupted sessions and pending work so users can find and delete all retained audio.

Exit gate: continuous recording stays within a documented memory budget; worker failure does not lose saved speech; interrupted processing resumes; Stop preserves the final phrase; deleting audio also removes associated pending jobs. Verify recoverability of actual browser recording containers, not just byte concatenation.

## Phase 4: Choose the best Taglish model using evidence

Benchmark the current Whisper Base against:

- Multilingual Whisper Small as a moderate-size candidate.
- Whisper Large v3 Turbo through its existing Transformers.js ONNX export on capable devices.
- `michaelildefonso/whisper-small-taglish-fine-tuned-ct2` through a compatible local runtime. Its published card lacks training/evaluation details; keep it experimental until independently measured. CTranslate2 weights are not a drop-in browser ONNX model.
- `LWobole/whisper-small-tagalog` as a Tagalog fine-tune candidate. Its reported FLEURS result does not establish Taglish meeting accuracy or preservation of English vocabulary.

Before promoting a specialist, verify artifact completeness, license, provenance, tokenizer/configuration compatibility, and accuracy after any conversion or quantization. Do not select a model solely because its name contains "Taglish".

Use a speaker-disjoint reference set of at least 30-60 minutes: Filipino-dominant, English-dominant, switching within a sentence, names, amounts, dates, acronyms, technical vocabulary, quiet speech, and background noise. Use consented recordings or appropriately licensed data. Report per-category results and keep a held-out set separate from tuning clips.

Measure overall word error rate, Filipino and English token errors separately, names/numbers accuracy, unwanted translation, silence hallucinations, peak memory, model download bytes, and latency. Run cold and warm trials on at least a CPU-only laptop and a WebGPU-capable machine, documenting browser, hardware, model revision, and precision.

Proposed promotion targets, subject to the baseline:

| Measure | Target |
| --- | --- |
| Taglish recognition | At least 15% relative WER reduction from current Whisper Base on held-out clips |
| English within Taglish | No material regression in English terms, names, or numbers; report categories separately |
| Sustained live speed | Processing/audio-duration ratio at or below 0.7 on the device tier recommended for live use |
| Warm phrase latency | p95 final text within 2 seconds after phrase end, including endpoint detection and queue time |
| Extended session | 60-minute recording without lost persisted audio, duplicate segments, or an unbounded backlog |
| Setup | One language choice and one download action; no required account, key, or terminal |

If no candidate meets both accuracy and live-speed gates, offer the measured fast option for live drafts and an explicit higher-quality pass afterward. Preserve the original transcript and show when a revised version is produced. Do not label the experimental candidate as the recommended fallback.

## Phase 5: Optional desktop acceleration

Only pursue this after the browser path is usable and benchmarks show a meaningful benefit.

- [ ] Rework the existing companion to keep its model loaded rather than constructing Whisper inside every request. Use safe temporary files, bounded jobs, and cancellation.
- [ ] Benchmark faster-whisper CPU INT8 and GPU configurations on supported hardware. Do not assume its native benchmarks predict performance against our browser implementation.
- [ ] Package an optional managed runtime with the desktop installer or an in-app install action. Avoid making users install Python or configure CUDA manually; ship a verified CPU path first if GPU packaging is not dependable.
- [ ] Add version compatibility, health checks, and a loopback-only authenticated bridge with an explicit origin allowlist. Keep a working browser fallback and an uninstall path that explains model storage.

Exit gate: clean-machine installation and uninstallation pass, model loading is reused, and the advertised speed advantage is reproducible on the supported platform. No native component is required for basic transcription.

## Implementation order and scope

Deliver phases 1 and 2 first, then durable processing and latency improvements in phase 3. Build the evaluation harness early and run phase 4 experiments alongside phase 3. Promote a new default only after the benchmark gates pass. Phase 5 is optional and should not delay browser improvements.

Suggested reviewable changes:

1. Language aliases, explicit Taglish routing, truthful engine labels, regression tests.
2. Setup flow, complete-cache readiness, retry/cancel, hardware fallback diagnostics.
3. Local latency metrics and reproducible evaluation harness.
4. Final PCM flush, chunk/VAD experiments, measured DSP comparison.
5. Durable recording/jobs, recovery, and deletion lifecycle integration.
6. Validated model candidate, device-tier recommendations, and default migration.
7. Optional packaged native acceleration after a separate benchmark gate.

Out of scope for the first delivery: custom Parakeet training, cloud transcription, continuous dual-model inference, automatic word-by-word engine switching, and using an LLM to guess words missing from the audio transcript.

## Research references

- [NVIDIA Parakeet v3 model card: language coverage and fine-tuning](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- [Whisper Turbo ONNX export for Transformers.js](https://huggingface.co/onnx-community/whisper-large-v3-turbo)
- [Experimental Taglish Small CTranslate2 model](https://huggingface.co/michaelildefonso/whisper-small-taglish-fine-tuned-ct2)
- [Tagalog Small fine-tune and self-reported evaluation](https://huggingface.co/LWobole/whisper-small-tagalog)
- [Faster-whisper runtime and hardware-specific benchmarks](https://github.com/SYSTRAN/faster-whisper)

These sources establish candidate capabilities and formats, not measured performance in HuskyNote. Recheck model revisions and availability at implementation time.
