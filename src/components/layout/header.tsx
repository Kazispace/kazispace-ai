"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { LocaleSwitcher } from "@/components/locale/locale-switcher";
import {
  isClinicNavHref,
  useHubClinicNav,
} from "@/hooks/use-hub-clinic-nav";
import { useUIStore } from "@/lib/store";

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const { goToClinic, isDeactivating, isOnHub } = useHubClinicNav(locale);

  if (isTelegramMiniApp) return null;

  const navItems = [
    { href: `/${locale}`, label: t("home") },
    { href: `/${locale}/chat`, label: t("chat") },
  ];

  const renderClinicNav = (href: string, label: string, className: string) => {
    if (isOnHub && isClinicNavHref(href, locale)) {
      return (
        <button
          key={href}
          type="button"
          disabled={isDeactivating}
          onClick={() => void goToClinic()}
          className={className}
        >
          {isDeactivating ? (
            <Loader2 className="h-4 w-4 animate-spin inline" aria-hidden />
          ) : (
            label
          )}
        </button>
      );
    }

    return (
      <Link key={href} href={href} className={className}>
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-kazi-navy/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-\[68px\]">
        {isOnHub ? (
          <button
            type="button"
            disabled={isDeactivating}
            onClick={() => void goToClinic()}
            className="flex items-center"
          >
            <span className="text-2xl font-bold text-white">
              <span className="text-kazi-orange">Kazi</span>Space
            </span>
          </button>
        ) : (
          <Link href={`/${locale}`} className="flex items-center">
            <span className="text-2xl font-bold text-white">
              <span className="text-kazi-orange">Kazi</span>Space
            </span>
          </Link>
        )}

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) =>
            renderClinicNav(
              item.href,
              item.label,
              `text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "text-kazi-orange"
                  : "text-white/75 hover:text-kazi-orange"
              }`
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher locale={locale} variant="header" />
          <Link
            href={`/${locale}/mine`}
            className="text-sm font-medium text-white/75 hover:text-kazi-orange transition-colors"
          >
            {t("profile")}
          </Link>
          {renderClinicNav(
            `/${locale}/chat`,
            t("chat"),
            "bg-kazi-orange hover:bg-kazi-orange-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          )}
        </div>
      </div>
    </nav>
  );
}
