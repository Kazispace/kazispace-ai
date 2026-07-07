"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/store";
import {
  getManualLocaleOverride,
  readLanguagePreference,
  switchLocalePath,
} from "@/lib/locale";
import { isSupportedLocale } from "@/lib/constants";

/**
 * When profile Language Preference differs from URL segment, align the route
 * unless the user has explicitly picked a UI language (manual override).
 */
export function RouteLocaleSync() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (getManualLocaleOverride()) return;

    const preference = readLanguagePreference(user?.primaryLocale);
    if (!preference) return;

    const segment = pathname.split("/").filter(Boolean)[0];
    const routeLocale = segment && isSupportedLocale(segment) ? segment : null;
    if (!routeLocale || routeLocale === preference) return;

    const key = `${pathname}:${preference}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;

    router.replace(switchLocalePath(pathname, preference));
  }, [pathname, router, user?.primaryLocale]);

  return null;
}
