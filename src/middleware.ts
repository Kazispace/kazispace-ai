import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  STORAGE_KEYS,
} from "./lib/constants";

const intlMiddleware = createMiddleware({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

const PUBLIC_PATH_SEGMENTS = new Set(["login", "chat"]);

function stripLocale(pathname: string): { locale: string; path: string } {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (SUPPORTED_LOCALES.includes(first as (typeof SUPPORTED_LOCALES)[number])) {
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
  const { locale, path } = stripLocale(pathname);

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
