// Isolated browser round trip via real download/upload controls. No user data is read.
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const useWebKit = process.env.BROWSER_ENGINE === 'webkit';
const browser = useWebKit ? null : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const contexts = [];
async function newPage() {
  let page;
  if (browser) page = await browser.newPage();
  else {
  // Persistent temporary profiles exercise installed-app storage, not private browsing.
  const context = await webkit.launchPersistentContext('', { headless: true });
  contexts.push(context);
    page = await context.newPage();
  }
  // Optional AI services are outside this test; keep their startup probes deterministic.
  await page.route('http://localhost:11434/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"models":[]}',
  }));
  return page;
}
try {
  const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5187';
  const page = await newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/?view=settings`);
  await page.locator('#settings-tab-storage').click();
  await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts');
    await db.notes.put({ id: 'test-note', title: 'Portable note', content: 'Kumusta', tags: [], versions: [], createdAt: 1, updatedAt: 1 });
    await db.blobs.put({ id: 'test-audio', data: new Blob(['portable-audio'], { type: 'audio/webm' }), mimeType: 'audio/webm', createdAt: 1 });
    await db.meetings.put({ id: 'test-meeting', title: 'Portable meeting', audioBlobId: 'test-audio', startTime: 1, durationSeconds: 1, transcript: [], manualNotes: '', timeline: [], screenshots: [], createdAt: 1 });
  });
  await page.getByRole('button', { name: 'Prepare complete backup', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('link', { name: 'Save backup file' }).click(),
  ]);
  assert.equal(await download.failure(), null);
  assert.ok(download.suggestedFilename().endsWith('.huskybackup'));
  const path = await download.path();

  // Fresh browser context simulates transferring the archive to another installation.
  const destination = await newPage();
  destination.on('pageerror', (error) => errors.push(error.message));
  await destination.goto(`${origin}/?view=settings`);
  await destination.locator('#settings-tab-storage').click();
  await destination.getByLabel('Choose backup to verify and restore').setInputFiles(path);
  await destination.getByText('Integrity and references verified.', { exact: false }).waitFor();
  await destination.getByLabel('New profile name').fill('Transferred workspace');
  await destination.getByRole('button', { name: 'Restore into new profile', exact: true }).click();
  await destination.getByText('Restored to “Transferred workspace”.', { exact: false }).waitFor();
  const result = await destination.evaluate(async () => {
    const { db, HuskyNoteDatabase } = await import('/src/db/index.ts');
    const { listProfiles, profileDatabaseName, getActiveProfileId } = await import('/src/services/profiles.ts');
    const profile = listProfiles().find((p) => p.name === 'Transferred workspace');
    const target = new HuskyNoteDatabase(profileDatabaseName(profile.id));
    try {
      return { active: getActiveProfileId(), currentNotes: await db.notes.count(),
        note: (await target.notes.get('test-note')).content,
        audio: await (await target.blobs.get('test-audio')).data.text(),
        reference: (await target.meetings.get('test-meeting')).audioBlobId };
    } finally { target.close(); }
  });
  assert.deepEqual(result, { active: 'default', currentNotes: 0, note: 'Kumusta', audio: 'portable-audio', reference: 'test-audio' });
  assert.deepEqual(errors, []);
  console.log('Portable backup browser round trip passed:', result);
} finally { await browser?.close(); await Promise.all(contexts.map((context) => context.close())); }
