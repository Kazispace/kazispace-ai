"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { syncMasterSession } from "@/lib/master-session";

/** Bootstrap canonical master session after login (KAZI-97). */
export function MasterSessionSync() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    void syncMasterSession();
  }, [isLoggedIn, token]);

  return null;
}
