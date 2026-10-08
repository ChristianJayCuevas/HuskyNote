// Regression checks use synthetic data in an isolated browser context.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5188';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${origin}/?view=notes`);
  await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts');
    const now = Date.now();
    await db.notes.bulkPut([
      { id: 'ui-note-a', title: 'Alpha note', content: 'Alpha original', tags: [], versions: [], createdAt: now, updatedAt: now },
      { id: 'ui-note-b', title: 'Beta note', content: 'Beta original', tags: [], versions: [], createdAt: now, updatedAt: now - 1 },
    ]);
    await db.meetings.put({ id: 'ui-meeting', title: 'Review meeting', startTime: now, durationSeconds: 60, transcript: [], manualNotes: '', timeline: [], screenshots: [], createdAt: now });
  });
  await page.getByText('Alpha note', { exact: true }).click();
  const editor = page.getByPlaceholder('Write your note in Markdown...');
  await editor.fill('Alpha pending edit');
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  await page.getByTitle('Back to notes list').click();
  await page.getByRole('button', { name: 'New Note', exact: true }).waitFor();
  assert.equal(await editor.isVisible(), false, 'Mobile Back must keep the list open');
  await page.getByText('Beta note', { exact: true }).click();
  assert.equal(await editor.inputValue(), 'Beta original');
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('ui-note-a')).content), 'Alpha pending edit');
  assert.equal(await editor.inputValue(), 'Beta original', 'A previous note save must not replace the current editor');

  await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts');
    window.reviewOriginalPut = db.notes.put.bind(db.notes);
    db.notes.put = async () => { throw new DOMException('Simulated full storage', 'QuotaExceededError'); };
  });
  await editor.fill('Beta retained draft');
  await page.getByRole('button', { name: 'Retry save', exact: true }).waitFor();
  assert.equal(await page.getByText('Saved on this device', { exact: true }).isVisible(), false);
  assert.equal(await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('ui-note-b')).content), 'Beta original');
  await page.getByTitle('Back to notes list').click();
  await page.getByText('Beta note', { exact: true }).click();
  assert.equal(await editor.inputValue(), 'Beta retained draft', 'Failed draft must survive editor navigation');
  await page.evaluate(async () => { const { db } = await import('/src/db/index.ts'); db.notes.put = window.reviewOriginalPut; });
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await page.getByText('Saved on this device', { exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('ui-note-b')).content), 'Beta retained draft');

  await page.goto(`${origin}/?view=meetings`);
  await page.getByText('Review meeting', { exact: true }).click();
  const meetingBack = page.getByTitle('Back to meetings list');
  await meetingBack.click();
  await page.getByRole('button', { name: 'New Session', exact: true }).waitFor();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a command...').fill('Back up active profile');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Prepare complete backup', exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('tab'), 'storage');
  await page.locator('#settings-tab-ai').click();
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a command...').fill('Back up active profile');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Prepare complete backup', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Search workspace content' });
  await search.fill('Alpha pending');
  await page.getByRole('button', { name: /Alpha note/ }).waitFor();
  assert.equal(await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true);
  assert.equal(await page.evaluate(() => document.querySelector('#root').getAttribute('aria-hidden')), 'true', 'Background should be hidden from assistive tech while a dialog is open');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Search workspace');
  assert.equal(await page.evaluate(() => document.querySelector('#root').getAttribute('aria-hidden')), null, 'Background should be exposed again after the dialog closes');

  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a command...').fill('New Note');
  const before = await page.evaluate(async () => (await import('/src/db/index.ts')).db.notes.count());
  await page.keyboard.press('Enter');
  await page.getByPlaceholder('Untitled Note').waitFor();
  assert.equal(await page.evaluate(async () => (await import('/src/db/index.ts')).db.notes.count()), before + 1);
  assert.equal(await editor.inputValue(), '');
  const sidebarWidth = await page.locator('aside').evaluate(element => element.getBoundingClientRect().width);
  await editor.focus();
  await page.keyboard.press('Control+b');
  assert.equal(await page.locator('aside').evaluate(element => element.getBoundingClientRect().width), sidebarWidth, 'Formatting shortcut must not collapse sidebar while typing');
  await page.getByRole('button', { name: 'Note actions', exact: true }).click();
  await page.getByTitle('Version History').click();
  await page.getByRole('dialog', { name: 'Version History', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Note actions');

  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a command...').fill('Open meeting setup');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Start recording', exact: true }).waitFor();
  assert.equal(await page.getByText('RECORDING', { exact: true }).isVisible(), false, 'Opening setup must not begin capture');

  await page.goto(`${origin}/?view=dashboard`);
  await page.getByRole('heading', { name: 'Recent work', exact: true }).waitFor();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload', exact: true }).click()]);
  assert.ok(chooser, 'Home Upload should open the picker');
  await page.getByRole('button', { name: 'Go to Home', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Recent work', exact: true }).waitFor();
  await mkdir('artifacts/ui-ux-review-2026-10-01/after', { recursive: true });
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/home-dark.png' });
  await page.getByRole('button', { name: /Alpha note/ }).click();
  await editor.waitFor();
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/notes-desktop-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/notes-mobile-dark.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || [...document.querySelectorAll('main button, main summary')].some(element => {
    const rect = element.getBoundingClientRect(); return element.checkVisibility() && rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
  }));
  assert.equal(overflow, false, 'Mobile editor controls must fit within viewport');
  await page.getByRole('button', { name: 'Note actions', exact: true }).click();
  const menuButtons = page.getByRole('menuitem', { name: 'Export Markdown', exact: true });
  const menuBox = await menuButtons.boundingBox();
  assert.ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 390, 'Mobile document menu must remain inside the viewport');
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/notes-mobile-menu-dark.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.setItem('huskynote_theme', 'light'));
  await page.evaluate(() => localStorage.setItem('huskynote_mascot_hidden', 'false'));
  await page.reload();
  await page.getByRole('button', { name: /Alpha note/ }).click();
  await editor.waitFor();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/notes-mobile-light.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/notes-desktop-light.png' });
  await page.getByRole('button', { name: 'Open Husky companion', exact: true }).click();
  await page.getByText('HuskyNote Companion', { exact: true }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/ui-ux-review-2026-10-01/after/companion-light.png' });
  await page.getByTitle('Minimize companion').click();
  await page.getByRole('button', { name: 'Note actions', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('menuitem', { name: 'Delete note…', exact: true }).click();
  await page.getByRole('button', { name: 'Undo deletion', exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('ui-note-a')) ?? null), null);
  await page.getByRole('button', { name: 'Undo deletion', exact: true }).click();
  await page.getByPlaceholder('Untitled Note').filter({ visible: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await import('/src/db/index.ts')).db.notes.get('ui-note-a')).content), 'Alpha pending edit');
  await page.goto(`${origin}/?view=landing`);
  // The app mounts after the async legacy-data migration in main.tsx, so wait for the shell before counting
  await page.locator('main').first().waitFor();
  assert.equal(await page.locator('main').count(), 1, 'Landing should expose one primary main landmark');

  await context.addInitScript(() => { Object.defineProperty(navigator, 'storage', { configurable: true, value: {} }); });
  const unknownStorage = await context.newPage();
  unknownStorage.on('pageerror', error => errors.push(error.message));
  await unknownStorage.goto(`${origin}/?view=settings&tab=storage`);
  await unknownStorage.getByText(/Usage estimate unavailable/).waitFor();
  await unknownStorage.getByText(/Persistence status unavailable/).waitFor();
  assert.equal(await unknownStorage.getByText(/0 MiB used of 0 MiB/).count(), 0);
  assert.deepEqual(errors, []);
  console.log('UI/UX browser regressions passed: save/retry, retained drafts, note switching, mobile Back, complete backup, content search, focus trap/restore, keyboard shortcuts, command creation/setup, direct upload, mobile layout/menu, light theme, landing landmark, and unknown storage states.');
} finally { await browser.close(); }
