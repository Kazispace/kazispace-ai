'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ConfirmAbandonSessionDialog } from '@/components/session-nav/confirm-abandon-session-dialog';
import { SessionNavControllerProvider } from '@/components/session-nav/session-nav-controller';
import { SessionContextHeader } from '@/components/session-nav/session-context-header';
import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import { BottomTabBar } from '@/components/navigation/bottom-tab-bar';
import { isTopLevelScreen, resolveTopLevelDestination } from '@/lib/top-level-nav';
import {
  loadSessionFileLibraryPanel,
  loadSessionGlobalSearchPanel,
} from '@/lib/session-nav/load-session-nav-panels';
import { useActiveAgentSessions, ActiveAgentSessionsProvider } from '@/hooks/use-active-agent-sessions';
import { useAgentSessionActions } from '@/hooks/use-agent-session-actions';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useSessionNavState } from '@/hooks/use-session-nav-state';
import {
  resolveSurfaceFromPathname,
  getDedicatedHubAgentFromPathname,
} from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import type { SessionNavPanelMode } from '@/lib/session-nav';
import { resolveSpaceIdFromPathname } from '@/lib/space-nav';
import { CLINIC_SPACE_ID, isSpacesEnabled } from '@/lib/spaces/constants';
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

/** The 260px side column of the files and search panels — no opacity hide (KAZI-578). */
function SessionNavPanelSlot() {
  return (
    <aside
      aria-hidden
      data-testid="session-nav-panel-slot"
      className="hidden w-[260px] shrink-0 overflow-hidden border-r border-workspace-border md:block"
    />
  );
}

const SessionFileLibraryPanel = dynamic(
  () => loadSessionFileLibraryPanel().then((m) => m.SessionFileLibraryPanel),
  { loading: () => <SessionNavPanelSlot /> }
);

const SessionGlobalSearchPanel = dynamic(
  () => loadSessionGlobalSearchPanel().then((m) => m.SessionGlobalSearchPanel),
  { loading: () => <SessionNavPanelSlot /> }
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
  const showToast = useUIStore((s) => s.showToast);
  const t = useTranslations('sessionNav');
  const spacesEnabled = isSpacesEnabled();
  const isDesktop = useIsDesktop();
  const spaceRouteId = resolveSpaceIdFromPathname(pathname);
  const isClinic =
    resolveSurfaceFromPathname(pathname) === 'clinic' && !spaceRouteId;
  const activeHubAgentId = getDedicatedHubAgentFromPathname(pathname);

  const {
    panelOpen,
    setPanelOpen,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    panelMode,
    setPanelMode,
    hydrated,
  } = navState;

  // KAZI-1485 (kazispace-ui D36, Navigation 3.0): there is no conversation list, so the
  // spaces / specialists panel ('agents') is gone, and nothing pins a panel open any more.
  // A panel mode saved before this change ('agents') opens nothing.
  // ❌ Former: the list pinned open on desktop in chats and spaces, and a menu button for it.
  const listPanelMode = panelMode === 'agents';
  const panelVisible = (panelOpen || mobileDrawerOpen) && !listPanelMode;
  // First paint: icon rail + center only. Mount a panel after hydration, and only when
  // it is open on desktop or the mobile drawer is open.
  const mountDesktopPanel = hydrated && isDesktop && panelOpen && !listPanelMode;
  const mountMobilePanel = hydrated && mobileDrawerOpen && !listPanelMode;
  const mountSideSurface = mountDesktopPanel || mountMobilePanel;
  const desktopPanelOpen = mountDesktopPanel;
  const contextHeaderSpaceId =
    spaceRouteId ?? (isClinic && spacesEnabled ? CLINIC_SPACE_ID : null);
  // The conversation header belongs to Chat only; Assets and Me have their own page
  // headers (unknown paths such as /mine otherwise resolve to the clinic surface).
  // Chat's top-level screens own the conversation list and its header; Assets, Me
  // and sub-screens (credits, jobs, …) do not (kazispace-ui navigation pattern).
  const onChatTopLevel =
    resolveTopLevelDestination(pathname, locale) === 'exam' && isTopLevelScreen(pathname, locale);
  const showContextHeader =
    onChatTopLevel &&
    (isClinic || Boolean(contextHeaderSpaceId) || Boolean(activeHubAgentId));

  // Hub routes and the context header still need agent sessions; do not gate with
  // `enabled: !spacesEnabled` — that would break /cv|/interview|/english history.
  const { sessionsByAgent, refresh } = useActiveAgentSessions({
    panelOpen: panelVisible,
  });

  const {
    requestNewSession,
    confirmAbandonAndNew,
    cancelConfirmAbandon,
    confirmAgentId,
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

  const controllerValue = useMemo(
    () => ({
      requestNewSession: (agentId: string, options?: { jobId?: string }) => {
        void handleRequestNewSession(agentId, options);
      },
    }),
    [handleRequestNewSession]
  );

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
          onOpenFilesPanel={() => openPanelMode('files')}
          onOpenSearchPanel={() => openPanelMode('search')}
        />

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
        >
          {children}
        </WorkspaceCenterColumn>
      </div>

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
  children,
}: {
  locale: string;
  showContextHeader: boolean;
  sessionsByAgent: ReturnType<typeof useActiveAgentSessions>['sessionsByAgent'];
  contextHeaderSpaceId: string | null;
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
      <BottomTabBar locale={locale} />
    </div>
  );
}
