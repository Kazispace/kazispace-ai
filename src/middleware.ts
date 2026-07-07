import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  STORAGE_KEYS,
  isSupportedLocale,
} from "./lib/constants";

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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const preferred = request.cookies.get(STORAGE_KEYS.PREFERRED_LOCALE)?.value;
  const { locale, path } = stripLocale(pathname);

  // Manual locale override (settings) wins over URL segment — SDD §11.2
  if (preferred && isSupportedLocale(preferred) && preferred !== locale) {
    const redirectUrl = new URL(
      `/${preferred}${path === "/" ? "" : path}`,
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
