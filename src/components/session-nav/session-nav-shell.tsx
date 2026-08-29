'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ConfirmAbandonSessionDialog } from '@/components/session-nav/confirm-abandon-session-dialog';
import {
  SessionNavControllerProvider,
  type SessionNavOpenOptions,
} from '@/components/session-nav/session-nav-controller';
import { SessionContextHeader } from '@/components/session-nav/session-context-header';
import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import {
  loadSessionFileLibraryPanel,
  loadSessionGlobalSearchPanel,
  loadSessionNavPanel,
  loadSpaceTemplatePicker,
} from '@/lib/session-nav/load-session-nav-panels';
import { useActiveAgentSessions, ActiveAgentSessionsProvider } from '@/hooks/use-active-agent-sessions';
import { useAgentSessionActions } from '@/hooks/use-agent-session-actions';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useSpaces } from '@/hooks/use-spaces';
import { useSessionNavState } from '@/hooks/use-session-nav-state';
import {
  resolveSurfaceFromPathname,
  getDedicatedHubAgentFromPathname,
} from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import type { SessionNavPanelMode } from '@/lib/session-nav';
import {
  buildSpaceNavRowsFiltered,
  resolveSpaceIdFromPathname,
  shouldPinWorkspaceNavPanel,
  type SpaceNavFilter,
} from '@/lib/space-nav';
import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';
import { createSpace } from '@/lib/spaces-api';
import { useSpaceLifecycle } from '@/hooks/use-space-lifecycle';
import { publishSessionNavSessionExited } from '@/lib/session-nav-events';
import { isTelegramWebApp } from '@/lib/telegram';
import { WorkspaceShellProvider } from '@/lib/workspace-shell-context';
import {
  WorkspaceRailPortalProvider,
  useWorkspaceRailPortal,
} from '@/lib/workspace-rail-portal';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SessionNavShellProps {
  locale: string;
  children: React.ReactNode;
}

/** Same 260px column as SessionNavPanel — no opacity hide (KAZI-578). */
function SessionNavPanelSlot() {
  return (
    <aside
      aria-hidden
      data-testid="session-nav-panel-slot"
      className="hidden w-[260px] shrink-0 overflow-hidden border-r border-workspace-border md:block"
    />
  );
}

const SessionNavPanel = dynamic(
  () => loadSessionNavPanel().then((m) => m.SessionNavPanel),
  { loading: () => <SessionNavPanelSlot /> }
);

const SessionFileLibraryPanel = dynamic(
  () => loadSessionFileLibraryPanel().then((m) => m.SessionFileLibraryPanel),
  { loading: () => <SessionNavPanelSlot /> }
);

const SessionGlobalSearchPanel = dynamic(
  () => loadSessionGlobalSearchPanel().then((m) => m.SessionGlobalSearchPanel),
  { loading: () => <SessionNavPanelSlot /> }
);

const SpaceTemplatePicker = dynamic(() =>
  loadSpaceTemplatePicker().then((m) => m.SpaceTemplatePicker)
);

export function SessionNavShell({ locale, children }: SessionNavShellProps) {
  return (
    <SessionNavShellFrame locale={locale}>{children}</SessionNavShellFrame>
  );
}

function SessionNavShellFrame({ locale, children }: SessionNavShellProps) {
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const navState = useSessionNavState();
  const panelVisible = navState.panelOpen || navState.mobileDrawerOpen;

  // Store flag alone is insufficient: a false-positive TMA init used to hide nav
  // for every desktop visitor after telegram-web-app.js loaded. Require real initData.
  if (isTelegramMiniApp && isTelegramWebApp()) {
    return (
      <ActiveAgentSessionsProvider>
        {children}
      </ActiveAgentSessionsProvider>
    );
  }

  return (
    <ActiveAgentSessionsProvider panelOpen={panelVisible}>
      <SessionNavShellLayout locale={locale} navState={navState}>
        {children}
      </SessionNavShellLayout>
    </ActiveAgentSessionsProvider>
  );
}

function SessionNavShellLayout({
  locale,
  children,
  navState,
}: SessionNavShellProps & {
  navState: ReturnType<typeof useSessionNavState>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const t = useTranslations('sessionNav');
  const tSpaces = useTranslations('spaces');
  const spacesEnabled = isSpacesEnabled();
  const isDesktop = useIsDesktop();
  const spaceRouteId = resolveSpaceIdFromPathname(pathname);
  const isClinic =
    resolveSurfaceFromPathname(pathname) === 'clinic' && !spaceRouteId;
  const activeHubAgentId = getDedicatedHubAgentFromPathname(pathname);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [spaceFilter, setSpaceFilter] = useState<SpaceNavFilter>('active');
  const {
    run: runSidebarLifecycle,
    pendingSpaceId: sidebarPendingSpaceId,
  } = useSpaceLifecycle(locale);

  const {
    panelOpen,
    setPanelOpen,
    togglePanel,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    viewTab,
    setViewTab,
    expandedAgentId,
    setExpandedAgentId,
    panelMode,
    setPanelMode,
    hydrated,
  } = navState;

  const pinNavPanel = isDesktop && shouldPinWorkspaceNavPanel(pathname);
  const panelVisible = panelOpen || mobileDrawerOpen;
  // First paint: icon rail + center only. Mount the heavy list after
  // hydration, and only when desktop open/pinned or the mobile drawer is open.
  const mountDesktopPanel =
    hydrated && isDesktop && (panelOpen || pinNavPanel);
  const mountMobilePanel = hydrated && mobileDrawerOpen;
  const mountSideSurface = mountDesktopPanel || mountMobilePanel;
  const desktopPanelOpen = mountDesktopPanel;
  const contextHeaderSpaceId =
    spaceRouteId ?? (isClinic && spacesEnabled ? CLINIC_SPACE_ID : null);
  const showContextHeader =
    isClinic || Boolean(contextHeaderSpaceId) || Boolean(activeHubAgentId);

  useEffect(() => {
    if (!pinNavPanel) return;
    setPanelMode('agents');
    setPanelOpen(true);
  }, [pinNavPanel, setPanelMode, setPanelOpen]);
  // Spaces on still needs agent sessions: Hub routes + Session Nav agent tab.
  // Space Context Header no longer consumes them (KAZI-195); do not gate with
  // `enabled: !spacesEnabled` — that would break /cv|/interview|/english history.
  const { sessionsByAgent, isLoading, error, refresh } = useActiveAgentSessions({
    panelOpen: panelVisible,
  });
  const {
    spaces,
    isLoading: spacesLoading,
    error: spacesError,
    refresh: refreshSpaces,
  } = useSpaces({ panelOpen: panelVisible, locale });

  const {
    requestNewSession,
    confirmAbandonAndNew,
    cancelConfirmAbandon,
    exitSession,
    confirmAgentId,
    isBusy,
  } = useAgentSessionActions(locale);

  const closePanel = useCallback(() => {
    if (mobileDrawerOpen) closeMobileDrawer();
    else setPanelOpen(false);
  }, [closeMobileDrawer, mobileDrawerOpen, setPanelOpen]);

  const openPanelMode = useCallback(
    (mode: SessionNavPanelMode) => {
      const isSameMode = panelMode === mode;
      if (isSameMode && panelVisible) {
        closePanel();
        return;
      }
      setPanelMode(mode);
      if (!isDesktop) {
        openMobileDrawer();
      } else {
        setPanelOpen(true);
      }
    },
    [closePanel, isDesktop, openMobileDrawer, panelMode, panelVisible, setPanelMode, setPanelOpen]
  );

  const openPanel = useCallback(
    (options?: SessionNavOpenOptions) => {
      setPanelMode('agents');
      if (!isDesktop) {
        openMobileDrawer();
      } else {
        setPanelOpen(true);
      }
      if (options?.viewTab) setViewTab(options.viewTab);
      if (options?.expandAgentId !== undefined) {
        setExpandedAgentId(options.expandAgentId);
      }
    },
    [isDesktop, openMobileDrawer, setExpandedAgentId, setPanelMode, setPanelOpen, setViewTab]
  );

  const handleToggleAgentsPanel = useCallback(() => {
    if (panelMode !== 'agents') {
      openPanelMode('agents');
      return;
    }
    if (!isDesktop) {
      if (mobileDrawerOpen) closeMobileDrawer();
      else openMobileDrawer();
      return;
    }
    togglePanel();
  }, [
    closeMobileDrawer,
    isDesktop,
    mobileDrawerOpen,
    openMobileDrawer,
    openPanelMode,
    panelMode,
    togglePanel,
  ]);

  const handleRequestNewSession = useCallback(
    async (agentId: string, options?: { jobId?: string }) => {
      const result = await requestNewSession(agentId, options);
      if (result.ok) {
        const agent = AGENT_REGISTRY.find((entry) => entry.agentId === agentId);
        const agentName = agent ? getAgentLabel(agent, locale, 'name') : agentId;
        showToast(t('newSessionStarted', { agent: agentName }), 'info');
        void refresh(true);
        return;
      }
      if ('needsConfirm' in result && result.needsConfirm) return;
      showToast('error' in result && result.error ? result.error : t('newSessionFailed'), 'error');
    },
    [locale, refresh, requestNewSession, showToast, t]
  );

  const handleConfirmAbandon = useCallback(async () => {
    const result = await confirmAbandonAndNew();
    if (result.ok) {
      const agent = confirmAgentId
        ? AGENT_REGISTRY.find((entry) => entry.agentId === confirmAgentId)
        : undefined;
      const agentName = agent
        ? getAgentLabel(agent, locale, 'name')
        : confirmAgentId ?? '';
      showToast(t('newSessionStarted', { agent: agentName }), 'info');
      void refresh(true);
      return;
    }
    showToast('error' in result && result.error ? result.error : t('newSessionFailed'), 'error');
  }, [confirmAbandonAndNew, confirmAgentId, locale, refresh, showToast, t]);

  const handleExitSession = useCallback(
    async (agentId: string) => {
      const res = await exitSession(agentId);
      if (res.success) {
        publishSessionNavSessionExited(agentId);
        showToast(t('exitSessionDone'), 'info');
        void refresh(true);
        return;
      }
      showToast(res.error ?? t('exitSessionFailed'), 'error');
    },
    [exitSession, refresh, showToast, t]
  );

  const spaceNavRows = useMemo(
    () => (spacesEnabled ? buildSpaceNavRowsFiltered(spaces, locale, t('clinic'), spaceFilter) : []),
    [locale, spaceFilter, spaces, spacesEnabled, t]
  );

  // P2-3: if Archived tab is empty after restore/delete, fall back to Current.
  useEffect(() => {
    if (spaceFilter !== 'archived') return;
    const hasArchived = spaces.some(
      (s) => !s.is_entry_point && (s.status === 'archived' || s.status === 'deleted')
    );
    if (!hasArchived) setSpaceFilter('active');
  }, [spaceFilter, spaces]);

  const handleSidebarSpaceAction = useCallback(
    async (spaceId: string, action: Parameters<typeof runSidebarLifecycle>[1]) => {
      const result = await runSidebarLifecycle(spaceId, action);
      if (result.ok) {
        void refreshSpaces(true);
      }
    },
    [refreshSpaces, runSidebarLifecycle]
  );

  const handleCreateSpace = useCallback(
    async (templateId: string) => {
      setIsCreatingSpace(true);
      const res = await createSpace({ template_id: templateId });
      setIsCreatingSpace(false);
      if (!res.success || !res.data) {
        showToast(res.error ?? tSpaces('createFailed'), 'error');
        return;
      }
      setTemplatePickerOpen(false);
      void refreshSpaces(true);
      router.push(`/${locale}/spaces/${encodeURIComponent(res.data.id)}`);
    },
    [locale, refreshSpaces, router, showToast, tSpaces]
  );

  const controllerValue = useMemo(
    () => ({
      openPanel,
      requestNewSession: (agentId: string, options?: { jobId?: string }) => {
        void handleRequestNewSession(agentId, options);
      },
    }),
    [handleRequestNewSession, openPanel]
  );

  const showAgentsPanel = mountSideSurface && panelMode === 'agents';
  const showFilesPanel = mountSideSurface && panelMode === 'files';
  const showSearchPanel = mountSideSurface && panelMode === 'search';

  return (
    <SessionNavControllerProvider value={controllerValue}>
      {/* Provider wraps floating sheets too — Clinic/Space shells must see embedded=true. */}
      <WorkspaceShellProvider>
      <WorkspaceRailPortalProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-workspace-bg">
        <SessionIconRail
          locale={locale}
          panelOpen={panelVisible}
          panelMode={panelMode}
          spacesMode={spacesEnabled}
          onToggleAgentsPanel={handleToggleAgentsPanel}
          onOpenFilesPanel={() => openPanelMode('files')}
          onOpenSearchPanel={() => openPanelMode('search')}
          onOpenMobileDrawer={() => openPanelMode('agents')}
        />

        {showAgentsPanel ? (
          <SessionNavPanel
            locale={locale}
            open={desktopPanelOpen}
            mobileDrawer={mobileDrawerOpen}
            viewTab={viewTab}
            onViewTabChange={setViewTab}
            expandedAgentId={expandedAgentId}
            onExpandedAgentIdChange={setExpandedAgentId}
            activeHubAgentId={activeHubAgentId}
            sessionsByAgent={sessionsByAgent}
            isLoading={spacesEnabled ? spacesLoading : isLoading}
            fetchError={spacesEnabled ? spacesError : error}
            actionsDisabled={isBusy || isCreatingSpace}
            onClose={closePanel}
            onNewSession={(agentId) => void handleRequestNewSession(agentId)}
            onExitSession={(agentId) => void handleExitSession(agentId)}
            spacesMode={spacesEnabled}
            spaceRows={spaceNavRows}
            spaces={spaces}
            onNewSpace={() => setTemplatePickerOpen(true)}
            onSpaceAction={handleSidebarSpaceAction}
            spaceActionPendingId={sidebarPendingSpaceId}
            spaceFilter={spaceFilter}
            onSpaceFilterChange={setSpaceFilter}
          />
        ) : null}

        {showFilesPanel ? (
          <SessionFileLibraryPanel
            locale={locale}
            open={desktopPanelOpen}
            mobileDrawer={mobileDrawerOpen}
            onClose={closePanel}
          />
        ) : null}

        {showSearchPanel ? (
          <SessionGlobalSearchPanel
            locale={locale}
            open={desktopPanelOpen}
            mobileDrawer={mobileDrawerOpen}
            onClose={closePanel}
          />
        ) : null}

        <WorkspaceCenterColumn
          locale={locale}
          showContextHeader={showContextHeader}
          sessionsByAgent={sessionsByAgent}
          contextHeaderSpaceId={contextHeaderSpaceId}
          onOpenMobilePanel={() => openPanelMode('agents')}
          mobilePanelLabel={t('openPanel')}
        >
          {children}
        </WorkspaceCenterColumn>
      </div>

      {templatePickerOpen ? (
        <SpaceTemplatePicker
          open={templatePickerOpen}
          isCreating={isCreatingSpace}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(templateId) => void handleCreateSpace(templateId)}
        />
      ) : null}

      <ConfirmAbandonSessionDialog
        open={Boolean(confirmAgentId)}
        agentId={confirmAgentId}
        locale={locale}
        onConfirm={() => void handleConfirmAbandon()}
        onCancel={cancelConfirmAbandon}
      />
      </WorkspaceRailPortalProvider>
      </WorkspaceShellProvider>
    </SessionNavControllerProvider>
  );
}

function WorkspaceCenterColumn({
  locale,
  showContextHeader,
  sessionsByAgent,
  contextHeaderSpaceId,
  onOpenMobilePanel,
  mobilePanelLabel,
  children,
}: {
  locale: string;
  showContextHeader: boolean;
  sessionsByAgent: ReturnType<typeof useActiveAgentSessions>['sessionsByAgent'];
  contextHeaderSpaceId: string | null;
  onOpenMobilePanel: () => void;
  mobilePanelLabel: string;
  children: React.ReactNode;
}) {
  const portal = useWorkspaceRailPortal();
  const chatSideRailOpen = portal?.chatSideRailOpen ?? false;
  const [portalHasChild, setPortalHasChild] = useState(false);

  useEffect(() => {
    const host = portal?.portalHost;
    if (!host) {
      setPortalHasChild(false);
      return;
    }
    const sync = () => setPortalHasChild(host.childElementCount > 0);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(host, { childList: true });
    return () => observer.disconnect();
  }, [portal?.portalHost]);

  const showPortalColumn = chatSideRailOpen && portalHasChild;

  return (
    <div className="relative flex min-w-0 flex-1 min-h-0 flex-col">
      <div className="flex items-center border-b border-workspace-border bg-white md:hidden">
        <button
          type="button"
          onClick={onOpenMobilePanel}
          className="m-2 rounded-lg p-2 text-workspace-text hover:bg-workspace-hover"
          aria-label={mobilePanelLabel}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showContextHeader ? (
            <SessionContextHeader
              locale={locale}
              sessionsByAgent={sessionsByAgent}
              spaceId={contextHeaderSpaceId}
              workspaceRailOpen={chatSideRailOpen}
            />
          ) : null}
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
        <div
          ref={(el) => portal?.setPortalHost(el)}
          className={cn(
            'hidden min-h-0 min-w-0 shrink-0 self-stretch overflow-hidden md:flex md:flex-col',
            'transition-[width,min-width] duration-200 ease-out',
            showPortalColumn
              ? 'min-w-[320px] border-l border-workspace-border bg-white'
              : 'pointer-events-none w-0 max-w-0 border-l-0'
          )}
          aria-hidden={!showPortalColumn}
        />
      </div>
    </div>
  );
}
