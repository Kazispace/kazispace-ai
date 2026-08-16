"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { LocaleSwitcher } from "@/components/locale/locale-switcher";
import {
  isHubExitDestination,
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
  const { handleHubExitClick, isDeactivating, isOnHub } =
    useHubClinicNav(locale);

  if (isTelegramMiniApp) return null;

  const homeHref = `/${locale}`;
  const chatHref = `/${locale}/chat`;

  const navItems = [
    { href: homeHref, label: t("home") },
    { href: chatHref, label: t("chat") },
  ];

  const renderClinicNav = (href: string, label: string, className: string) => (
    <Link
      key={href}
      href={href}
      onClick={(event) => handleHubExitClick(event, href)}
      aria-disabled={isOnHub && isHubExitDestination(href, locale) && isDeactivating}
      className={className}
    >
      {isDeactivating && isOnHub && isHubExitDestination(href, locale) ? (
        <Loader2 className="h-4 w-4 animate-spin inline" aria-hidden />
      ) : (
        label
      )}
    </Link>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-kazi-navy/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-\[68px\]">
        <Link
          href={homeHref}
          onClick={(event) => handleHubExitClick(event, homeHref)}
          aria-disabled={isOnHub && isDeactivating}
          className="flex items-center"
        >
          <span className="text-2xl font-bold text-white">
            <span className="text-kazi-orange">Kazi</span>Space
          </span>
        </Link>

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
            prefetch={false}
            className="text-sm font-medium text-white/75 hover:text-kazi-orange transition-colors"
          >
            {t("profile")}
          </Link>
          {renderClinicNav(
            chatHref,
            t("chat"),
            "bg-kazi-orange hover:bg-kazi-orange-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          )}
        </div>
      </div>
    </nav>
  );
}
