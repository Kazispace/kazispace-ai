'use client';

import { useCallback, useMemo } from 'react';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
import { useActiveAgentSessions } from '@/hooks/use-active-agent-sessions';
import { useAgentSessionActions } from '@/hooks/use-agent-session-actions';
import { useSessionNavState } from '@/hooks/use-session-nav-state';
import {
  resolveSurfaceFromPathname,
  getDedicatedHubAgentFromPathname,
} from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import type { SessionNavPanelMode } from '@/lib/session-nav';
import { publishSessionNavSessionExited } from '@/lib/session-nav-events';
import { useUIStore } from '@/lib/store';

interface SessionNavShellProps {
  locale: string;
  children: React.ReactNode;
}

export function SessionNavShell({ locale, children }: SessionNavShellProps) {
  const pathname = usePathname();
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const showToast = useUIStore((s) => s.showToast);
  const t = useTranslations('sessionNav');
  const isClinic = resolveSurfaceFromPathname(pathname) === 'clinic';
  const activeHubAgentId = getDedicatedHubAgentFromPathname(pathname);

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
  } = useSessionNavState();

  const panelVisible = panelOpen || mobileDrawerOpen;
  const { sessionsByAgent, isLoading, error, refresh } = useActiveAgentSessions({
    panelOpen: panelVisible,
  });

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
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        openMobileDrawer();
      } else {
        setPanelOpen(true);
      }
    },
    [closePanel, openMobileDrawer, panelMode, panelVisible, setPanelMode, setPanelOpen]
  );

  const openPanel = useCallback(
    (options?: SessionNavOpenOptions) => {
      setPanelMode('agents');
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        openMobileDrawer();
      } else {
        setPanelOpen(true);
      }
      if (options?.viewTab) setViewTab(options.viewTab);
      if (options?.expandAgentId !== undefined) {
        setExpandedAgentId(options.expandAgentId);
      }
    },
    [openMobileDrawer, setExpandedAgentId, setPanelMode, setPanelOpen, setViewTab]
  );

  const handleToggleAgentsPanel = useCallback(() => {
    if (panelMode !== 'agents') {
      openPanelMode('agents');
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (mobileDrawerOpen) closeMobileDrawer();
      else openMobileDrawer();
      return;
    }
    togglePanel();
  }, [
    closeMobileDrawer,
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

  const controllerValue = useMemo(
    () => ({
      openPanel,
      requestNewSession: (agentId: string, options?: { jobId?: string }) => {
        void handleRequestNewSession(agentId, options);
      },
    }),
    [handleRequestNewSession, openPanel]
  );

  if (isTelegramMiniApp) {
    return <>{children}</>;
  }

  const showAgentsPanel = panelMode === 'agents';
  const showFilesPanel = panelMode === 'files';
  const showSearchPanel = panelMode === 'search';

  return (
    <SessionNavControllerProvider value={controllerValue}>
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
            isLoading={isLoading}
            fetchError={error}
            actionsDisabled={isBusy}
            onClose={closePanel}
            onNewSession={(agentId) => void handleRequestNewSession(agentId)}
            onExitSession={(agentId) => void handleExitSession(agentId)}
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
          {!isClinic && (
            <SessionContextHeader locale={locale} sessionsByAgent={sessionsByAgent} />
          )}
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      <ConfirmAbandonSessionDialog
        open={Boolean(confirmAgentId)}
        agentId={confirmAgentId}
        locale={locale}
        onConfirm={() => void handleConfirmAbandon()}
        onCancel={cancelConfirmAbandon}
      />
    </SessionNavControllerProvider>
  );
}
