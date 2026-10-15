import type { Page } from '@playwright/test';
import type { StagingSession } from './api-auth';
import {
  AUTH_COOKIE,
  LEGACY_AUTH_TOKEN,
  REGION_SESSION_KEY,
  USER_INFO_KEY,
} from './env';

/**
 * Inject region session + cookie before first navigation (deploy.md §2.2).
 * addInitScript re-applies on every new document so SPA navigations keep auth.
 */
export async function injectAuth(page: Page, session: StagingSession) {
  const payload = {
    region: {
      token: session.token,
      home_api_base: session.home_api_base,
      data_region: session.data_region,
      directory_version: session.directory_version,
    },
    user: session.user,
    cookieName: AUTH_COOKIE,
    legacyKey: LEGACY_AUTH_TOKEN,
    regionKey: REGION_SESSION_KEY,
    userKey: USER_INFO_KEY,
  };

  await page.addInitScript((p) => {
    try {
      localStorage.setItem(p.regionKey, JSON.stringify(p.region));
      localStorage.setItem(p.userKey, JSON.stringify(p.user));
      localStorage.removeItem(p.legacyKey);
    } catch {
      // ignore
    }
    const secure =
      window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${p.cookieName}=${encodeURIComponent(
      p.region.token
    )}; path=/; max-age=2592000; SameSite=Lax${secure}`;
  }, payload);
}

export async function clearAuth(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

/** Apply cookie for the FE host before navigating (middleware gate). */
export async function setAuthCookie(
  page: Page,
  token: string,
  baseURL: string
) {
  const url = new URL(baseURL);
  await page.context().addCookies([
    {
      name: AUTH_COOKIE,
      value: token,
      domain: url.hostname,
      path: '/',
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}
