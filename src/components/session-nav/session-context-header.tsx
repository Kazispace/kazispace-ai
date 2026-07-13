'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, FolderOpen, MoreHorizontal, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import { SessionHeaderDrawer } from '@/components/session-nav/session-header-drawer';
import type { CurrentSessionsByAgent } from '@/lib/current-agent-sessions';
import {
  useSessionFiles,
  useSessionMessageSearch,
} from '@/hooks/use-session-library';
import { useSpaceDetail } from '@/hooks/use-space-detail';
import { getDedicatedHubAgentFromPathname, getSurfacePath } from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { publishSessionNavOpenFile } from '@/lib/session-nav-events';
import {
  resolveContextHeaderSession,
  resolveSessionNavBadge,
} from '@/lib/session-nav';
import {
  formatSessionNavBadgeLabel,
  sessionNavBadgePillClass,
} from '@/lib/session-nav-badges';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { SessionLibraryFile } from '@/types/session-library';

interface SessionContextHeaderProps {
  locale: string;
  sessionsByAgent: CurrentSessionsByAgent;
  spaceId?: string | null;
}

type HeaderDrawer = 'files' | 'search' | 'more' | null;

export function SessionContextHeader({
  locale,
  sessionsByAgent,
  spaceId = null,
}: SessionContextHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const showToast = useUIStore((s) => s.showToast);
  const currentSession = resolveContextHeaderSession(pathname, sessionsByAgent);
  const agentId = getDedicatedHubAgentFromPathname(pathname);
  const { space } = useSpaceDetail(spaceId);
  const [drawer, setDrawer] = useState<HeaderDrawer>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  const { files, isLoading: filesLoading } = useSessionFiles(
    currentSession?.session_id ?? null,
    agentId,
    drawer === 'files'
  );
  const { hits: messageHits, isLoading: searchLoading, error: searchError } =
    useSessionMessageSearch(
    currentSession?.session_id ?? null,
    sessionSearchQuery,
    drawer === 'search'
  );

  const { title, statusLabel, statusKind } = useMemo(() => {
    if (spaceId && space) {
      return {
        title: `${space.name}`,
        statusLabel: space.status === 'active' ? t('badgeInProgress') : space.status,
        statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
      };
    }

    const agent = agentId
      ? AGENT_REGISTRY.find((entry) => entry.agentId === agentId)
      : undefined;

    if (!agent) {
      return {
        title: t('workspace'),
        statusLabel: null as string | null,
        statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
      };
    }

    const name = getAgentLabel(agent, locale, 'name');
    const sessionTitle = currentSession?.title?.trim();
    const titleText = sessionTitle
      ? `${agent.emoji} ${name} · ${sessionTitle}`
      : `${agent.emoji} ${name}`;

    const badge = resolveSessionNavBadge(currentSession);
    const statusLabel = badge
      ? formatSessionNavBadgeLabel(badge.kind, badge.detail ?? currentSession?.pipeline_state, (key) =>
          t(key)
        )
      : null;

    return {
      title: titleText,
      statusLabel,
      statusKind: badge,
    };
  }, [agentId, currentSession, locale, space, spaceId, t]);

  const showSessionActions = Boolean(agentId && currentSession?.session_id);

  const closeDrawer = () => {
    setDrawer(null);
    setSessionSearchQuery('');
  };

  const handleOpenSessionFile = (file: SessionLibraryFile) => {
    if (file.download_url) {
      window.open(file.download_url, '_blank', 'noopener,noreferrer');
      closeDrawer();
      return;
    }
    if (
      agentId === CV_BUILDER_AGENT_ID &&
      file.session_id &&
      file.name === 'resume.md'
    ) {
      publishSessionNavOpenFile({
        agentId,
        sessionId: file.session_id,
        fileName: file.name,
      });
      closeDrawer();
      return;
    }
    showToast(t('filePreviewUnavailable'), 'info');
  };

  return (
    <div className="relative shrink-0">
      <header className="flex h-12 items-center justify-between gap-3 border-b border-[#E5E6EB] bg-white px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-[#1D2129]">{title}</h1>
          {statusLabel && statusKind && (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                sessionNavBadgePillClass(statusKind.kind)
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showSessionActions ? (
            <>
              <button
                type="button"
                onClick={() => setDrawer(drawer === 'files' ? null : 'files')}
                className={cn(
                  'rounded-lg p-2 text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]',
                  drawer === 'files' && 'bg-[#FFF4EC] text-kazi-orange'
                )}
                aria-label={t('sessionFiles')}
                title={t('sessionFiles')}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDrawer(drawer === 'search' ? null : 'search')}
                className={cn(
                  'rounded-lg p-2 text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]',
                  drawer === 'search' && 'bg-[#FFF4EC] text-kazi-orange'
                )}
                aria-label={t('sessionSearch')}
                title={t('sessionSearch')}
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDrawer(drawer === 'more' ? null : 'more')}
                className={cn(
                  'rounded-lg p-2 text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]',
                  drawer === 'more' && 'bg-[#FFF4EC] text-kazi-orange'
                )}
                aria-label={t('moreActions')}
                title={t('moreActions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </>
          ) : null}
          <LocaleSwitcher locale={locale} />
        </div>
      </header>

      <SessionHeaderDrawer
        open={drawer === 'files'}
        title={t('sessionFiles')}
        onClose={closeDrawer}
      >
        <ul className="p-2">
          {filesLoading ? (
            Array.from({ length: 2 }).map((_, index) => (
              <li key={`session-file-skeleton-${index}`} className="rounded-lg px-3 py-2.5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F3F5]" />
              </li>
            ))
          ) : files.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#86909C]">{t('noFiles')}</li>
          ) : (
            files.map((file) => (
              <li key={file.file_id}>
                <button
                  type="button"
                  onClick={() => handleOpenSessionFile(file)}
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-[#F2F3F5]"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#86909C]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#1D2129]">
                      {file.name}
                    </span>
                    {file.mime_type ? (
                      <span className="mt-0.5 block truncate text-xs text-[#86909C]">
                        {file.mime_type}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </SessionHeaderDrawer>

      <SessionHeaderDrawer
        open={drawer === 'search'}
        title={t('searchInSession')}
        onClose={closeDrawer}
      >
        <div className="border-b border-[#F2F3F5] px-3 py-2">
          <input
            type="search"
            value={sessionSearchQuery}
            onChange={(event) => setSessionSearchQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-[#E5E6EB] bg-[#FAFBFC] px-3 py-2 text-sm text-[#1D2129] placeholder:text-[#86909C] focus:border-kazi-orange focus:outline-none"
          />
        </div>
        <ul className="p-2">
          {searchError ? (
            <li className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {searchError}
            </li>
          ) : null}
          {!sessionSearchQuery.trim() ? (
            <li className="px-3 py-6 text-center text-sm text-[#86909C]">
              {t('searchInSession')}
            </li>
          ) : searchLoading ? (
            Array.from({ length: 2 }).map((_, index) => (
              <li key={`session-search-skeleton-${index}`} className="rounded-lg px-3 py-2.5">
                <div className="h-4 w-full animate-pulse rounded bg-[#F2F3F5]" />
              </li>
            ))
          ) : messageHits.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#86909C]">
              {t('noSearchResults')}
            </li>
          ) : (
            messageHits.map((hit) => (
              <li key={hit.message_id} className="rounded-lg px-3 py-2.5">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-[#86909C]">
                  {hit.role}
                </span>
                <span className="mt-0.5 block text-sm text-[#1D2129]">{hit.snippet}</span>
              </li>
            ))
          )}
        </ul>
      </SessionHeaderDrawer>

      <SessionHeaderDrawer open={drawer === 'more'} title={t('moreActions')} onClose={closeDrawer}>
        <div className="p-2">
          <Link
            href={getSurfacePath(locale, 'clinic')}
            onClick={closeDrawer}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#1D2129] hover:bg-[#F2F3F5]"
          >
            {t('backToClinic')}
          </Link>
        </div>
      </SessionHeaderDrawer>
    </div>
  );
}
