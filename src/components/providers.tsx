"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe } from "@/lib/api-client";
import {
  hydrateAuthFromSession,
} from "@/lib/auth";
import { AUTH_SESSION_CLEARED_EVENT } from "@/lib/auth-session-events";
import { useAuthStore } from "@/lib/store";
import { useTmaInit, reauthTelegramIfPossible } from "@/hooks/use-tma-init";
import { isTelegramWebApp } from "@/lib/telegram";
import { DEFAULT_LOCALE } from "@/lib/constants";
import {
  DIRECTORY_FALLBACK_DELAY_MS,
  DIRECTORY_IDLE_TIMEOUT_MS,
} from "@/lib/spaces/perf-policy";

/** When /me cannot be reached, how often and how many more times to check the session. */
const SESSION_RECHECK_MS = 15_000;
const SESSION_RECHECKS = 4;

function localeFromPathname(pathname: string): string {
  const segment = pathname.split("/")[1];
  return segment || DEFAULT_LOCALE;
}

function isLoginPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] === "login" || parts[0] === "login";
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  useTmaInit();

  // KAZI-565: do not statically import region/directory (YAML parser) into the
  // Providers chunk. Bundled directory is enough for first paint; public refresh
  // is a dynamic import behind idle/timeout.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void import("@/lib/region").then((m) => {
        if (!cancelled) void m.ensureDirectoryLoaded();
      });
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      idleId = ric(run, { timeout: DIRECTORY_IDLE_TIMEOUT_MS });
    } else {
      timeoutId = setTimeout(run, DIRECTORY_FALLBACK_DELAY_MS);
    }
    return () => {
      cancelled = true;
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pathAtBoot = pathname;
    let recheckTimer: ReturnType<typeof setTimeout> | undefined;
    let rechecksLeft = SESSION_RECHECKS;
    // One check at a time: a second one started while the first is still retrying could
    // finish later and overwrite a session the first one has just resumed.
    let checking = false;
    const signedIn = () => useAuthStore.getState().isLoggedIn;
    const stopRechecks = () => {
      window.removeEventListener("online", recheck);
      if (recheckTimer) clearTimeout(recheckTimer);
      recheckTimer = undefined;
    };
    // /me could not be reached: the session is kept (token, cookie), not ended. Check
    // again when the browser is back online, or after a pause, a few times.
    function recheck() {
      if (cancelled || checking) return; // an "online" during a check does not count
      if (signedIn() || rechecksLeft <= 0) return stopRechecks();
      rechecksLeft -= 1;
      if (recheckTimer) clearTimeout(recheckTimer);
      recheckTimer = undefined;
      void boot();
    }
    async function boot() {
      checking = true;
      let result: Awaited<ReturnType<typeof hydrateAuthFromSession>>;
      try {
        result = await hydrateAuthFromSession(() => getMe());
      } finally {
        checking = false;
      }
      if (cancelled) return;
      if (result.status === "authenticated") {
        stopRechecks();
        useAuthStore.getState().login(result.token, result.user);
        return;
      }
      if (result.status === "unreachable") {
        // Signed in meanwhile (e.g. a code entered on the login page): leave it alone.
        if (signedIn()) return stopRechecks();
        useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });
        window.addEventListener("online", recheck);
        recheckTimer = setTimeout(recheck, SESSION_RECHECK_MS);
        return;
      }
      stopRechecks();
      useAuthStore.setState({ token: null, user: null, isLoggedIn: false, authReady: true });
      if (result.status === "invalid" && !isLoginPath(pathAtBoot)) {
        router.replace(`/${localeFromPathname(pathAtBoot)}/login`);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      stopRechecks();
    };
    // Session resume is once per mount. Pathname is only used for the
    // invalid-token redirect, not as a re-fetch trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSessionExpired = async () => {
      queryClient.removeQueries({ queryKey: ['workspace-assets'] });
      queryClient.removeQueries({ queryKey: ['workspace-asset-preview'] });
      if (isTelegramWebApp()) {
        const ok = await reauthTelegramIfPossible();
        if (ok) return;
      }
      useAuthStore.getState().logout();
      const locale = localeFromPathname(pathname);
      router.push(`/${locale}/login?expired=1`);
    };

    const onAuthSessionCleared = () => {
      queryClient.removeQueries({ queryKey: ['workspace-assets'] });
      queryClient.removeQueries({ queryKey: ['workspace-asset-preview'] });
    };

    window.addEventListener("kazi:session-expired", onSessionExpired);
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onAuthSessionCleared);
    return () => {
      window.removeEventListener("kazi:session-expired", onSessionExpired);
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onAuthSessionCleared);
    };
  }, [pathname, queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
