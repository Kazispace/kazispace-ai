"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, MessageCircle, User } from "lucide-react";

interface BottomNavProps {
  locale: string;
}

export function BottomNav({ locale }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const navItems = [
    { href: `/${locale}`, icon: Home, label: t("home") },
    { href: `/${locale}/chat`, icon: MessageCircle, label: t("chat") },
    { href: `/${locale}/mine`, icon: User, label: t("profile") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden safe-area-inset">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive
                  ? "text-kazi-orange"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
