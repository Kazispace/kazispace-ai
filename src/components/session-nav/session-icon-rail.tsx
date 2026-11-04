'use client';

import Link from 'next/link';
import { Bot, Files, PanelLeftClose, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { SessionNavPanelMode } from '@/lib/session-nav';
import { cn } from '@/lib/utils';
import { markNavIntent } from '@/lib/perf/nav-intent';
import {
  resolveTopLevelDestination,
  topLevelHref,
  type TopLevelDestination,
} from '@/lib/top-level-nav';
import { SessionIconRailCredits } from '@/components/session-nav/session-nav-primary-chrome';
import { TOP_LEVEL_ICONS } from '@/components/navigation/top-level-icons';

interface SessionIconRailProps {
  locale: string;
  panelOpen: boolean;
  panelMode: SessionNavPanelMode;
  /** When true (Spaces MVP), hide list search entry on the rail. */
  spacesMode?: boolean;
  onToggleAgentsPanel: () => void;
  onOpenFilesPanel: () => void;
  onOpenSearchPanel: () => void;
  onOpenMobileDrawer: () => void;
}

export function SessionIconRail({
  locale,
  panelOpen,
  panelMode,
  spacesMode = false,
  onToggleAgentsPanel,
  onOpenFilesPanel,
  onOpenSearchPanel,
  onOpenMobileDrawer,
}: SessionIconRailProps) {
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const tNav = useTranslations('nav');
  const activeDestination = resolveTopLevelDestination(pathname ?? '', locale);

  const handleAgentsClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onOpenMobileDrawer();
      return;
    }
    onToggleAgentsPanel();
  };

  const iconBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg text-workspace-muted transition-colors hover:bg-workspace-hover hover:text-workspace-text',
        // A panel toggle, not a destination: a neutral fill when open, never the blue pill.
        active && 'bg-workspace-hover text-workspace-text'
      )}
    >
      {icon}
    </button>
  );

  // Each destination: icon on a pill with its label below, as in the mobile tab bar
  // (kazispace-ui component "Navigation rail", D31; KAZIOP-3).
  const destinationLink = (destination: TopLevelDestination) => {
    const active = activeDestination === destination;
    const Icon = TOP_LEVEL_ICONS[destination];
    return (
      <Link
        href={topLevelHref(locale, destination)}
        prefetch={destination === 'space' ? undefined : false}
        onClick={() => markNavIntent()}
        aria-current={active ? 'page' : undefined}
        data-testid={`rail-${destination}`}
        className={cn(
          'group flex w-16 flex-col items-center gap-1 rounded-lg py-1.5 text-xs leading-4 transition-colors',
          active ? 'font-semibold text-workspace-text' : 'font-medium text-workspace-secondary hover:text-workspace-text'
        )}
      >
        <span
          data-testid={active ? 'rail-pill' : undefined}
          className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
            active ? 'bg-primary text-tab-bar-icon-active' : 'group-hover:bg-workspace-hover'
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {tNav(destination)}
      </Link>
    );
  };

  const agentsActive = panelOpen && panelMode === 'agents';
  const filesActive = panelOpen && panelMode === 'files';
  const searchActive = panelOpen && panelMode === 'search';

  return (
    <nav
      aria-label={t('iconRail')}
      className="hidden md:flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-workspace-border bg-workspace-bg py-3"
    >
      <Link
        href={`/${locale}`}
        onClick={() => markNavIntent()}
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg"
        aria-label="KaziSpace"
      >
        {/* Brand mark (kazispace-ui decisions D10); the link carries the accessible name. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/kazispace-mark.png" alt="" width={32} height={32} className="h-8 w-8" />
      </Link>

      {/* Top-level destinations, same order as the mobile tab bar (kazispace-ui D2). */}
      <div className="flex flex-col items-center gap-2">
        {destinationLink('space')}
        {destinationLink('studio')}
        {destinationLink('me')}
      </div>

      <div className="my-2 h-px w-8 bg-workspace-border" aria-hidden />

      {iconBtn(agentsActive, handleAgentsClick, t('agents'), <Bot className="h-5 w-5" />)}
      {iconBtn(filesActive, onOpenFilesPanel, t('files'), <Files className="h-5 w-5" />)}
      {!spacesMode
        ? iconBtn(searchActive, onOpenSearchPanel, t('search'), <Search className="h-5 w-5" />)
        : null}

      <div className="mt-auto flex flex-col items-center gap-1">
        <SessionIconRailCredits locale={locale} />
        {panelOpen && (
          <button
            type="button"
            onClick={() => {
              if (panelMode === 'agents') onToggleAgentsPanel();
              else if (panelMode === 'files') onOpenFilesPanel();
              else onOpenSearchPanel();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-workspace-muted hover:bg-workspace-hover"
            aria-label={t('collapsePanel')}
            title={t('collapsePanel')}
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>
    </nav>
  );
}
