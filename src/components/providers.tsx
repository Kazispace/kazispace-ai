"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuthToken, getUserInfo } from "@/lib/auth";
import { AUTH_SESSION_CLEARED_EVENT } from "@/lib/auth-session-events";
import { useAuthStore } from "@/lib/store";
import { useTmaInit, reauthTelegramIfPossible } from "@/hooks/use-tma-init";
import { isTelegramWebApp } from "@/lib/telegram";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { ensureDirectoryLoaded } from "@/lib/region";
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

  useEffect(() => {
    void ensureDirectoryLoaded();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    const user = getUserInfo<User>();
    if (token && user) {
      useAuthStore.setState({ token, user, isLoggedIn: true });
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
