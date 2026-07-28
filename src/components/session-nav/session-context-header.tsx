'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, FolderOpen, LayoutGrid, MoreHorizontal, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import { AgentNavIcon } from '@/components/agents/agent-nav-icon';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SessionHeaderDrawer } from '@/components/session-nav/session-header-drawer';
import type { CurrentSessionsByAgent } from '@/lib/current-agent-sessions';
import {
  useSessionFiles,
  useSessionMessageSearch,
} from '@/hooks/use-session-library';
import { useSpaceDetail } from '@/hooks/use-space-detail';
import { useSpaceLifecycle } from '@/hooks/use-space-lifecycle';
import { canRunSpaceLifecycle } from '@/lib/spaces/lifecycle';
import { getDedicatedHubAgentFromPathname, getSurfacePath } from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import {
  formatRegisteredCapabilityLabel,
  resolveActiveCapability,
  shouldUseGlobalAgentForContextHeader,
} from '@/lib/spaces/capability';
import { isClinicChatPathname } from '@/lib/space-nav';
import { publishSessionNavOpenFile, publishSessionNavOpenWorkspaceRail } from '@/lib/session-nav-events';
import {
  resolveContextHeaderSession,
  resolveSessionNavBadge,
} from '@/lib/session-nav';
import {
  formatSessionNavBadgeLabel,
  sessionNavBadgePillClass,
} from '@/lib/session-nav-badges';
import { useAgentStore, useSpaceStore, useUIStore } from '@/lib/store';
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
  const tSpaces = useTranslations('spaces');
  const tRailHub = useTranslations('cv.railHub');
  const showToast = useUIStore((s) => s.showToast);
  const clinicActiveAgentId = useAgentStore((s) => s.activeAgentId);
  const hubAgentId = getDedicatedHubAgentFromPathname(pathname);
  // KAZI-195: space surfaces (incl. clinic entry) ignore global activeAgentId.
  const useGlobalAgent = shouldUseGlobalAgentForContextHeader({
    hubAgentId,
    spaceId,
  });
  const agentId =
    hubAgentId ??
    (useGlobalAgent && isClinicChatPathname(pathname) ? clinicActiveAgentId : null);
  const currentSession = agentId
    ? sessionsByAgent.get(agentId) ?? null
    : resolveContextHeaderSession(pathname, sessionsByAgent);
  const { space, refresh: refreshSpace } = useSpaceDetail(spaceId);
  const spaceActiveCapability = useSpaceStore((s) =>
    spaceId ? s.getSpaceSlice(spaceId).activeCapability : null
  );
  const { run: runLifecycle, pendingAction } = useSpaceLifecycle(locale);
  const [drawer, setDrawer] = useState<HeaderDrawer>(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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

  const { title, titleAgentId, statusLabel, statusKind } = useMemo(() => {
    const agent = agentId
      ? AGENT_REGISTRY.find((entry) => entry.agentId === agentId)
      : undefined;

    if (agent) {
      const name = getAgentLabel(agent, locale, 'name');
      const sessionTitle = currentSession?.title?.trim();
      const titleText = sessionTitle
        ? `${name} · ${sessionTitle}`
        : name;

      const badge = resolveSessionNavBadge(currentSession);
      return {
        title: titleText,
        titleAgentId: agent.agentId,
        statusLabel: badge
          ? formatSessionNavBadgeLabel(
              badge.kind,
              badge.detail ?? currentSession?.pipeline_state,
              (key) => t(key)
            )
          : null,
        statusKind: badge,
      };
    }

    if (spaceId && space) {
      const capabilityId =
        spaceActiveCapability?.trim() ||
        resolveActiveCapability(space.space_state) ||
        null;
      const capabilityLabel = capabilityId
        ? formatRegisteredCapabilityLabel(capabilityId, (id) => {
            const entry = AGENT_REGISTRY.find((a) => a.agentId === id);
            if (!entry) return null;
            return {
              emoji: entry.emoji,
              name: getAgentLabel(entry, locale, 'name'),
            };
          })
        : null;
      return {
        title: `${space.name}`,
        titleAgentId: null as string | null,
        statusLabel: capabilityLabel
          ? capabilityLabel
          : space.status === 'active'
            ? t('badgeInProgress')
            : space.status,
        statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
      };
    }

    if (isClinicChatPathname(pathname) || (spaceId && !space)) {
      return {
        title: t('clinic'),
        titleAgentId: null as string | null,
        statusLabel: null as string | null,
        statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
      };
    }

    return {
      title: t('workspace'),
      titleAgentId: null as string | null,
      statusLabel: null as string | null,
      statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
    };
  }, [
    agentId,
    currentSession,
    locale,
    pathname,
    space,
    spaceActiveCapability,
    spaceId,
    t,
  ]);

  const showSessionActions = Boolean(agentId && currentSession?.session_id);
  // Dedicated hub routes — plain Link back to /chat. Inline clinic agent mode keeps
  // ChatHeader for deactivate (SessionContextHeader cannot call exitToClinic).
  const showBackToClinic = Boolean(hubAgentId);
  const showSpaceLifecycle = Boolean(
    spaceId &&
      space &&
      !space.is_system &&
      !space.is_entry_point &&
      space.id !== CLINIC_SPACE_ID
  );
  const showHeaderActions =
    showSessionActions || showBackToClinic || showSpaceLifecycle;
  const showClinicWorkspaceRail = isClinicChatPathname(pathname);

  const closeDrawer = () => {
    setDrawer(null);
    setSessionSearchQuery('');
  };

  const handleDeleteConfirm = () => {
    if (!space) return;
    setDeleteConfirmOpen(false);
    void (async () => {
      await runLifecycle(space.id, 'delete');
      closeDrawer();
    })();
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
          <h1 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-[#1D2129]">
            {titleAgentId ? (
              <AgentNavIcon agentId={titleAgentId} className="text-kazi-orange" />
            ) : null}
            <span className="truncate">{title}</span>
          </h1>
          {statusLabel && statusKind && (
            <span
              className={cn(
                'hidden min-[400px]:inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                sessionNavBadgePillClass(statusKind.kind)
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showClinicWorkspaceRail ? (
            <button
              type="button"
              onClick={() => publishSessionNavOpenWorkspaceRail()}
              className="rounded-lg p-2 text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]"
              aria-label={tRailHub('openWorkspaceRail')}
              title={tRailHub('openWorkspaceRail')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          ) : null}
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
            </>
          ) : null}
          {showHeaderActions ? (
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
          {showBackToClinic ? (
            <Link
              href={getSurfacePath(locale, 'clinic')}
              onClick={closeDrawer}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#1D2129] hover:bg-[#F2F3F5]"
            >
              {t('backToClinic')}
            </Link>
          ) : null}
          {showSpaceLifecycle && space ? (
            <ul className="space-y-0.5">
              {(
                [
                  ['complete', 'lifecycleComplete'],
                  ['archive', 'lifecycleArchive'],
                  ['restore', 'lifecycleRestore'],
                  ['delete', 'lifecycleDelete'],
                ] as const
              )
                .filter(([action]) => canRunSpaceLifecycle(space, action))
                .map(([action, labelKey]) => (
                  <li key={action}>
                    <button
                      type="button"
                      disabled={pendingAction != null}
                      onClick={() => {
                        if (action === 'delete') {
                          setDeleteConfirmOpen(true);
                          return;
                        }
                        void (async () => {
                          const result = await runLifecycle(space.id, action);
                          closeDrawer();
                          if (result.ok) {
                            await refreshSpace();
                          }
                        })();
                      }}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-[#F2F3F5] disabled:opacity-50',
                        action === 'delete' ? 'text-red-600' : 'text-[#1D2129]'
                      )}
                    >
                      {tSpaces(labelKey)}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </SessionHeaderDrawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={tSpaces('lifecycleDeleteTitle')}
        description={tSpaces('lifecycleDeleteConfirm')}
        confirmLabel={tSpaces('lifecycleDeleteAction')}
        cancelLabel={tSpaces('lifecycleDeleteCancel')}
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
