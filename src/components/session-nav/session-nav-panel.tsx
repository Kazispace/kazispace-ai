'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { AgentNavIcon, SpaceTemplateNavIcon } from '@/components/agents/agent-nav-icon';
import {
  PRIMARY_ICON_STROKE,
  SessionNavPrimaryIconButton,
} from '@/components/session-nav/session-nav-primary-chrome';
import { SpaceListScopeMenu } from '@/components/session-nav/space-list-scope-menu';
import { AgentSessionList } from '@/components/agent/agent-session-list';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CurrentSessionsByAgent } from '@/lib/current-agent-sessions';
import { useAgentSessionList } from '@/hooks/use-agent-session-list';
import {
  formatSessionNavBadgeLabel,
} from '@/lib/session-nav-badges';
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
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import {
  isPrefetchableSpaceNavId,
  prefetchSpaceSwitch,
} from '@/lib/spaces/prefetch-space-switch';
import { filterSpaceNavRows, type SpaceNavFilter } from '@/lib/space-nav';
import { canRunSpaceLifecycle, type SpaceLifecycleAction } from '@/lib/spaces/lifecycle';
import { cn } from '@/lib/utils';
import type { SpaceSummary } from '@/types/spaces';

function rowLeadingIcon(
  row: SessionNavRow | SessionViewRow,
  space?: SpaceSummary | null
) {
  if (space) {
    return (
      <SpaceTemplateNavIcon
        templateId={space.template_id}
        spaceId={space.id}
      />
    );
  }
  if (row.agentId) {
    return <AgentNavIcon agentId={row.agentId} />;
  }
  if (row.id === 'clinic' || row.id === CLINIC_SPACE_ID) {
    return <AgentNavIcon agentId="clinic" />;
  }
  return <AgentNavIcon agentId={null} />;
}

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
  /** ADR-006: Spaces list mode (replaces agent/session tabs). */
  spacesMode?: boolean;
  spaceRows?: SessionNavRow[];
  spaces?: SpaceSummary[];
  onNewSpace?: () => void;
  onSpaceAction?: (spaceId: string, action: SpaceLifecycleAction) => Promise<void>;
  /** Space currently running a lifecycle action (null = none). */
  spaceActionPendingId?: string | null;
  /** Current status filter for the space list. */
  spaceFilter?: SpaceNavFilter;
  onSpaceFilterChange?: (filter: SpaceNavFilter) => void;
}

function rowBadgeText(
  badge: SessionNavBadgeKind | undefined,
  badgeDetail: string | null | undefined,
  t: ReturnType<typeof useTranslations<'sessionNav'>>
): string | null {
  if (!badge) return null;
  return formatSessionNavBadgeLabel(badge, badgeDetail, (key) => t(key));
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
  spacesMode = false,
  spaceRows = [],
  spaces = [],
  onNewSpace,
  onSpaceAction,
  spaceActionPendingId = null,
  spaceFilter = 'active',
  onSpaceFilterChange,
}: SessionNavPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const t = useTranslations('sessionNav');
  const tSpaces = useTranslations('spaces');
  const [listQuery, setListQuery] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLUListElement>(null);

  const agentRows = useMemo(() => {
    const base = buildSessionNavRows(locale, t('clinic'));
    return filterSessionNavRows(enrichSessionNavRows(base, sessionsByAgent), listQuery);
  }, [listQuery, locale, sessionsByAgent, t]);

  const filteredSpaceRows = useMemo(
    () => filterSpaceNavRows(spaceRows, listQuery),
    [listQuery, spaceRows]
  );

  const sessionRows = useMemo(
    () =>
      filterSessionViewRows(
        buildSessionViewRows(locale, t('clinic'), sessionsByAgent),
        listQuery
      ),
    [listQuery, locale, sessionsByAgent, t]
  );

  const spaceLookup = useMemo(() => {
    const map = new Map<string, SpaceSummary>();
    for (const s of spaces) map.set(s.id, s);
    return map;
  }, [spaces]);

  const hasArchivedSpaces = useMemo(
    () => spaces.some((s) => !s.is_entry_point && (s.status === 'archived' || s.status === 'deleted')),
    [spaces]
  );

  const activeId = resolveActiveNavRowId(pathname);
  const showHubActions =
    !spacesMode && Boolean(activeHubAgentId) && viewTab === 'agent';
  const listRows = spacesMode ? filteredSpaceRows : agentRows;

  const prefetchNavRow = useCallback(
    (row: SessionNavRow) => {
      if (row.disabled) return;
      if (row.href) router.prefetch(row.href);
      if (isPrefetchableSpaceNavId(row.id)) {
        prefetchSpaceSwitch(queryClient, {
          spaceId: row.id,
          masterSessionId: row.masterSessionId ?? null,
          locale,
        });
      }
    },
    [locale, queryClient, router]
  );

  const goToNavRow = useCallback(
    (row: SessionNavRow) => {
      prefetchNavRow(row);
      navigateToSessionNavTarget(router, row);
      if (mobileDrawer) onClose();
    },
    [mobileDrawer, onClose, prefetchNavRow, router]
  );

  useEffect(() => {
    if (!mobileDrawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileDrawer, onClose]);

  useEffect(() => {
    if (!contextMenuId) return;
    const onClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    const onScroll = () => setContextMenuId(null);
    document.addEventListener('mousedown', onClick);
    const listEl = listScrollRef.current;
    listEl?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      listEl?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [contextMenuId]);

  const handleFilterChange = useCallback(
    (filter: SpaceNavFilter) => {
      setListQuery('');
      onSpaceFilterChange?.(filter);
    },
    [onSpaceFilterChange]
  );

  const handleSpaceAction = useCallback(
    (spaceId: string, action: SpaceLifecycleAction) => {
      setContextMenuId(null);
      if (action === 'delete') {
        setDeleteConfirmId(spaceId);
        return;
      }
      void onSpaceAction?.(spaceId, action);
    },
    [onSpaceAction]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteConfirmId) return;
    void onSpaceAction?.(deleteConfirmId, 'delete');
    setDeleteConfirmId(null);
  }, [deleteConfirmId, onSpaceAction]);

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
            isActive && 'bg-workspace-active'
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
              onMouseEnter={() => prefetchNavRow(row)}
              onFocus={() => prefetchNavRow(row)}
              onPointerDown={() => prefetchNavRow(row)}
              onClick={() => goToNavRow(row)}
              className={cn(
                'min-w-0 flex-1 rounded-lg px-2 py-3 text-left transition-colors',
                row.disabled
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:bg-[#F2F3F5]',
                !isActive && !row.disabled && 'text-[#1D2129]'
              )}
            >
              <div className="flex items-center gap-2.5">
                {rowLeadingIcon(row)}
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
            'w-full rounded-lg px-3 py-3 text-left transition-colors',
            isActive && 'bg-workspace-active',
            'hover:bg-[#F2F3F5] text-[#1D2129]'
          )}
        >
          <div className="flex items-center gap-2.5">
            {rowLeadingIcon(row)}
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
      <div className="border-b border-[#E5E6EB] px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          {spacesMode ? (
            <>
              <SpaceListScopeMenu
                spaceFilter={spaceFilter}
                hasArchivedSpaces={hasArchivedSpaces}
                onFilterChange={handleFilterChange}
              />
              {onNewSpace ? (
                <SessionNavPrimaryIconButton
                  disabled={actionsDisabled}
                  onClick={onNewSpace}
                  aria-label={t('newSpace')}
                  title={t('newSpace')}
                >
                  <Plus className="h-4 w-4" strokeWidth={PRIMARY_ICON_STROKE} />
                </SessionNavPrimaryIconButton>
              ) : null}
            </>
          ) : (
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
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#86909C] hover:bg-[#F2F3F5]"
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

      {/* Spaces MVP: in-list search removed (low space count); restore when space list grows. */}
      {!spacesMode ? (
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
      ) : null}

      <ul ref={listScrollRef} className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {isLoading &&
        (spacesMode
          ? listRows.length === 0
          : viewTab === 'agent'
            ? agentRows.every((row) => !row.currentSession)
            : sessionRows.length <= 1) ? (
          Array.from({ length: 3 }).map((_, index) => (
            <li key={`skeleton-${index}`} className="rounded-lg px-3 py-2.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F3F5]" />
              <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[#F2F3F5]" />
            </li>
          ))
        ) : spacesMode ? (
          listRows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#86909C]">
              {t('noSearchResults')}
            </li>
          ) : (
            listRows.map((row) => {
              const isActive = row.id === activeId;
              const badge = rowBadgeText(row.badge, row.badgeDetail, t);
              const space = spaceLookup.get(row.id);
              const showMenu = space && !space.is_entry_point && !space.is_system && onSpaceAction;
              const isMenuOpen = contextMenuId === row.id;
              const rowPending = spaceActionPendingId === row.id;

              const lifecycleActions: { action: SpaceLifecycleAction; labelKey: string; icon: typeof Archive; destructive?: boolean }[] = [
                { action: 'complete', labelKey: 'lifecycleComplete', icon: CheckCircle2 },
                { action: 'archive', labelKey: 'lifecycleArchive', icon: Archive },
                { action: 'restore', labelKey: 'lifecycleRestore', icon: RotateCcw },
                { action: 'delete', labelKey: 'lifecycleDelete', icon: Trash2, destructive: true },
              ];

              return (
                <li key={row.id} className="relative">
                  <div
                    className={cn(
                      'group flex items-center rounded-lg transition-colors',
                      isActive && 'bg-workspace-active',
                      !isActive && !row.disabled && 'hover:bg-[#F2F3F5]'
                    )}
                  >
                    <button
                      type="button"
                      disabled={row.disabled}
                      onMouseEnter={() => prefetchNavRow(row)}
                      onFocus={() => prefetchNavRow(row)}
                      onPointerDown={() => prefetchNavRow(row)}
                      onClick={() => goToNavRow(row)}
                      onContextMenu={(e) => {
                        if (!showMenu) return;
                        e.preventDefault();
                        setContextMenuId(isMenuOpen ? null : row.id);
                      }}
                      className={cn(
                        'min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left min-h-11 md:min-h-0 md:px-2.5 md:py-2',
                        row.disabled && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {rowLeadingIcon(row, space)}
                        <span className="flex-1 truncate text-sm font-medium text-[#1D2129]">
                          {row.displayName}
                        </span>
                      </div>
                      {badge ? (
                        <p className="mt-0.5 pl-6 text-[11px] leading-tight text-[#86909C]">{badge}</p>
                      ) : null}
                    </button>
                    {showMenu ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuId(isMenuOpen ? null : row.id);
                        }}
                        className={cn(
                          'mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#86909C] transition-opacity',
                          'hover:bg-[#E5E6EB] hover:text-[#1D2129]',
                          isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                        aria-label={tSpaces('spaceActions')}
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {isMenuOpen && space ? (
                    <div
                      ref={contextMenuRef}
                      role="menu"
                      className="absolute right-2 top-full z-30 mt-1 w-44 rounded-lg border border-[#E5E6EB] bg-white py-1 shadow-lg"
                    >
                      {lifecycleActions
                        .filter(({ action }) => canRunSpaceLifecycle(space, action))
                        .map(({ action, labelKey, icon: Icon, destructive }) => (
                          <button
                            key={action}
                            type="button"
                            role="menuitem"
                            disabled={rowPending}
                            onClick={() => handleSpaceAction(space.id, action)}
                            className={cn(
                              'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[#F2F3F5] disabled:opacity-50',
                              destructive ? 'text-red-600' : 'text-[#1D2129]'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {tSpaces(labelKey)}
                          </button>
                        ))}
                    </div>
                  ) : null}
                </li>
              );
            })
          )
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

      <ConfirmDialog
        open={deleteConfirmId != null}
        title={tSpaces('lifecycleDeleteTitle')}
        description={tSpaces('lifecycleDeleteConfirm')}
        confirmLabel={tSpaces('lifecycleDeleteAction')}
        cancelLabel={tSpaces('lifecycleDeleteCancel')}
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />
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
