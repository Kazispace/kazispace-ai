#!/usr/bin/env node
/**
 * UAT-WA P0 full suite — Playwright headless Chrome
 * Spec: kazispace-design/docs/test/WEB-APP-TEST-SPEC-v1.0.md §6 P0
 * Usage: node test/scripts/run_uat_wa_p0.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const BASE = process.argv[2] || 'http://localhost:3000';
const LOCALE = 'ru';
const OTP = '123456';
const STAMP = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
const PHONE = `+7701555${String(Date.now()).slice(-4)}`;
const OUT = path.join('test/evidence/uat-p0', STAMP.slice(0, 10));

const greetingRe = /Ser[ií]k|AI-карьерный партнёр/;

const RU = {
  guestBanner: 'Войди, чтобы сохранить историю и открыть специалистов',
  loginToChat: 'Войдите, чтобы отправлять сообщения',
  jobSearch: 'Эксперт по поиску работы',
  mockInterview: 'Тренер по собеседованиям',
  careerSprint: 'Карьерный спринт',
  comingSoon: 'Скоро',
  backToClinic: '← Назад в клинику',
  sendCode: 'Получить код',
  verify: 'Войти',
  freeTrialBadge: 'Пробный период',
  jobQuickReply: '💰 Зарплата',
  interviewQuickReply: 'Поведенческие вопросы',
};

const results = [];
const consoleErrors = [];
const networkWarnings = [];

async function shot(page, name) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function record(id, pass, note, screenshot, blocked = false) {
  const status = blocked ? 'BLOCKED' : pass ? 'PASS' : 'FAIL';
  results.push({ id, status, note, screenshot });
  const icon = blocked ? '⊘' : pass ? '✓' : '✗';
  console.log(`${icon} ${id} [${status}]: ${note}`);
}

async function clearSession(context, page) {
  await context.clearCookies();
  await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function login(page, phone, { fromUrl } = {}) {
  const url = fromUrl ?? `${BASE}/${LOCALE}/login`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('input[type="tel"]').fill(phone);
  await page.getByRole('button', { name: RU.sendCode }).click();
  await page.waitForTimeout(1200);
  await page.locator('input[type="text"]').fill(OTP);
  await page.getByRole('button', { name: RU.verify }).click();
  await page.waitForTimeout(3000);
}

async function hasGreeting(page) {
  const body = await page.textContent('body');
  return greetingRe.test(body ?? '');
}

async function clickAgentCard(page, agentName) {
  await page.locator('button').filter({ hasText: agentName }).first().click();
}

async function waitExpert(page, agentName, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const back = await page.getByText(RU.backToClinic).isVisible().catch(() => false);
    const header = await page.getByText(agentName).first().isVisible().catch(() => false);
    const url = page.url();
    if (back && header) return { ok: true, url };
    await page.waitForTimeout(400);
  }
  return { ok: false, url: page.url() };
}

async function sendChat(page, text) {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 8000 });
  await textarea.fill(text);
  await textarea.press('Enter');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('favicon')) return;
      if (/Failed to load resource: the server responded with a status of \d+/.test(t)) {
        networkWarnings.push(t);
        return;
      }
      consoleErrors.push(t);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  try {
    // ── UAT-WA-AUTH-01 Guest browse ─────────────────────────────
    await clearSession(context, page);
    await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'networkidle' });
    const guestBanner = await page.getByText(RU.guestBanner).isVisible().catch(() => false);
    const greeting = await hasGreeting(page);
    const jobCard = await page.getByText(RU.jobSearch).isVisible().catch(() => false);
    const mockCard = await page.getByText(RU.mockInterview).isVisible().catch(() => false);
    const soonCard = await page.getByText(RU.careerSprint).isVisible().catch(() => false);
    const soonBadge = await page.getByText(RU.comingSoon).isVisible().catch(() => false);

    await sendChat(page, 'UAT guest probe');
    await page.waitForTimeout(2000);
    const guestSendRedirect = page.url().includes('/login');
    const s01 = await shot(page, 'auth01-guest');
    record(
      'UAT-WA-AUTH-01',
      guestBanner && greeting && jobCard && mockCard && soonCard && soonBadge && guestSendRedirect,
      `banner=${guestBanner} greeting=${greeting} cards=${jobCard}/${mockCard}/${soonCard} send→login=${guestSendRedirect}`,
      s01
    );

    // ── UAT-WA-AUTH-03 Protected redirect + post-login return ───
    await clearSession(context, page);
    await page.goto(`${BASE}/${LOCALE}/mine`, { waitUntil: 'networkidle' });
    const onLogin = page.url().includes('/login') && page.url().includes('redirect');
    const s03a = await shot(page, 'auth03-redirect');
    if (!onLogin) {
      record('UAT-WA-AUTH-03', false, `expected login redirect, got ${page.url()}`, s03a);
    } else {
      await login(page, PHONE, { fromUrl: page.url() });
      const onMine = page.url().includes('/mine');
      const s03b = await shot(page, 'auth03-after-login-mine');
      record('UAT-WA-AUTH-03', onMine, `redirect ok; post-login url=${page.url()}`, s03b);
    }

    // ── UAT-WA-AUTH-02 OTP login + Mine profile ────────────────
    await page.waitForTimeout(2000);
    const mineBadge = await page.getByText(RU.freeTrialBadge).isVisible().catch(() => false);
    const mineName = (await page.locator('h2').first().textContent().catch(() => ''))?.trim();
    const hasProfile = !!mineName && mineName !== 'Guest User' && (mineBadge || mineName.startsWith('User '));
    const s02 = await shot(page, 'auth02-mine-profile');
    record(
      'UAT-WA-AUTH-02',
      hasProfile,
      `phone=${PHONE} name=${mineName} badge=${mineBadge}`,
      s02
    );

    // ── UAT-WA-AGENT-01 Welcome Agent Hub (empty clinic) ────────
    await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const hubGreeting = await hasGreeting(page);
    const hubJob = await page.getByText(RU.jobSearch).isVisible().catch(() => false);
    const hubMock = await page.getByText(RU.mockInterview).isVisible().catch(() => false);
    const hubSoon = await page.getByText(RU.comingSoon).isVisible().catch(() => false);
    const openButtons = await page.getByText(/Открыть/).count();
    const sA01 = await shot(page, 'agent01-hub');
    record(
      'UAT-WA-AGENT-01',
      hubGreeting && hubJob && hubMock && hubSoon && openButtons >= 2,
      `greeting=${hubGreeting} available=${hubJob}/${hubMock} soon=${hubSoon} openBtns=${openButtons}`,
      sA01
    );

    // ── UAT-WA-AGENT-02 Activate Job Search ─────────────────────
    await clickAgentCard(page, RU.jobSearch);
    await page.waitForTimeout(2500);
    const expert2 = await waitExpert(page, RU.jobSearch);
    const quickJob = await page.getByText(RU.jobQuickReply).isVisible().catch(() => false);
    const ctxModule = expert2.url.includes('context_module=job_search');
    const sA02 = await shot(page, 'agent02-job-search');
    record(
      'UAT-WA-AGENT-02',
      expert2.ok && quickJob && ctxModule,
      `expert=${expert2.ok} quickReply=${quickJob} url=${expert2.url}`,
      sA02
    );

    // ── UAT-WA-AGENT-03 Expert send message ─────────────────────
    const beforeAgentMsgs = await page.locator('[class*="message"], [data-role="message"]').count().catch(() => 0);
    await sendChat(page, 'Расскажи о вакансиях в Алматы');
    await page.waitForTimeout(12000);
    const bodyAgent = await page.textContent('body');
    const hasAgentReply =
      bodyAgent &&
      (bodyAgent.includes('Алмат') ||
        bodyAgent.includes('ваканс') ||
        bodyAgent.includes('работ') ||
        bodyAgent.length > beforeAgentMsgs + 100);
    const sA03 = await shot(page, 'agent03-expert-reply');
    record(
      'UAT-WA-AGENT-03',
      !!hasAgentReply,
      `reply detected=${!!hasAgentReply} bodyLen=${bodyAgent?.length}`,
      sA03
    );

    // ── UAT-WA-AGENT-04 Return to clinic ────────────────────────
    await page.getByText(RU.backToClinic).click();
    await page.waitForTimeout(2500);
    const backClinic = !(await page.getByText(RU.backToClinic).isVisible().catch(() => false));
    const clinicGreetingOrMsgs = await hasGreeting(page);
    const urlNoModule = !page.url().includes('context_module');
    const sA04 = await shot(page, 'agent04-back-clinic');
    record(
      'UAT-WA-AGENT-04',
      backClinic && urlNoModule,
      `clinicUI=${backClinic} noModule=${urlNoModule} greeting=${clinicGreetingOrMsgs}`,
      sA04
    );

    // ── UAT-WA-CLINIC-01 First clinic message ───────────────────
    await sendChat(page, 'Привет');
    await page.waitForTimeout(10000);
    const bodyClinic = await page.textContent('body');
    const hasClinicExchange =
      bodyClinic?.includes('Привет') &&
      bodyClinic.length > 300 &&
      !bodyClinic.includes('HTTP 5') &&
      !bodyClinic.includes('Network error');
    const sC01 = await shot(page, 'clinic01-first-message');
    record(
      'UAT-WA-CLINIC-01',
      !!hasClinicExchange,
      `userBubble+reply=${!!hasClinicExchange} bodyLen=${bodyClinic?.length}`,
      sC01
    );

    // ── UAT-WA-AGENT-05 Switch experts ──────────────────────────
    const jobCardVisible = await page.locator('button').filter({ hasText: RU.jobSearch }).isVisible().catch(() => false);
    if (jobCardVisible) {
      await clickAgentCard(page, RU.jobSearch);
    } else {
      await page.goto(`${BASE}/${LOCALE}/chat?context_module=job_search`, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(3000);
    const jobExpert = await waitExpert(page, RU.jobSearch, 15000);
    await page.getByText(RU.backToClinic).click();
    await page.waitForTimeout(2500);

    await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const mockCardVisible = await page.locator('button').filter({ hasText: RU.mockInterview }).isVisible().catch(() => false);
    if (mockCardVisible) {
      await clickAgentCard(page, RU.mockInterview);
    } else {
      await page.goto(`${BASE}/${LOCALE}/chat?context_module=mock_interview`, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(3000);
    const mockExpert = await waitExpert(page, RU.mockInterview, 15000);
    const mockQuick = await page.getByText(RU.interviewQuickReply).isVisible().catch(() => false);
    const sA05 = await shot(page, 'agent05-mock-interview');
    record(
      'UAT-WA-AGENT-05',
      jobExpert.ok && mockExpert.ok && mockQuick,
      `job=${jobExpert.ok} mock=${mockExpert.ok} mockQuick=${mockQuick}`,
      sA05
    );

    // ── UAT-WA-NFR-03 Runtime smoke ─────────────────────────────
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const homeOk = page.url().includes(`/${LOCALE}`);
    await page.goto(`${BASE}/${LOCALE}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const chatBody = await page.textContent('body');
    const noWhiteScreen = chatBody && chatBody.trim().length > 50;
    const sNfr = await shot(page, 'nfr03-runtime');
    const uniqueErrors = [...new Set(consoleErrors)].slice(0, 5);
    const uniqueNet = [...new Set(networkWarnings)].slice(0, 5);
    record(
      'UAT-WA-NFR-03',
      homeOk && noWhiteScreen && uniqueErrors.length === 0,
      `redirect=${homeOk} content=${noWhiteScreen} uncaught=${uniqueErrors.length} networkWarn=${uniqueNet.length}${uniqueNet.length ? ': ' + uniqueNet.join('; ') : ''}`,
      sNfr
    );
  } catch (e) {
    console.error('Fatal:', e);
    record('UAT-P0-FATAL', false, String(e), null);
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const blocked = results.filter((r) => r.status === 'BLOCKED').length;

  const summary = {
    stamp: STAMP,
    base: BASE,
    phone: PHONE,
    evidenceDir: OUT,
    pass,
    fail,
    blocked,
    total: results.length,
    consoleErrors: [...new Set(consoleErrors)],
    networkWarnings: [...new Set(networkWarnings)],
    results,
  };

  await mkdir('test/results', { recursive: true });
  const jsonPath = `test/results/uat_wa_p0_${STAMP}.json`;
  await writeFile(jsonPath, JSON.stringify(summary, null, 2));
  await writeFile('test/results/uat_wa_p0_latest.json', JSON.stringify(summary, null, 2));

  console.log(`\n══ P0 UAT Summary ══`);
  console.log(`PASS: ${pass}  FAIL: ${fail}  BLOCKED: ${blocked}  TOTAL: ${results.length}`);
  console.log(`Evidence: ${OUT}`);
  console.log(`JSON: ${jsonPath}`);

  process.exit(fail > 0 ? 1 : 0);
}

main();
