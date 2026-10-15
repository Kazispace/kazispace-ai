/** Staging fixture A (China-first) — SSOT: backend scripts/uat_fixtures.py */
export const FIXTURE_A_PHONE =
  process.env.PLAYWRIGHT_PHONE ?? '+8613262788342';
export const FIXTURE_A_OTP = process.env.PLAYWRIGHT_OTP ?? '123456';
export const API_BASE =
  process.env.PLAYWRIGHT_API_BASE ?? 'https://bot.kazispace.ai';
export const LOCALE = process.env.PLAYWRIGHT_LOCALE ?? 'zh';

export const REGION_SESSION_KEY = 'kazi.region.session';
export const USER_INFO_KEY = 'kazi_user_info';
export const AUTH_COOKIE = 'kazi_token';
export const LEGACY_AUTH_TOKEN = 'kazi_auth_token';
