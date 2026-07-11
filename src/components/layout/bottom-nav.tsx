'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, MessageCircle, Briefcase, User, Loader2 } from 'lucide-react';

import { isClinicNavHref, useHubClinicNav } from '@/hooks/use-hub-clinic-nav';
import { getDedicatedHubAgentFromPathname } from '@/lib/agent-layer';
import { useUIStore } from '@/lib/store';

interface BottomNavProps {
  locale: string;
  /** Map current pathname → nav href to highlight (e.g. /profile → /mine tab). */
  activeAliases?: Record<string, string>;
}

export function BottomNav({ locale, activeAliases }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const { goToClinic, isDeactivating: isLeavingHub } = useHubClinicNav(locale);
  const hubAgentId = getDedicatedHubAgentFromPathname(pathname);

  if (isTelegramMiniApp) return null;

  const navItems = [
    { href: `/${locale}`, icon: Home, label: t("home"), matchPrefix: false },
    { href: `/${locale}/chat`, icon: MessageCircle, label: t("chat"), matchPrefix: false },
    { href: `/${locale}/jobs`, icon: Briefcase, label: t("jobs"), matchPrefix: true },
    { href: `/${locale}/mine`, icon: User, label: t("profile"), matchPrefix: false },
  ];

  const isNavItemActive = (
    item: (typeof navItems)[number]
  ): boolean => {
    const aliasTarget = activeAliases?.[pathname];
    if (aliasTarget === item.href) return true;
    return item.matchPrefix
      ? pathname.startsWith(item.href)
      : pathname === item.href;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden safe-area-inset">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item);
          const isClinicDest = isClinicNavHref(item.href, locale);
          const needsDeactivate = isClinicDest && Boolean(hubAgentId);

          if (needsDeactivate) {
            return (
              <button
                key={item.href}
                type="button"
                disabled={isLeavingHub}
                onClick={() => void goToClinic()}
                className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                  isActive
                    ? 'text-kazi-orange'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {isLeavingHub ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                ) : (
                  <item.icon className="w-5 h-5" />
                )}
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          }

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
