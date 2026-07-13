import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  STORAGE_KEYS,
  isSupportedLocale,
  type SupportedLocale,
} from "./lib/constants";
import { isSpacesIndexPath } from "./lib/spaces/routes";

const intlMiddleware = createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

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
  const { pathname } = request.nextUrl;
  const { locale, path } = stripLocale(pathname);

  const targetLocale = resolveMiddlewareRouteLocale(request);
  if (targetLocale && targetLocale !== locale) {
    const redirectUrl = new URL(
      `/${targetLocale}${path === "/" ? "" : path}`,
      request.url
    );
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  if (isSpacesIndexPath(path)) {
    const chatUrl = new URL(`/${locale}/chat`, request.url);
    chatUrl.search = request.nextUrl.search;
    return NextResponse.redirect(chatUrl);
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
