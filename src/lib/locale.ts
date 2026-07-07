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

/** Normalize BCP-47 tags (`zh-CN`, `kz`) to supported locale codes. */
export function normalizeLocaleTag(
  tag: string | null | undefined
): SupportedLocale | null {
  if (!tag) return null;
  const base = tag.split('-')[0].toLowerCase();
  if (base === 'kz') return 'kk';
  return isSupportedLocale(base) ? base : null;
}

/** Infer UI locale from CIS / China phone prefixes (registration signal). */
export function inferLocaleFromPhone(phone: string): SupportedLocale {
  const normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('+86')) return 'zh';
  if (normalized.startsWith('+998')) return 'uz';
  if (normalized.startsWith('+7')) return 'ru';
  return DEFAULT_LOCALE;
}

export function inferCountryFromPhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '');
  if (normalized.startsWith('+86')) return 'CN';
  if (normalized.startsWith('+998')) return 'UZ';
  if (normalized.startsWith('+7')) return 'KZ';
  return 'KZ';
}

/** Map profile country to default UI locale (explicit country beats phone prefix). */
export function inferLocaleFromCountry(
  country: string | null | undefined
): SupportedLocale | null {
  const upper = (country ?? '').toUpperCase();
  if (upper === 'CN') return 'zh';
  if (upper === 'UZ') return 'uz';
  if (upper === 'KZ') return 'kk';
  return null;
}

/** Manual UI choice — overrides phone / profile / browser detection. */
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

/**
 * Resolve UI locale priority (SDD §11.2). Client-only — reads cookie/localStorage.
 * For post-login redirect, omit `urlLocale` so profile/phone beat the login page segment.
 */
export function resolveUiLocale(params: {
  urlLocale?: string;
  primaryLocale?: string | null;
  country?: string | null;
  phone?: string | null;
  browserLocale?: string | null;
}): SupportedLocale {
  const manual = getManualLocaleOverride();
  if (manual) return manual;

  if (params.urlLocale && isSupportedLocale(params.urlLocale)) {
    return params.urlLocale;
  }

  const fromProfile = normalizeLocaleTag(params.primaryLocale);
  if (fromProfile) return fromProfile;

  const fromCountry = inferLocaleFromCountry(params.country);
  if (fromCountry) return fromCountry;

  if (params.phone) {
    return inferLocaleFromPhone(params.phone);
  }

  const fromBrowser = normalizeLocaleTag(
    params.browserLocale ??
      (typeof navigator !== 'undefined' ? navigator.language : null)
  );
  if (fromBrowser) return fromBrowser;

  return DEFAULT_LOCALE;
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

function localeFromStoredUser(): SupportedLocale | null {
  if (typeof window === 'undefined') return null;
  const user = getUserInfo<User>();
  if (!user) return null;
  // Profile country is an explicit user choice — beats phone-inherited primary_locale.
  const fromCountry = inferLocaleFromCountry(user.country);
  if (fromCountry) return fromCountry;
  const fromProfile = normalizeLocaleTag(user.primaryLocale);
  if (fromProfile) return fromProfile;
  return null;
}

/** Current UI locale for API calls (URL path is source when no manual override). */
export function getActiveRequestLocale(pathname?: string): SupportedLocale {
  const manual = getManualLocaleOverride();
  if (manual) return manual;

  // Logged-in profile/country beats URL for API language headers (chat, agents).
  const fromUser = localeFromStoredUser();
  if (fromUser) return fromUser;

  if (pathname) {
    const segment = pathname.split('/').filter(Boolean)[0];
    if (segment && isSupportedLocale(segment)) return segment;
  }
  if (typeof window !== 'undefined') {
    const segment = window.location.pathname.split('/').filter(Boolean)[0];
    if (segment && isSupportedLocale(segment)) return segment;
  }
  return DEFAULT_LOCALE;
}
