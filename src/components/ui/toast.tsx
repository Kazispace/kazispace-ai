"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg",
        toast.type === "error"
          ? "bg-red-600 text-white"
          : "bg-kazi-navy text-white"
      )}
    >
      {toast.message}
    </div>
  );
}
