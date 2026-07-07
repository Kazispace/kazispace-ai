"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/lib/store";
import {
  hasManualLocaleOverride,
  readLanguagePreference,
  syncProfileLanguageCookie,
  switchLocalePath,
} from "@/lib/locale";
import { isSupportedLocale } from "@/lib/constants";

/**
 * Mirror profile Language Preference into a cookie for middleware redirects.
 * If URL still mismatches after cookie sync, hard-navigate once (avoids hydration flash).
 */
export function RouteLocaleSync() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasManualLocaleOverride()) return;

    const preference = readLanguagePreference(user?.primaryLocale);
    if (!preference) return;

    syncProfileLanguageCookie(preference);

    const segment = pathname.split("/").filter(Boolean)[0];
    const routeLocale = segment && isSupportedLocale(segment) ? segment : null;
    if (!routeLocale || routeLocale === preference) return;

    const key = `${pathname}:${preference}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    window.location.replace(switchLocalePath(pathname, preference));
  }, [pathname, user?.primaryLocale]);

  return null;
}
