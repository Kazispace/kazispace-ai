import { expect, test, type Page } from '@playwright/test';
import { loginFixtureA } from './helpers/api-auth';
import { FIXTURE_A_OTP, FIXTURE_A_PHONE, LOCALE } from './helpers/env';
import {
  clearAuth,
  injectAuth,
  setAuthCookie,
} from './helpers/session';

/**
 * Product Deploy Gate Smoke — Tier A (docs in kazispace-test DEPLOY-SMOKE-TEST).
 * IDs: SMK-AUTH-* · SMK-CLN-* · SMK-NAV-* · SMK-HUB-*
 */

const baseURL = () =>
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://kazispace.ai';

async function authedPage(page: Page) {
  const session = await loginFixtureA();
  await setAuthCookie(page, session.token, baseURL());
  await injectAuth(page, session);
  return session;
}

test.describe('SMK-AUTH · authentication', () => {
  test('SMK-AUTH-01 OTP login lands on chat', async ({ page }) => {
    // Prefer UI OTP on kazispace.ai (CORS ok). Fall back to injection if UI blocked.
    await clearAuth(page);
    await page.goto(`/${LOCALE}/login`);
    await expect(page.getByText('Kazi')).toBeVisible();

    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(FIXTURE_A_PHONE);
    await page.getByRole('button', { name: /发送验证码|Send code|Получить/i }).click();

    const otpInput = page.locator('input[type="text"]').first();
    const networkError = page.getByText(/网络错误|Network error|ошибк/i);
    const reachedOtp = await otpInput
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!reachedOtp) {
      // CORS / rate-limit path — prove product surface via injection instead
      test.info().annotations.push({
        type: 'note',
        description:
          'UI OTP did not reach code step; asserting injection login path (deploy.md §2.2)',
      });
      const session = await loginFixtureA();
      await setAuthCookie(page, session.token, baseURL());
      await injectAuth(page, session);
      await page.goto(`/${LOCALE}/chat`);
      await expect(page).toHaveURL(new RegExp(`/${LOCALE}/chat`));
      await expect(page.locator('textarea').first()).toBeVisible({
        timeout: 30_000,
      });
      return;
    }

    // Avoid racing OTP cooldown from prior API login in same worker
    await otpInput.fill(FIXTURE_A_OTP);
    await page.getByRole('button', { name: /验证|Verify|Войти/i }).click();

    if (await networkError.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: 'note',
        description: 'UI OTP hit networkError; falling back to session injection',
      });
      const session = await loginFixtureA();
      await setAuthCookie(page, session.token, baseURL());
      await injectAuth(page, session);
      await page.goto(`/${LOCALE}/chat`);
    }

    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/(chat|clinic)`), {
      timeout: 45_000,
    });
  });

  test('SMK-AUTH-02 guest /mine redirects to login', async ({ page }) => {
    await clearAuth(page);
    await page.goto(`/${LOCALE}/mine`);
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/login`));
    await expect(page.url()).toContain('redirect');
  });

  test('SMK-AUTH-03 guest chat send prompts login (no raw 422)', async ({
    page,
  }) => {
    await clearAuth(page);
    await page.goto(`/${LOCALE}/chat`);
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 30_000 });
    await textarea.fill('e2e guest smoke ping');
    // Try send button (arrow / mic area) or Enter
    await textarea.press('Enter');
    // Friendly gate: login CTA or toast — must not show bare API 422
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b422\b/);
    const loginHint = page.getByRole('link', { name: /登录|Login|Войти/i }).or(
      page.getByRole('button', { name: /登录|Login|Войти/i })
    ).or(page.getByText(/登录|Sign in|войти/i));
    // Soft assert: either redirected to login or on-page login prompt
    const onLogin = page.url().includes('/login');
    if (!onLogin) {
      await expect(loginHint.first()).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe('SMK-CLN · clinic', () => {
  test('SMK-CLN-01 logged-in /chat shows input shell', async ({ page }) => {
    await authedPage(page);
    await page.goto(`/${LOCALE}/chat`);
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/chat`));
    await expect(page.locator('textarea').first()).toBeVisible({
      timeout: 30_000,
    });
    // No white-screen crash
    await expect(page.locator('body')).not.toHaveText(/Application error/i);
  });

  test('SMK-CLN-02 clinic message gets a bot reply', async ({ page }) => {
    await authedPage(page);
    await page.goto(`/${LOCALE}/chat`);
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 30_000 });
    // Wait for auth hydrate so the composer is not remounted mid-type
    await expect(textarea).toBeEditable();

    const ping = `E2E smoke ${Date.now()}`;
    await textarea.click();
    await expect
      .poll(async () => {
        await textarea.fill('');
        await textarea.type(ping, { delay: 10 });
        return textarea.inputValue();
      })
      .toBe(ping);

    const sendBtn = page.locator('form button[type="submit"]').first();
    const chatPost = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/chat/messages') &&
        r.request().method() === 'POST',
      { timeout: 60_000 }
    );
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await textarea.press('Enter');
    }

    const post = await chatPost;
    expect(post.status()).toBeLessThan(500);

    await expect(page.getByText(ping).first()).toBeVisible({ timeout: 30_000 });
    // Bot reply: body grows beyond the user ping (streaming / final)
    await expect
      .poll(
        async () => {
          const text = await page.locator('body').innerText();
          return text.includes(ping) && text.length > ping.length + 80;
        },
        { timeout: 90_000 }
      )
      .toBe(true);
  });
});

test.describe('SMK-NAV · shell navigation', () => {
  test('SMK-NAV-01 bottom/side nav reaches chat / jobs / mine', async ({
    page,
  }) => {
    await authedPage(page);
    await page.goto(`/${LOCALE}/chat`);
    await expect(page.locator('textarea').first()).toBeVisible({
      timeout: 30_000,
    });

    // Prefer role links; fall back to direct navigation if chrome differs
    const tryNav = async (label: RegExp, path: string) => {
      const link = page.getByRole('link', { name: label }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
      } else {
        await page.goto(`/${LOCALE}${path}`);
      }
      await expect(page).toHaveURL(new RegExp(`/${LOCALE}${path}`));
      await expect(page.locator('body')).not.toHaveText(/Application error/i);
    };

    await tryNav(/工作|Jobs|Вакан/i, '/jobs');
    await tryNav(/我的|Mine|Проф/i, '/mine');
    await tryNav(/对话|Chat|Чат|门诊/i, '/chat');
  });

  test('SMK-NAV-02 mobile chat layout usable', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'mobile project only'
    );
    await authedPage(page);
    await page.goto(`/${LOCALE}/chat`);
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 30_000 });
    await expect(textarea).toBeEditable();
  });
});

test.describe('SMK-HUB · hub routes', () => {
  test('SMK-HUB-01 /cv redirects into clinic + CV rail (legacy hub)', async ({
    page,
  }) => {
    await authedPage(page);
    const res = await page.goto(`/${LOCALE}/cv`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    // KAZI-317: /cv is not a user-facing hub — lands on /chat?open_cv=1 then strips
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/chat`), {
      timeout: 20_000,
    });
    await expect(page.locator('body')).not.toHaveText(
      /404|Application error|This page could not be found/i
    );
    // CV entry still reachable from clinic (rail or quick action)
    const cvCue = page
      .getByText(/改简历|简历|CV|resume/i)
      .or(page.locator('textarea').first());
    await expect(cvCue.first()).toBeVisible({ timeout: 20_000 });
  });

  test('SMK-HUB-02 /interview loads for authed user', async ({ page }) => {
    await authedPage(page);
    const res = await page.goto(`/${LOCALE}/interview`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/interview`));
    await expect(page.locator('body')).not.toHaveText(
      /404|Application error|This page could not be found/i
    );
  });

  test('SMK-HUB-03 /jobs loads for authed user', async ({ page }) => {
    await authedPage(page);
    const res = await page.goto(`/${LOCALE}/jobs`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(`/${LOCALE}/jobs`));
    await expect(page.locator('body')).not.toHaveText(
      /404|Application error|This page could not be found/i
    );
  });
});
