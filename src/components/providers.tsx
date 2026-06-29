"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuthToken, getUserInfo } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { ToastHost } from "@/components/ui/toast";
import { DEFAULT_LOCALE } from "@/lib/constants";
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

  useEffect(() => {
    const token = getAuthToken();
    const user = getUserInfo<User>();
    if (token && user) {
      useAuthStore.setState({ token, user, isLoggedIn: true });
    }
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      useAuthStore.getState().logout();
      const locale = localeFromPathname(pathname);
      router.push(`/${locale}/login?expired=1`);
    };

    window.addEventListener("kazi:session-expired", onSessionExpired);
    return () => window.removeEventListener("kazi:session-expired", onSessionExpired);
  }, [pathname, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastHost />
    </QueryClientProvider>
  );
}
