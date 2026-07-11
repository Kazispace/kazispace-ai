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
import { getActiveAgent } from '@/lib/agent-api';
import { planNavigation, type AgentSurfaceId } from '@/lib/agent-transition';
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
  returnToClinic: () => Promise<{ ok: boolean }>;
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
    exitToClinic,
  } = useAgentSwitch(locale, switchContext);

  const layerAgentId = activeAgentId ?? hubAgentId;

  const returnToClinic = useCallback(async () => {
    const result = await exitToClinic({ agentId: hubAgentId });
    if (!result?.ok) {
      const activeRes = await getActiveAgent();
      const serverAgent = activeRes.data?.active_agent ?? null;
      if (serverAgent && serverAgent !== hubAgentId) {
        showToast(tClinic('deactivateFailed'), 'error');
        return { ok: false as const };
      }
    }
    const plan = planNavigation(locale, fromSurface, null);
    if (plan.shouldNavigate && plan.href) {
      router.replace(plan.href);
    }
    return { ok: true as const };
  }, [exitToClinic, fromSurface, hubAgentId, locale, router, showToast, tClinic]);

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
