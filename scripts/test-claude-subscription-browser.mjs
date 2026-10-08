// Synthetic data in an isolated browser context; does not alter the user's app settings or login.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:5189';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let account = { installed: false, loggedIn: false, models: [], loginInProgress: false };
const models = [
  { id: 'default', name: 'Plan default', description: 'Default for your plan.' },
  { id: 'sonnet', name: 'Claude Sonnet', description: 'Balanced.' },
  { id: 'opus', name: 'Claude Opus', description: 'Complex requests.' },
  { id: 'haiku', name: 'Claude Haiku', description: 'Quick requests.' },
];
let loginRequested = false;
let hostedPage = false;
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/claude-subscription/status') {
    if (hostedPage) return route.fulfill({ contentType: 'text/html', body: '<html>Hosted app</html>' });
    return route.fulfill({ json: account });
  }
  if (url.pathname === '/api/claude-subscription/login') {
    loginRequested = true;
    account = { installed: true, loggedIn: true, authMethod: 'subscription', version: '2.1.295', models, loginInProgress: false };
    return route.fulfill({ json: { url: 'https://claude.ai/oauth/authorize?test' } });
  }
  return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${origin}/?view=settings&tab=ai`);
  await page.getByRole('radio', { name: /Claude Subscription/ }).click();
  await page.getByText('Claude Code is not installed on this computer.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('radio').count(), 4);
  account = { installed: true, loggedIn: true, authMethod: 'apikey', models, loginInProgress: false };
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByText('Claude Code is using an API account.', { exact: false }).waitFor();
  assert.equal(await page.locator('#claude-subscription-model').count(), 0);
  await page.getByRole('button', { name: 'Sign in with Claude', exact: true }).click();
  await page.getByText('Signed in with Claude', { exact: true }).waitFor();
  assert.equal(loginRequested, true);
  await page.locator('#claude-subscription-model').selectOption('opus');
  await page.waitForFunction(async () => {
    const { db } = await import('/src/db/index.ts');
    return (await db.settings.get('current'))?.claudeSubscriptionModel === 'opus';
  });
  await page.reload();
  await page.getByText('Signed in with Claude', { exact: true }).waitFor();
  assert.equal(await page.locator('#claude-subscription-model').inputValue(), 'opus');
  await page.getByRole('radio', { name: /Claude API/ }).click();
  await page.getByLabel('Claude API key').waitFor();
  assert.equal(await page.locator('#claude-subscription-model').count(), 0);
  await page.getByRole('radio', { name: /Claude Subscription/ }).click();
  await page.getByText('Signed in with Claude', { exact: true }).waitFor();
  assert.equal(await page.locator('#claude-subscription-model').inputValue(), 'opus');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/claude-subscription-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile page must not overflow horizontally');
  await page.screenshot({ path: 'artifacts/claude-subscription-mobile.png', fullPage: true });
  hostedPage = true;
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await page.getByText('Claude Subscription needs the HuskyNote app', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Claude subscription browser checks passed: install, API-account rejection, sign-in, models, persistence, API switching, mobile layout.');
} finally { await browser.close(); }
