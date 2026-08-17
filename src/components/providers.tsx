"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuthToken, getUserInfo, syncAuthCookieFromSession } from "@/lib/auth";
import { AUTH_SESSION_CLEARED_EVENT } from "@/lib/auth-session-events";
import { useAuthStore } from "@/lib/store";
import { useTmaInit, reauthTelegramIfPossible } from "@/hooks/use-tma-init";
import { isTelegramWebApp } from "@/lib/telegram";
import { DEFAULT_LOCALE } from "@/lib/constants";
import {
  DIRECTORY_FALLBACK_DELAY_MS,
  DIRECTORY_IDLE_TIMEOUT_MS,
} from "@/lib/spaces/perf-policy";
import type { User } from "@/types";

function localeFromPathname(pathname: string): string {
  const segment = pathname.split("/")[1];
  return segment || DEFAULT_LOCALE;
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
    syncAuthCookieFromSession();
    const token = getAuthToken();
    const user = getUserInfo<User>();
    if (token && user) {
      useAuthStore.setState({ token, user, isLoggedIn: true });
    } else if (token) {
      useAuthStore.setState({ token, isLoggedIn: true });
    }
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
