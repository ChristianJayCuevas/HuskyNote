import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const output = new URL('./', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = { viewport: { desktop: '1440x900', mobile: '390x844' }, observations: [], errors: [] };
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === 'http://127.0.0.1:5188' || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', error => results.errors.push(error.message));
const go = async view => {
  await page.goto(`http://127.0.0.1:5188/?view=${view}`);
  await page.locator('main').first().waitFor();
  await page.waitForTimeout(700);
};
const capture = async name => page.screenshot({ path: new URL(`${name}.png`, output).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
try {
  await go('dashboard');
  await capture('home-empty-dark');
  await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts');
    const now = Date.now();
    await db.notes.bulkPut([
      { id: 'review-note-1', title: 'Q4 launch decisions', content: '# Launch decisions\n\nOrchid review: ship the desktop release after recovery checks pass.\n\n- [ ] Verify backup round trip\n- [ ] Review onboarding copy', tags: ['project', 'decisions'], versions: [], createdAt: now, updatedAt: now },
      { id: 'review-note-2', title: 'Customer interview — operations team', content: 'People want to resume their latest task quickly. Too many controls compete with the content.', tags: ['research'], versions: [], createdAt: now - 10000, updatedAt: now - 10000 },
    ]);
    await db.meetings.put({ id: 'review-meeting', title: 'Weekly product sync', startTime: now, durationSeconds: 1800, transcript: [], manualNotes: '', timeline: [], screenshots: [], createdAt: now });
  });
  await page.waitForTimeout(400);
  await capture('home-populated-dark');
  await go('notes');
  await page.getByPlaceholder('Write your note in Markdown...').waitFor();
  await capture('notes-desktop-dark');
  await page.evaluate(() => localStorage.setItem('huskynote_theme', 'light'));
  await page.reload();
  await page.getByPlaceholder('Write your note in Markdown...').waitFor();
  await capture('notes-desktop-light');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('notes-mobile-light');
  await page.getByTitle('Back to notes list').click();
  await page.waitForTimeout(300);
  results.observations.push({ check: 'mobile-back', editorStillVisible: await page.getByPlaceholder('Write your note in Markdown...').isVisible(), newNoteVisible: await page.getByRole('button', { name: 'New Note', exact: true }).isVisible() });
  await capture('notes-mobile-after-back');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a command or search...').fill('Orchid');
  results.observations.push({ check: 'header-search-finds-note-content', showsNoMatchingCommands: await page.getByText('No matching commands.', { exact: true }).isVisible() });
  await capture('search-content-mismatch');
  await page.getByPlaceholder('Type a command or search...').fill('New Note');
  const before = await page.evaluate(async () => (await import('/src/db/index.ts')).db.notes.count());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const after = await page.evaluate(async () => (await import('/src/db/index.ts')).db.notes.count());
  results.observations.push({ check: 'palette-new-note', before, after });
  await page.getByTitle('Version History').click();
  results.observations.push({ check: 'modal-initial-focus', focusInsideDialog: await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement)), dialogLabelledBy: await page.locator('[role="dialog"]').getAttribute('aria-labelledby'), dialogLabel: await page.locator('[role="dialog"]').getAttribute('aria-label') });
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { const { db } = await import('/src/db/index.ts'); db.notes.update = async () => { throw new DOMException('Review simulated quota failure', 'QuotaExceededError'); }; });
  await page.getByPlaceholder('Write your note in Markdown...').fill('Unsaved review draft after simulated storage failure');
  await page.waitForTimeout(1600);
  results.observations.push({ check: 'failed-save-feedback', savedVisible: await page.getByText('Saved', { exact: true }).isVisible(), persistedContent: await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('review-note-1')).content) });
  await go('settings&tab=storage');
  await capture('settings-storage-light');
  await page.locator('#settings-tab-transcription').click();
  await capture('settings-transcription-light');
  await go('meetings');
  await page.getByRole('button', { name: 'New Session', exact: true }).click();
  await capture('meeting-setup-light');
  await page.evaluate(() => localStorage.setItem('huskynote_theme', 'dark'));
  await go('landing');
  await page.waitForTimeout(500);
  await page.screenshot({ path: new URL('landing-dark.png', output).pathname.replace(/^\/(\w:)/, '$1') });
} finally {
  await writeFile(new URL('observations.json', output), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}
