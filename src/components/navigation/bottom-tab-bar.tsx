'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, LayoutGrid, User } from 'lucide-react';
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

const ICONS: Record<TopLevelDestination, typeof LayoutGrid> = {
  space: LayoutGrid,
  studio: FolderOpen,
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
 * Mobile top-level navigation: Space · Studio · Me (KAZI-1171; kazispace-ui decisions D2, D20,
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
      className="shrink-0 border-t border-tab-bar-border bg-tab-bar-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {/* Page navigation, not a tab widget: links + aria-current (kazispace-ui tab bar
          spec, "Accessibility"). Tab roles would announce "tab 1 of 3" and promise
          arrow-key movement that links do not have. */}
      <ul className="flex h-14">
        {TOP_LEVEL_DESTINATIONS.map((destination) => {
          const Icon = ICONS[destination];
          const selected = destination === active;
          return (
            <li key={destination} className="flex flex-1">
              <Link
                aria-current={selected ? 'page' : undefined}
                href={topLevelHref(locale, destination)}
                onClick={() => markNavIntent()}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
                  selected ? 'text-tab-bar-item-active' : 'text-tab-bar-item'
                )}
              >
                {/* Active icon sits on a pill (tab bar spec, "Anatomy"), so the
                    current destination is not marked by colour alone. */}
                <span
                  data-testid={selected ? 'tab-bar-pill' : undefined}
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full',
                    selected && 'bg-primary text-tab-bar-icon-active'
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                {t(destination)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
