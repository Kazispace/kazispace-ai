"use client";

import { usePathname } from "next/navigation";
import { RouteLocaleSync } from "@/components/locale/route-locale-sync";
import { MasterSessionSync } from "@/components/master-session-sync";
import { ToastHost } from "@/components/ui/toast";
import { PaywallModal } from "@/components/billing/paywall-modal";
import { DEFAULT_LOCALE } from "@/lib/constants";

function localeFromPathname(pathname: string): string {
  const segment = pathname.split("/")[1];
  return segment || DEFAULT_LOCALE;
}

export function AppChrome() {
  const pathname = usePathname();
  return (
    <>
      <RouteLocaleSync />
      <MasterSessionSync />
      <ToastHost />
      <PaywallModal locale={localeFromPathname(pathname)} />
    </>
  );
}
