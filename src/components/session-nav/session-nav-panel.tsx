'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, PanelLeftClose, Plus, Search, X } from 'lucide-react';

import { AgentSessionList } from '@/components/agent/agent-session-list';
import type { CurrentSessionsByAgent } from '@/hooks/use-active-agent-sessions';
import { useAgentSessionList } from '@/hooks/use-agent-session-list';
import {
  buildSessionNavRows,
  buildSessionViewRows,
  enrichSessionNavRows,
  filterSessionNavRows,
  filterSessionViewRows,
  navigateToSessionNavTarget,
  openAgentSessionTarget,
  resolveActiveNavRowId,
  type SessionNavBadgeKind,
  type SessionNavRow,
  type SessionNavViewTab,
  type SessionViewRow,
} from '@/lib/session-nav';
import { cn } from '@/lib/utils';

interface SessionNavPanelProps {
  locale: string;
  open: boolean;
  mobileDrawer: boolean;
  viewTab: SessionNavViewTab;
  onViewTabChange: (tab: SessionNavViewTab) => void;
  expandedAgentId: string | null;
  onExpandedAgentIdChange: (agentId: string | null) => void;
  activeHubAgentId: string | null;
  sessionsByAgent: CurrentSessionsByAgent;
  isLoading?: boolean;
  fetchError?: string | null;
  actionsDisabled?: boolean;
  onClose: () => void;
  onNewSession?: (agentId: string) => void;
  onExitSession?: (agentId: string) => void;
}

function rowBadgeText(
  badge: SessionNavBadgeKind | undefined,
  badgeDetail: string | null | undefined,
  t: ReturnType<typeof useTranslations<'sessionNav'>>
): string | null {
  if (!badge) return null;
  const kindLabels: Record<SessionNavBadgeKind, string> = {
    comingSoon: t('comingSoon'),
    clinicInline: t('clinicInlineHint'),
    inProgress: t('badgeInProgress'),
    resumable: t('badgeResumable'),
    archived: t('badgeArchived'),
    notStarted: t('badgeNotStarted'),
    pipeline: badgeDetail ?? t('badgeInProgress'),
  };
  return kindLabels[badge] ?? null;
}

function AgentRowHistory({
  agentId,
  activeSessionId,
  disabled,
  onSelect,
}: {
  agentId: string;
  activeSessionId: string | null;
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
}) {
  const { sessions, isLoading } = useAgentSessionList(agentId, true);
  return (
    <div className="border-t border-[#F2F3F5] bg-[#FAFBFC] px-1 py-1">
      <AgentSessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoading}
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  );
}

export function SessionNavPanel({
  locale,
  open,
  mobileDrawer,
  viewTab,
  onViewTabChange,
  expandedAgentId,
  onExpandedAgentIdChange,
  activeHubAgentId,
  sessionsByAgent,
  isLoading = false,
  fetchError = null,
  actionsDisabled = false,
  onClose,
  onNewSession,
  onExitSession,
}: SessionNavPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const [listQuery, setListQuery] = useState('');

  const agentRows = useMemo(() => {
    const base = buildSessionNavRows(locale, t('clinic'));
    return filterSessionNavRows(enrichSessionNavRows(base, sessionsByAgent), listQuery);
  }, [listQuery, locale, sessionsByAgent, t]);

  const sessionRows = useMemo(
    () =>
      filterSessionViewRows(
        buildSessionViewRows(locale, t('clinic'), sessionsByAgent),
        listQuery
      ),
    [listQuery, locale, sessionsByAgent, t]
  );

  const activeId = resolveActiveNavRowId(pathname);
  const showHubActions = Boolean(activeHubAgentId) && viewTab === 'agent';

  useEffect(() => {
    if (!mobileDrawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileDrawer, onClose]);

  const renderAgentRow = (row: SessionNavRow) => {
    const isActive = row.id === activeId;
    const badge = rowBadgeText(row.badge, row.badgeDetail, t);
    const canExpand = Boolean(row.agentId && row.href && !row.disabled);
    const isExpanded = canExpand && expandedAgentId === row.agentId;
    const currentSessionId =
      row.agentId && sessionsByAgent.get(row.agentId)?.session_id
        ? sessionsByAgent.get(row.agentId)!.session_id
        : null;

    return (
      <li key={row.id}>
        <div
          className={cn(
            'rounded-lg transition-colors',
            isActive && 'bg-[#FFF4EC]'
          )}
        >
          <div className="flex items-stretch">
            {canExpand ? (
              <button
                type="button"
                className="flex w-8 shrink-0 items-center justify-center text-[#86909C] hover:text-[#1D2129]"
                aria-label={isExpanded ? t('collapseHistory') : t('expandHistory')}
                onClick={() =>
                  onExpandedAgentIdChange(isExpanded ? null : row.agentId)
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-8 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              disabled={row.disabled}
              onClick={() => {
                navigateToSessionNavTarget(router, row);
                if (mobileDrawer) onClose();
              }}
              className={cn(
                'min-w-0 flex-1 rounded-lg px-2 py-2.5 text-left transition-colors',
                row.disabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:bg-[#F2F3F5]',
                !isActive && !row.disabled && 'text-[#1D2129]'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden>
                  {row.emoji}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {row.displayName}
                </span>
              </div>
              {badge && (
                <p className="mt-0.5 pl-7 text-xs text-[#86909C]">{badge}</p>
              )}
            </button>
          </div>
          {isExpanded && row.agentId ? (
            <AgentRowHistory
              agentId={row.agentId}
              activeSessionId={currentSessionId}
              disabled={actionsDisabled}
              onSelect={(sessionId) => {
                openAgentSessionTarget(router, pathname, locale, row.agentId!, sessionId);
                if (mobileDrawer) onClose();
              }}
            />
          ) : null}
        </div>
      </li>
    );
  };

  const renderSessionRow = (row: SessionViewRow) => {
    const isClinic = row.kind === 'clinic';
    const isActive = isClinic
      ? activeId === 'clinic'
      : row.agentId != null && activeId === row.agentId;
    const badge = rowBadgeText(row.badge, row.badgeDetail, t);
    const label = row.sessionTitle
      ? `${row.displayName} · ${row.sessionTitle}`
      : row.displayName;

    return (
      <li key={row.id}>
        <button
          type="button"
          onClick={() => {
            if (!isClinic && row.agentId && row.session?.session_id) {
              openAgentSessionTarget(
                router,
                pathname,
                locale,
                row.agentId,
                row.session.session_id
              );
            } else {
              router.push(row.href);
            }
            if (mobileDrawer) onClose();
          }}
          className={cn(
            'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
            isActive && 'bg-[#FFF4EC]',
            'hover:bg-[#F2F3F5] text-[#1D2129]'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden>
              {row.emoji}
            </span>
            <span className="flex-1 truncate text-sm font-medium">{label}</span>
          </div>
          {badge && (
            <p className="mt-0.5 pl-7 text-xs text-[#86909C]">{badge}</p>
          )}
        </button>
      </li>
    );
  };

  const panelBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#E5E6EB] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 rounded-lg bg-[#F2F3F5] p-0.5">
            <button
              type="button"
              onClick={() => onViewTabChange('agent')}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                viewTab === 'agent'
                  ? 'bg-white text-[#1D2129] shadow-sm'
                  : 'text-[#86909C]'
              )}
            >
              {t('tabAgent')}
            </button>
            <button
              type="button"
              onClick={() => onViewTabChange('session')}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                viewTab === 'session'
                  ? 'bg-white text-[#1D2129] shadow-sm'
                  : 'text-[#86909C]'
              )}
            >
              {t('tabSession')}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
            aria-label={t('collapsePanel')}
          >
            {mobileDrawer ? <X className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {fetchError && (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('refreshFailed')}
        </p>
      )}

      <div className="border-b border-[#E5E6EB] px-3 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
          <input
            type="search"
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            placeholder={t('panelSearchPlaceholder')}
            className="w-full rounded-lg border border-[#E5E6EB] bg-[#FAFBFC] py-2 pl-8 pr-3 text-sm text-[#1D2129] placeholder:text-[#86909C] focus:border-kazi-orange focus:outline-none"
          />
        </label>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {isLoading &&
        (viewTab === 'agent'
          ? agentRows.every((row) => !row.currentSession)
          : sessionRows.length <= 1) ? (
          Array.from({ length: 3 }).map((_, index) => (
            <li key={`skeleton-${index}`} className="rounded-lg px-3 py-2.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F3F5]" />
              <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[#F2F3F5]" />
            </li>
          ))
        ) : viewTab === 'agent' ? (
          agentRows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#86909C]">
              {t('noSearchResults')}
            </li>
          ) : (
            agentRows.map(renderAgentRow)
          )
        ) : sessionRows.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-[#86909C]">
            {t('noSearchResults')}
          </li>
        ) : (
          sessionRows.map(renderSessionRow)
        )}
      </ul>

      {showHubActions && activeHubAgentId ? (
        <div className="flex shrink-0 gap-1 border-t border-[#E5E6EB] p-2">
          {onNewSession ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => onNewSession(activeHubAgentId)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E5E6EB] px-2 py-2 text-xs font-medium text-[#1D2129] hover:bg-[#F2F3F5] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newSession')}
            </button>
          ) : null}
          {onExitSession ? (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => onExitSession(activeHubAgentId)}
              className="flex flex-1 items-center justify-center rounded-lg border border-[#E5E6EB] px-2 py-2 text-xs font-medium text-[#4E5969] hover:bg-[#F2F3F5] disabled:opacity-50"
            >
              {t('exitSession')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (mobileDrawer) {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label={t('collapsePanel')}
          onClick={onClose}
        />
        <aside className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] shadow-xl md:hidden">
          {panelBody}
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'hidden shrink-0 overflow-hidden border-r border-[#E5E6EB] transition-[width] duration-200 ease-out md:block',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="h-full w-[260px]">{panelBody}</div>
    </aside>
  );
}
