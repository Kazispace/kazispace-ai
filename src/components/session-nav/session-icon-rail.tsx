'use client';

import Link from 'next/link';
import {
  Bot,
  FolderOpen,
  MessageCircle,
  PanelLeftClose,
  Search,
  Settings,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { SessionNavPanelMode } from '@/lib/session-nav';
import { cn } from '@/lib/utils';
import { markNavIntent } from '@/lib/perf/nav-intent';
import { getSurfacePath } from '@/lib/agent-transition/surfaces';
import { SessionIconRailCredits } from '@/components/session-nav/session-nav-primary-chrome';

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
  const isClinic = pathname.includes(`/${locale}/chat`);

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
        'relative flex h-10 w-10 items-center justify-center rounded-lg text-workspace-muted transition-colors hover:bg-workspace-hover hover:text-workspace-text',
        active &&
          'bg-workspace-active text-primary before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-primary'
      )}
    >
      {icon}
    </button>
  );

  const agentsActive = panelOpen && panelMode === 'agents';
  const filesActive = panelOpen && panelMode === 'files';
  const searchActive = panelOpen && panelMode === 'search';

  return (
    <nav
      aria-label={t('iconRail')}
      className="hidden md:flex w-12 shrink-0 flex-col items-center gap-1 border-r border-workspace-border bg-workspace-bg py-3"
    >
      <Link
        href={`/${locale}`}
        onClick={() => markNavIntent()}
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-primary"
        aria-label="KaziSpace"
      >
        K
      </Link>

      <Link
        href={getSurfacePath(locale, 'clinic')}
        onClick={() => markNavIntent()}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          isClinic
            ? 'bg-workspace-active text-primary before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-primary'
            : 'text-workspace-muted hover:bg-workspace-hover'
        )}
        aria-label={t('clinic')}
        title={t('clinic')}
      >
        <MessageCircle className="h-5 w-5" />
      </Link>

      {iconBtn(agentsActive, handleAgentsClick, t('agents'), <Bot className="h-5 w-5" />)}
      {iconBtn(filesActive, onOpenFilesPanel, t('files'), <FolderOpen className="h-5 w-5" />)}
      {!spacesMode
        ? iconBtn(searchActive, onOpenSearchPanel, t('search'), <Search className="h-5 w-5" />)
        : null}

      <div className="mt-auto flex flex-col items-center gap-1">
        <SessionIconRailCredits locale={locale} />
        <Link
          href={`/${locale}/mine`}
          prefetch={false}
          onClick={() => markNavIntent()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-workspace-muted hover:bg-workspace-hover"
          aria-label={t('settings')}
          title={t('settings')}
        >
          <Settings className="h-5 w-5" />
        </Link>
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
