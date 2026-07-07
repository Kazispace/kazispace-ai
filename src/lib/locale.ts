import {
  DEFAULT_LOCALE,
  STORAGE_KEYS,
  isSupportedLocale,
  type SupportedLocale,
} from './constants';

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

/** Current UI locale for API calls (URL path is source when no manual override). */
export function getActiveRequestLocale(pathname?: string): SupportedLocale {
  const manual = getManualLocaleOverride();
  if (manual) return manual;
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
