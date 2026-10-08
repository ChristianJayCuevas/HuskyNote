// Run against a dev server: npm run dev -- --port 5187
// Uses an isolated browser profile and synthetic audio, never the user's microphone.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5187'}/?view=settings`);
  await page.locator('#settings-tab-transcription').click();
  await page.getByLabel('Conversation language', { exact: true }).selectOption('fil-PH');
  // The resolved engine is listed under the collapsed "Advanced setup details" disclosure
  await page.getByText('Advanced setup details', { exact: true }).click();
  await page.getByText('Model: Whisper Base.', { exact: false }).waitFor();
  await page.reload();
  await page.locator('#settings-tab-transcription').click();
  assert.equal(await page.getByLabel('Conversation language', { exact: true }).inputValue(), 'fil-PH');

  const result = await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts');
    const { AudioRecorder } = await import('/src/services/audio/recorder.ts');
    const { deleteRecording } = await import('/src/services/audio/recording-storage.ts');
    const id = 'browser-smoke';
    await db.meetings.put({ id, audioBlobId: id, title: 'Synthetic test', createdAt: 1, startTime: 1,
      durationSeconds: 2, transcript: [], manualNotes: 'Keep me', timeline: [], screenshots: [] });
    const context = new AudioContext();
    await context.resume();
    const tone = context.createOscillator();
    const destination = context.createMediaStreamDestination();
    tone.connect(destination); tone.start();
    const recorder = new AudioRecorder();
    const failures = [];
    recorder.setPersistence(id, (error) => failures.push(error.message));
    try {
      await recorder.start(undefined, destination.stream);
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const persistedBeforeStop = await db.audioChunks.where('recordingId').equals(id).count();
      const blob = await recorder.stop();
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const chunksAfterStop = await db.audioChunks.where('recordingId').equals(id).count();
      const stored = !!await db.blobs.get(id);
      await deleteRecording(id);
      const meeting = await db.meetings.get(id);
      return { persistedBeforeStop, chunksAfterStop, stored, duration: decoded.duration,
        deleted: !await db.blobs.get(id), notes: meeting.manualNotes, unlinked: !meeting.audioBlobId, failures };
    } finally {
      await recorder.stop().catch(() => {});
      tone.stop(); destination.stream.getTracks().forEach((track) => track.stop());
      await context.close();
    }
  });
  assert.ok(result.persistedBeforeStop >= 1, 'chunks must persist during capture');
  assert.equal(result.chunksAfterStop, 0);
  assert.ok(result.stored && result.deleted && result.unlinked);
  assert.ok(result.duration > 1, 'finalized recording must decode');
  assert.equal(result.notes, 'Keep me');
  assert.deepEqual(result.failures, []);
  assert.deepEqual(errors, []);
  console.log('Browser transcription smoke checks passed:', result);
} finally {
  await browser.close();
}
