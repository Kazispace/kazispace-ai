"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAuthToken, getUserInfo } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { ToastHost } from "@/components/ui/toast";
import type { User } from "@/types";

export function Providers({ children }: { children: React.ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastHost />
    </QueryClientProvider>
  );
}
