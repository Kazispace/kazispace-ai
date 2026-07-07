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

/** Profile `primary_locale` — SDD Language Preference (DB column name transitional). */
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

/** Infer language from CIS / China phone prefixes — registration signal only. */
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

/** Explicit UI language picker — highest priority (SDD §11.2-A #1). */
export function getManualLocaleOverride(): SupportedLocale | null {
  const fromCookie = getLocaleCookie();
  if (fromCookie) return fromCookie;
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_LOCALE);
  if (stored && isSupportedLocale(stored)) {
    return stored;
  }
  return null;
}

export function setManualLocaleOverride(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEYS.PREFERRED_LOCALE, locale);
  if (typeof document !== 'undefined') {
    document.cookie = `${STORAGE_KEYS.PREFERRED_LOCALE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  }
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
  /** Profile `language_preference` / `primary_locale` */
  languagePreference?: string | null;
  phone?: string | null;
  browserLocale?: string | null;
  /** When true, skip manual UI override (for nested resolution). */
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
 * 1. Manual cookie  2. Language Preference  3. URL segment  4. default
 */
export function resolveRouteLocale(params: RouteLocaleParams = {}): SupportedLocale {
  const manual = getManualLocaleOverride();
  if (manual) return manual;

  const fromPreference = resolveLanguagePreference({
    ...params,
    ignoreManual: true,
  });
  if (readLanguagePreference(params.languagePreference) || params.phone) {
    return fromPreference;
  }

  if (params.urlLocale && isSupportedLocale(params.urlLocale)) {
    return params.urlLocale;
  }

  return fromPreference;
}

/** Post-login / boot redirect target locale. */
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

/** Language Preference for API headers / chat body (SDD §11.4). */
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
  if (typeof window !== 'undefined') {
    const segment = window.location.pathname.split('/').filter(Boolean)[0];
    if (segment && isSupportedLocale(segment)) return segment;
  }

  return resolved;
}

/** @deprecated Use getActiveLanguagePreference */
export const getActiveRequestLocale = getActiveLanguagePreference;
