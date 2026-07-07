import {
  DEFAULT_LOCALE,
  STORAGE_KEYS,
  isSupportedLocale,
  type SupportedLocale,
} from './constants';
import { getUserInfo } from './auth';
import type { User } from '@/types';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ru: 'Русский',
  kk: 'Қазақша',
  uz: "O'zbekcha",
  zh: '中文',
};

/**
 * Terminology (SDD §11.1.1):
 * - languagePreference — user wants UI + agents in this language (SSOT: profile `primary_locale`)
 * - routeLocale — URL path segment `/[locale]/…` for next-intl
 * - regionalContext — `primary_country` (market/compliance), not language
 */

/** Profile `primary_locale` — Language Preference (DB column name transitional). */
export function readLanguagePreference(
  value: string | null | undefined
): SupportedLocale | null {
  return normalizeLocaleTag(value);
}

/** Normalize BCP-47 tags (`zh-CN`, `kz`) to supported language codes. */
export function normalizeLocaleTag(
  tag: string | null | undefined
): SupportedLocale | null {
  if (!tag) return null;
  const base = tag.split('-')[0].toLowerCase();
  if (base === 'kz') return 'kk';
  return isSupportedLocale(base) ? base : null;
}

/** Infer language from phone — registration signal only (empty profile). */
export function inferLanguagePreferenceFromPhone(phone: string): SupportedLocale {
  const normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('+86')) return 'zh';
  if (normalized.startsWith('+998')) return 'uz';
  if (normalized.startsWith('+7')) return 'ru';
  return DEFAULT_LOCALE;
}

/** @deprecated Use inferLanguagePreferenceFromPhone */
export const inferLocaleFromPhone = inferLanguagePreferenceFromPhone;

export function inferCountryFromPhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('+86')) return 'CN';
  if (normalized.startsWith('+998')) return 'UZ';
  if (normalized.startsWith('+7')) return 'KZ';
  return 'KZ';
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;path=/;max-age=0`;
}

/** User explicitly picked UI language (Header / Mine) — SDD §11.2-A #1. */
export function hasManualLocaleOverride(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(STORAGE_KEYS.LOCALE_MANUAL) === '1') return true;
  return document.cookie
    .split(';')
    .some((c) => c.trim() === `${STORAGE_KEYS.LOCALE_MANUAL}=1`);
}

export function getManualLocaleOverride(): SupportedLocale | null {
  if (!hasManualLocaleOverride()) return null;
  const fromCookie = getLocaleCookie();
  if (fromCookie) return fromCookie;
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_LOCALE);
  if (stored && isSupportedLocale(stored)) return stored;
  return null;
}

/** Persist explicit UI language choice (manual — blocks profile auto-sync). */
export function setManualLocaleOverride(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEYS.PREFERRED_LOCALE, locale);
  localStorage.setItem(STORAGE_KEYS.LOCALE_MANUAL, '1');
  setCookie(STORAGE_KEYS.PREFERRED_LOCALE, locale);
  setCookie(STORAGE_KEYS.LOCALE_MANUAL, '1');
}

/** Mirror profile Language Preference for middleware (not a manual override). */
export function syncProfileLanguageCookie(
  languagePreference: SupportedLocale | null | undefined
): void {
  if (!languagePreference) return;
  setCookie(STORAGE_KEYS.PROFILE_LANGUAGE, languagePreference);
}

export function clearLocaleCookies(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.PREFERRED_LOCALE);
    localStorage.removeItem(STORAGE_KEYS.LOCALE_MANUAL);
  }
  clearCookie(STORAGE_KEYS.PREFERRED_LOCALE);
  clearCookie(STORAGE_KEYS.LOCALE_MANUAL);
  clearCookie(STORAGE_KEYS.PROFILE_LANGUAGE);
}

export function getLocaleCookie(): SupportedLocale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STORAGE_KEYS.PREFERRED_LOCALE}=`));
  if (!match) return null;
  const value = match.split('=')[1];
  return value && isSupportedLocale(value) ? value : null;
}

export type LanguagePreferenceParams = {
  languagePreference?: string | null;
  phone?: string | null;
  browserLocale?: string | null;
  ignoreManual?: boolean;
};

/**
 * Language Preference — SDD §11.2-A (UI copy + agent/chat reply language).
 * 1. Manual UI picker  2. Profile  3. Phone  4. Browser  5. default `ru`
 */
export function resolveLanguagePreference(
  params: LanguagePreferenceParams = {}
): SupportedLocale {
  if (!params.ignoreManual) {
    const manual = getManualLocaleOverride();
    if (manual) return manual;
  }

  const fromProfile = readLanguagePreference(params.languagePreference);
  if (fromProfile) return fromProfile;

  if (params.phone) {
    return inferLanguagePreferenceFromPhone(params.phone);
  }

  const fromBrowser = normalizeLocaleTag(
    params.browserLocale ??
      (typeof navigator !== 'undefined' ? navigator.language : null)
  );
  if (fromBrowser) return fromBrowser;

  return DEFAULT_LOCALE;
}

export type RouteLocaleParams = LanguagePreferenceParams & {
  urlLocale?: string;
};

/**
 * UI route segment `/[locale]/…` — SDD §11.2-B.
 * 1. Manual cookie  2. Profile language preference  3. URL segment  4. phone/browser/default
 *
 * Guests may change URL language freely; only stored profile preference overrides URL.
 * Phone inference applies to Language Preference resolution, not URL override for guests.
 */
export function resolveRouteLocale(params: RouteLocaleParams = {}): SupportedLocale {
  const manual = getManualLocaleOverride();
  if (manual) return manual;

  const profilePreference = readLanguagePreference(params.languagePreference);
  if (profilePreference) {
    return profilePreference;
  }

  if (params.urlLocale && isSupportedLocale(params.urlLocale)) {
    return params.urlLocale;
  }

  return resolveLanguagePreference({ ...params, ignoreManual: true });
}

/** Post-login redirect — Language Preference, not URL segment. */
export function resolvePostLoginLocale(params: LanguagePreferenceParams): SupportedLocale {
  return resolveLanguagePreference(params);
}

/** @deprecated Use resolvePostLoginLocale or resolveRouteLocale */
export function resolveUiLocale(params: RouteLocaleParams): SupportedLocale {
  return resolveRouteLocale(params);
}

export function switchLocalePath(pathname: string, newLocale: SupportedLocale): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && isSupportedLocale(segments[0])) {
    segments[0] = newLocale;
  } else {
    segments.unshift(newLocale);
  }
  return `/${segments.join('/')}`;
}

function languagePreferenceParamsFromUser(
  user: User | null | undefined
): LanguagePreferenceParams {
  if (!user) return {};
  return {
    languagePreference: user.primaryLocale,
    phone: user.phone,
  };
}

/**
 * Language Preference for API headers / chat body (SDD §11.4).
 * Pass `pathname` from the caller when URL segment is the fallback (guest / no profile).
 */
export function getActiveLanguagePreference(pathname?: string): SupportedLocale {
  const user = getUserInfo<User>();
  const resolved = resolveLanguagePreference(languagePreferenceParamsFromUser(user));

  if (user?.primaryLocale || user?.phone) {
    return resolved;
  }

  if (pathname) {
    const segment = pathname.split('/').filter(Boolean)[0];
    if (segment && isSupportedLocale(segment)) return segment;
  }

  return resolved;
}

/** @deprecated Use getActiveLanguagePreference */
export const getActiveRequestLocale = getActiveLanguagePreference;

export function syncUserLanguageCookies(user: User | null | undefined): void {
  if (hasManualLocaleOverride()) return;
  syncProfileLanguageCookie(readLanguagePreference(user?.primaryLocale));
}
