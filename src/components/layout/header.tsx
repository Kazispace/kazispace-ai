"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { useUIStore } from "@/lib/store";

interface HeaderProps {
  locale: string;
}

export function Header({ locale }: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);

  if (isTelegramMiniApp) return null;

  const navItems = [
    { href: `/${locale}`, label: t("home") },
    { href: `/${locale}/chat`, label: t("chat") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-kazi-navy/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-\[68px\]">
        <Link href={`/${locale}`} className="flex items-center">
          <span className="text-2xl font-bold text-white">
            <span className="text-kazi-orange">Kazi</span>Space
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "text-kazi-orange"
                  : "text-white/75 hover:text-kazi-orange"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/mine`}
            className="text-sm font-medium text-white/75 hover:text-kazi-orange transition-colors"
          >
            {t("profile")}
          </Link>
          <Link
            href={`/${locale}/chat`}
            className="bg-kazi-orange hover:bg-kazi-orange-dark text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {t("chat")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
