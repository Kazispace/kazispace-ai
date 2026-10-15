'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, MessageCircle, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { markNavIntent } from '@/lib/perf/nav-intent';
import { useUIStore } from '@/lib/store';
import {
  TOP_LEVEL_DESTINATIONS,
  isTopLevelScreen,
  resolveTopLevelDestination,
  topLevelHref,
  type TopLevelDestination,
} from '@/lib/top-level-nav';
import { cn } from '@/lib/utils';

const ICONS: Record<TopLevelDestination, typeof MessageCircle> = {
  chat: MessageCircle,
  assets: FolderOpen,
  me: User,
};

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'].includes(target.type)
  );
}

/**
 * True while a text field has focus, which on a phone means the on-screen
 * keyboard is open. The tab bar hides then, so the composer keeps its space
 * (kazispace-ui tab bar spec, "Hidden" state).
 */
function useTextEntryFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setFocused(isTextEntry(event.target));
    const onFocusOut = () => setFocused(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
  return focused;
}

/**
 * Mobile top-level navigation: Chat · Assets · Me (kazispace-ui decisions D2,
 * component spec "Tab bar"). Below 768px only; desktop uses the icon rail.
 */
export function BottomTabBar({ locale }: { locale: string }) {
  const pathname = usePathname() ?? '';
  const t = useTranslations('nav');
  const keyboardOpen = useTextEntryFocused();
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const active = resolveTopLevelDestination(pathname, locale);

  // Mini programs have no app-level navigation (kazispace-ui decisions D3);
  // sub-screens (job detail, credits, …) use back navigation instead.
  if (keyboardOpen || isTelegramMiniApp || !isTopLevelScreen(pathname, locale)) return null;

  return (
    <nav
      aria-label={t('primary')}
      data-testid="bottom-tab-bar"
      className="shrink-0 border-t border-workspace-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul role="tablist" className="flex h-14">
        {TOP_LEVEL_DESTINATIONS.map((destination) => {
          const Icon = ICONS[destination];
          const selected = destination === active;
          return (
            <li key={destination} role="presentation" className="flex flex-1">
              <Link
                role="tab"
                aria-selected={selected}
                href={topLevelHref(locale, destination)}
                onClick={() => markNavIntent()}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
                  selected ? 'text-primary' : 'text-workspace-secondary'
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                {t(destination)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
