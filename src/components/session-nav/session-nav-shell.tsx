'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { SpaceTemplatePicker } from '@/components/spaces/space-template-picker';

import { ConfirmAbandonSessionDialog } from '@/components/session-nav/confirm-abandon-session-dialog';
import {
  SessionNavControllerProvider,
  type SessionNavOpenOptions,
} from '@/components/session-nav/session-nav-controller';
import { SessionContextHeader } from '@/components/session-nav/session-context-header';
import { SessionFileLibraryPanel } from '@/components/session-nav/session-file-library-panel';
import { SessionGlobalSearchPanel } from '@/components/session-nav/session-global-search-panel';
import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import { SessionNavPanel } from '@/components/session-nav/session-nav-panel';
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
import { useUIStore } from '@/lib/store';

interface SessionNavShellProps {
  locale: string;
  children: React.ReactNode;
}

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
  const { run: runSidebarLifecycle, pendingAction: sidebarPendingAction } = useSpaceLifecycle(locale);

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
  } = navState;

  const pinNavPanel = isDesktop && shouldPinWorkspaceNavPanel(pathname);
  const panelVisible = panelOpen || mobileDrawerOpen;
  const contextHeaderSpaceId =
    spaceRouteId ?? (isClinic && spacesEnabled ? CLINIC_SPACE_ID : null);
  const showContextHeader = isClinic || Boolean(contextHeaderSpaceId) || Boolean(activeHubAgentId);

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
  } = useSpaces({ panelOpen: panelVisible });

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

  const showAgentsPanel = panelMode === 'agents';
  const showFilesPanel = panelMode === 'files';
  const showSearchPanel = panelMode === 'search';

  return (
    <SessionNavControllerProvider value={controllerValue}>
      {/* Provider wraps floating sheets too — Clinic/Space shells must see embedded=true. */}
      <WorkspaceShellProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F4F5F7]">
        <SessionIconRail
          locale={locale}
          panelOpen={panelVisible}
          panelMode={panelMode}
          onToggleAgentsPanel={handleToggleAgentsPanel}
          onOpenFilesPanel={() => openPanelMode('files')}
          onOpenSearchPanel={() => openPanelMode('search')}
          onOpenMobileDrawer={() => openPanelMode('agents')}
        />

        {showAgentsPanel ? (
          <SessionNavPanel
            locale={locale}
            open={panelOpen}
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
            spaceActionPending={sidebarPendingAction}
            spaceFilter={spaceFilter}
            onSpaceFilterChange={setSpaceFilter}
          />
        ) : null}

        {showFilesPanel ? (
          <SessionFileLibraryPanel
            locale={locale}
            open={panelOpen}
            mobileDrawer={mobileDrawerOpen}
            onClose={closePanel}
          />
        ) : null}

        {showSearchPanel ? (
          <SessionGlobalSearchPanel
            locale={locale}
            open={panelOpen}
            mobileDrawer={mobileDrawerOpen}
            onClose={closePanel}
          />
        ) : null}

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-[#E5E6EB] bg-white md:hidden">
            <button
              type="button"
              onClick={() => openPanelMode('agents')}
              className="m-2 rounded-lg p-2 text-[#1D2129] hover:bg-[#F2F3F5]"
              aria-label={t('openPanel')}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          {showContextHeader && (
            <SessionContextHeader
              locale={locale}
              sessionsByAgent={sessionsByAgent}
              spaceId={contextHeaderSpaceId}
            />
          )}
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      <SpaceTemplatePicker
        open={templatePickerOpen}
        isCreating={isCreatingSpace}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(templateId) => void handleCreateSpace(templateId)}
      />

      <ConfirmAbandonSessionDialog
        open={Boolean(confirmAgentId)}
        agentId={confirmAgentId}
        locale={locale}
        onConfirm={() => void handleConfirmAbandon()}
        onCancel={cancelConfirmAbandon}
      />
      </WorkspaceShellProvider>
    </SessionNavControllerProvider>
  );
}
