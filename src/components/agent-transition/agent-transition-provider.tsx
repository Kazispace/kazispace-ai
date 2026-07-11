'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { AgentSwitcher } from '@/components/clinic/agent-switcher';
import { AgentSwitchDialog } from '@/components/clinic/agent-switch-dialog';
import { SwitchingOverlay } from '@/components/clinic/switching-overlay';
import { useAgentSwitch } from '@/hooks/use-agent-switch';
import { planNavigation, type AgentSurfaceId } from '@/lib/agent-transition';
import { leaveDedicatedHubForClinic } from '@/lib/leave-dedicated-hub';
import { useAgentStore, useUIStore } from '@/lib/store';

type AgentTransitionContextValue = {
  /** Server/store active agent — null when no session. */
  activeAgentId: string | null;
  /** Layer breadcrumb agent — falls back to hub surface agent. */
  layerAgentId: string;
  isSwitching: boolean;
  statusBadge: string | null | undefined;
  openSwitcher: () => void;
  requestAgentSwitch: ReturnType<typeof useAgentSwitch>['requestAgentSwitch'];
  activateAgentWithoutPrecheck: ReturnType<
    typeof useAgentSwitch
  >['activateAgentWithoutPrecheck'];
  /** Hub → Clinic: navigates immediately; always `{ ok: true }` (deactivate is background). */
  returnToClinic: () => Promise<{ ok: true }>;
};

const AgentTransitionContext = createContext<AgentTransitionContextValue | null>(
  null
);

export function useAgentTransition(): AgentTransitionContextValue {
  const ctx = useContext(AgentTransitionContext);
  if (!ctx) {
    throw new Error(
      'useAgentTransition must be used within AgentTransitionProvider'
    );
  }
  return ctx;
}

interface AgentTransitionProviderProps {
  locale: string;
  fromSurface: AgentSurfaceId;
  hubAgentId: string;
  isLoggedIn: boolean;
  children: ReactNode;
}

export function AgentTransitionProvider({
  locale,
  fromSurface,
  hubAgentId,
  isLoggedIn,
  children,
}: AgentTransitionProviderProps) {
  const router = useRouter();
  const tClinic = useTranslations('clinic');
  const showToast = useUIStore((s) => s.showToast);
  const switcherOpen = useAgentStore((s) => s.switcherOpen);
  const setSwitcherOpen = useAgentStore((s) => s.setSwitcherOpen);
  const [switchConfirming, setSwitchConfirming] = useState(false);

  const switchContext = useMemo(
    () => ({
      fromSurface,
      navigate: (href: string) => router.replace(href),
    }),
    [fromSurface, router]
  );

  const {
    activeAgentId,
    isSwitching,
    pendingAgentSwitch,
    statusBadge,
    requestAgentSwitch,
    confirmPendingAgentSwitch,
    cancelPendingAgentSwitch,
    activateAgentWithoutPrecheck,
  } = useAgentSwitch(locale, switchContext);

  const layerAgentId = activeAgentId ?? hubAgentId;

  const returnToClinic = useCallback(async () => {
    const clinicHref =
      planNavigation(locale, fromSurface, null).href ?? `/${locale}/chat`;
    leaveDedicatedHubForClinic(locale, hubAgentId);
    router.replace(clinicHref);
    return { ok: true as const };
  }, [fromSurface, hubAgentId, locale, router]);

  const handleAgentSelect = useCallback(
    async (agentId: string) => {
      if (!isLoggedIn) {
        showToast(tClinic('loginToContinue'), 'info');
        router.push(`/${locale}/login`);
        return;
      }
      const result = await requestAgentSwitch(agentId);
      if (result && !result.ok && result.needsConfirm) return;
      if (result && !result.ok) {
        showToast(result.error ?? tClinic('activateFailed'), 'error');
      }
    },
    [isLoggedIn, locale, requestAgentSwitch, router, showToast, tClinic]
  );

  const value = useMemo(
    (): AgentTransitionContextValue => ({
      activeAgentId,
      layerAgentId,
      isSwitching,
      statusBadge,
      openSwitcher: () => setSwitcherOpen(true),
      requestAgentSwitch,
      activateAgentWithoutPrecheck,
      returnToClinic,
    }),
    [
      activateAgentWithoutPrecheck,
      activeAgentId,
      layerAgentId,
      isSwitching,
      requestAgentSwitch,
      returnToClinic,
      setSwitcherOpen,
      statusBadge,
    ]
  );

  return (
    <AgentTransitionContext.Provider value={value}>
      {children}
      {isSwitching ? (
        <div className="fixed inset-0 z-[100]">
          <SwitchingOverlay />
        </div>
      ) : null}
      <AgentSwitcher
        locale={locale}
        isLoggedIn={isLoggedIn}
        open={switcherOpen}
        activeAgentId={activeAgentId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={(agentId) => void handleAgentSelect(agentId)}
      />
      {pendingAgentSwitch ? (
        <AgentSwitchDialog
          locale={locale}
          fromAgentId={pendingAgentSwitch.fromAgentId}
          toAgentId={pendingAgentSwitch.toAgentId}
          isConfirming={switchConfirming}
          onCancel={cancelPendingAgentSwitch}
          onConfirm={() => {
            setSwitchConfirming(true);
            void confirmPendingAgentSwitch()
              .then((result) => {
                if (result && !result.ok) {
                  showToast(result.error ?? tClinic('activateFailed'), 'error');
                }
              })
              .finally(() => setSwitchConfirming(false));
          }}
        />
      ) : null}
    </AgentTransitionContext.Provider>
  );
}
