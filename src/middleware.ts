import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  STORAGE_KEYS,
  isSupportedLocale,
  type SupportedLocale,
} from "./lib/constants";

const intlMiddleware = createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

/** Apex → www (CDN also accelerates apex; keep one canonical host). */
const APEX_HOST = "kazispace.cn"; // pragma: allowlist secret
const CANONICAL_HOST = "www.kazispace.cn"; // pragma: allowlist secret

/**
 * KAZI-1171: `/english` and its sub-pages are gone; old links land in Studio.
 * next.config.js has the same redirect, but on the deployed host this middleware runs first
 * and sent signed-out visitors to the login page instead (UAT 14205). Redirecting here makes
 * it the same for everyone, on every host.
 */
export function removedEnglishRedirectPath(locale: string, path: string): string | null {
  return path === "/english" || path.startsWith("/english/")
    ? `/${locale}/clinic/hub`
    : null;
}

const PUBLIC_PATH_SEGMENTS = new Set(["login", "chat", "tma"]);

function stripLocale(pathname: string): { locale: string; path: string } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (isSupportedLocale(first)) {
    const rest = segments.slice(1);
    return {
      locale: first,
      path: rest.length ? `/${rest.join("/")}` : "/",
    };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

function isPublicPath(path: string): boolean {
  if (path === "/") return true;
  const segment = path.split("/").filter(Boolean)[0];
  return segment ? PUBLIC_PATH_SEGMENTS.has(segment) : false;
}

function resolveMiddlewareRouteLocale(request: NextRequest): SupportedLocale | null {
  const manualFlag =
    request.cookies.get(STORAGE_KEYS.LOCALE_MANUAL)?.value === "1";
  const preferred = request.cookies.get(STORAGE_KEYS.PREFERRED_LOCALE)?.value;
  const profileLang = request.cookies.get(STORAGE_KEYS.PROFILE_LANGUAGE)?.value;

  if (manualFlag && preferred && isSupportedLocale(preferred)) {
    return preferred;
  }
  if (profileLang && isSupportedLocale(profileLang)) {
    return profileLang;
  }
  return null;
}

export default function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();
  if (host === APEX_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = request.nextUrl;
  const { locale, path } = stripLocale(pathname);

  const englishRedirect = removedEnglishRedirectPath(locale, path);
  if (englishRedirect) {
    return NextResponse.redirect(new URL(englishRedirect, request.url), 307);
  }

  const targetLocale = resolveMiddlewareRouteLocale(request);
  if (targetLocale && targetLocale !== locale) {
    const redirectUrl = new URL(
      `/${targetLocale}${path === "/" ? "" : path}`,
      request.url
    );
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  if (!isPublicPath(path)) {
    const token = request.cookies.get(STORAGE_KEYS.AUTH_COOKIE)?.value;
    if (!token) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
