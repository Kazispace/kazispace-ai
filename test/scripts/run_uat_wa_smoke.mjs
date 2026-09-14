#!/usr/bin/env node
/**
 * UAT-WA smoke — Playwright headless Chrome
 * Usage: node test/scripts/run_uat_wa_smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const BASE = process.argv[2] || 'http://localhost:3000';
const LOCALE = 'ru';
const PHONE = `+7701555${String(Date.now()).slice(-4)}`;
const OTP = '123456';
const OUT = path.join('test/evidence/uat-smoke', new Date().toISOString().slice(0, 10));

const results = [];

async function shot(page, name) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function record(id, pass, note, screenshot) {
  results.push({ id, status: pass ? 'PASS' : 'FAIL', note, screenshot });
  console.log(`${pass ? '✓' : '✗'} ${id}: ${note}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  try {
    // UAT-WA-AUTH-01 Guest browse
    await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'networkidle' });
    const greeting = await page.getByText(/Serík|Serik|Серік/i).first().isVisible().catch(() => false);
    const cards = await page.locator('[class*="AgentCard"], button, [role="button"]').count();
    const s1 = await shot(page, 'auth01-guest-chat');
    record('UAT-WA-AUTH-01', greeting && cards > 2, `greeting=${greeting} interactive=${cards}`, s1);

    // UAT-WA-AUTH-03 protected redirect
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/${LOCALE}/mine`, { waitUntil: 'networkidle' });
    const onLogin = page.url().includes('/login');
    const s2 = await shot(page, 'auth03-mine-redirect');
    record('UAT-WA-AUTH-03', onLogin, `url=${page.url()}`, s2);

    // UAT-WA-AUTH-02 OTP login
    await page.goto(`${BASE}/${LOCALE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="tel"]').fill(PHONE);
    await page.getByRole('button').first().click();
    await page.waitForTimeout(1500);
    await page.locator('input[type="text"]').fill(OTP);
    await page.getByRole('button').first().click();
    await page.waitForURL(/\/chat/, { timeout: 15000 }).catch(() => {});
    const loggedIn = page.url().includes('/chat');
    const s3 = await shot(page, 'auth02-after-login');
    record('UAT-WA-AUTH-02', loggedIn, `phone=${PHONE} url=${page.url()}`, s3);

    // UAT-WA-CLINIC-01 send message
    if (loggedIn) {
      const textarea = page.locator('textarea').first();
      await textarea.waitFor({ state: 'visible', timeout: 5000 });
      await textarea.fill('Привет, UAT smoke test');
      await textarea.press('Enter');
      await page.waitForTimeout(8000);
      const body = await page.textContent('body');
      const hasReply = body && body.length > 200;
      const s4 = await shot(page, 'clinic01-after-send');
      record('UAT-WA-CLINIC-01', !!hasReply, `page text length=${body?.length}`, s4);
    } else {
      record('UAT-WA-CLINIC-01', false, 'skipped — login failed', null);
    }

    // UAT-WA-AGENT-09 deep link (if logged in)
    if (loggedIn) {
      await page.goto(`${BASE}/${LOCALE}/chat?agent=job_search`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const url = page.url();
      const body = await page.textContent('body');
      const expertMode = body?.toLowerCase().includes('job') || url.includes('context_module') || url.includes('agent');
      const s5 = await shot(page, 'agent09-deeplink');
      record('UAT-WA-AGENT-09', !!expertMode, `url=${url}`, s5);
    }
  } catch (e) {
    console.error('Fatal:', e);
    record('UAT-FATAL', false, String(e), null);
  } finally {
    await browser.close();
  }

  const fail = results.filter((r) => r.status === 'FAIL').length;
  await mkdir('test/results', { recursive: true });
  await writeFile(
    'test/results/uat_wa_smoke_latest.json',
    JSON.stringify({ base: BASE, phone: PHONE, results }, null, 2)
  );
  console.log(`\nSummary: ${results.length - fail}/${results.length} PASS`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
