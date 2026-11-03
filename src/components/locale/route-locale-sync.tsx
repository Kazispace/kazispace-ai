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
import { siteForRequest } from "@/lib/homepage-site";

/**
 * Mirror profile Language Preference into a cookie for middleware redirects.
 * If URL still mismatches after cookie sync, hard-navigate once (avoids hydration flash).
 *
 * KAZI-1245: on [REDACTED].cn, leave the public homepage locale alone — middleware already // pragma: allowlist secret
 * sent `/` → `/zh`, and profile English must not bounce the China homepage to `/en`.
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

    const segments = pathname.split("/").filter(Boolean);
    const routeLocale =
      segments[0] && isSupportedLocale(segments[0]) ? segments[0] : null;
    if (!routeLocale || routeLocale === preference) return;

    // Public homepage only: `/{locale}` with no further path.
    const onHomepage = segments.length === 1;
    if (
      onHomepage &&
      typeof window !== "undefined" &&
      siteForRequest(window.location.hostname).site === "cn"
    ) {
      return;
    }

    const key = `${pathname}:${preference}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    window.location.replace(switchLocalePath(pathname, preference));
  }, [pathname, user?.primaryLocale]);

  return null;
}
