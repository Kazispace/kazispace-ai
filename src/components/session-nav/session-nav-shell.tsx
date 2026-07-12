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
import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import { SessionNavPanel } from '@/components/session-nav/session-nav-panel';
import { useActiveAgentSessions } from '@/hooks/use-active-agent-sessions';
import { useAgentSessionActions } from '@/hooks/use-agent-session-actions';
import { useSessionNavState } from '@/hooks/use-session-nav-state';
import { resolveSurfaceFromPathname } from '@/lib/agent-transition/surfaces';
import { resolveActiveHubAgentId } from '@/lib/session-nav';
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
  const activeHubAgentId = resolveActiveHubAgentId(pathname);

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

  const openPanel = useCallback(
    (options?: SessionNavOpenOptions) => {
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
    [openMobileDrawer, setExpandedAgentId, setPanelOpen, setViewTab]
  );

  const handleRequestNewSession = useCallback(
    async (agentId: string, options?: { jobId?: string }) => {
      const result = await requestNewSession(agentId, options);
      if (result.ok) {
        showToast(t('newSessionStarted'), 'info');
        void refresh(true);
        return;
      }
      if ('needsConfirm' in result && result.needsConfirm) return;
      showToast('error' in result && result.error ? result.error : t('newSessionFailed'), 'error');
    },
    [refresh, requestNewSession, showToast, t]
  );

  const handleConfirmAbandon = useCallback(async () => {
    const result = await confirmAbandonAndNew();
    if (result.ok) {
      showToast(t('newSessionStarted'), 'info');
      void refresh(true);
      return;
    }
    showToast('error' in result && result.error ? result.error : t('newSessionFailed'), 'error');
  }, [confirmAbandonAndNew, refresh, showToast, t]);

  const handleExitSession = useCallback(
    async (agentId: string) => {
      const res = await exitSession(agentId);
      if (res.success) {
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

  return (
    <SessionNavControllerProvider value={controllerValue}>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F4F5F7]">
        <SessionIconRail
          locale={locale}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
          onOpenMobileDrawer={openMobileDrawer}
        />

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
          onClose={() => {
            if (mobileDrawerOpen) closeMobileDrawer();
            else setPanelOpen(false);
          }}
          onNewSession={(agentId) => void handleRequestNewSession(agentId)}
          onExitSession={(agentId) => void handleExitSession(agentId)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-[#E5E6EB] bg-white md:hidden">
            <button
              type="button"
              onClick={openMobileDrawer}
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
