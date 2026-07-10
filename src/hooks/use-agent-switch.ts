'use client';

import { useCallback } from 'react';
import {
  activateAgent,
  fetchAgentMessages,
  getActiveAgent,
} from '@/lib/agent-api';
import {
  activateDedicatedHubAgent,
  type HubRouteDeps,
} from '@/lib/agent-escalation';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';
import { isAgentSwitchRequiresClinic } from '@/lib/api-errors';
import {
  isHubAgentTarget,
  needsExplicitSwitchConfirm,
  resolveServerActiveAgentId,
} from '@/lib/agent-ui-switch';
import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { AGENT_REGISTRY, getAgentStatusBadge } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import { useAgentStore, useUIStore } from '@/lib/store';
import type { ChatMessage } from '@/types';

const FADE_OUT_MS = 300;
const FADE_IN_MS = 700;

export type AgentSwitchResult =
  | { ok: true; resumed?: boolean; hub?: boolean }
  | { ok: false; error?: string; needsConfirm?: boolean };

function mapHistoryToAgentMessages(
  agentId: string,
  sessionId: string,
  messages: { id?: string; role: string; content: string; timestamp?: string }[]
) {
  return messages.map((m, i) => ({
    id: m.id ?? `hist_${i}`,
    role: m.role as ChatMessage['role'],
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
    sessionId,
  }));
}

async function hydrateAgentMessagesFromSession(
  agentId: string,
  sessionId: string,
  setAgentMessages: (agentId: string, messages: ChatMessage[]) => void
): Promise<boolean> {
  const hist = await fetchAgentMessages(sessionId);
  if (!hist.success || !hist.data?.messages?.length) return false;
  setAgentMessages(
    agentId,
    mapHistoryToAgentMessages(agentId, sessionId, hist.data.messages)
  );
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pushAgentHistory(agentId: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('context_module', agentId);
  url.searchParams.delete('agent');
  window.history.pushState({ agentHub: true, agentId }, '', url.toString());
}

/** Remove agent deep-link params without adding a history entry */
export function stripAgentParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('context_module') && !url.searchParams.has('agent')) {
    return;
  }
  url.searchParams.delete('context_module');
  url.searchParams.delete('agent');
  window.history.replaceState(window.history.state, '', url.toString());
}

function clearAgentHistory() {
  stripAgentParamsFromUrl();
}

export function getDeepLinkAgentId(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get('context_module') ?? params.get('agent');
}

export function getDeepLinkReferralId(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get('referral');
}

export function clearReferralFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('referral');
  window.history.replaceState(window.history.state, '', url.toString());
}

export function useAgentSwitch(locale: string, hubRoutes?: HubRouteDeps) {
  const {
    activeAgentId,
    agentSessionId,
    isSwitching,
    pendingAgentSwitch,
    setSwitching,
    setActiveAgent,
    setAgentMessages,
    setSwitcherOpen,
    setPendingAgentSwitch,
  } = useAgentStore();
  const showToast = useUIStore((s) => s.showToast);

  const fetchActiveAgent = useCallback(async () => {
    const res = await getActiveAgent();
    if (!res.success || !res.data?.active_agent || !res.data.session_id) {
      return null;
    }
    return res.data;
  }, []);

  const queueSwitchConfirm = useCallback(
    (fromAgentId: string, toAgentId: string): AgentSwitchResult => {
      setPendingAgentSwitch({ fromAgentId, toAgentId });
      return { ok: false, needsConfirm: true };
    },
    [setPendingAgentSwitch]
  );

  /** Path B execute: deactivate current (if any) then activate target — no precheck. */
  const performAgentSwitch = useCallback(
    async (agentId: string, triggerMessage?: string): Promise<AgentSwitchResult> => {
      const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
      if (!entry || entry.status === 'coming_soon') {
        showToast('Coming soon', 'info');
        return { ok: false };
      }

      setSwitching(true);
      setSwitcherOpen(false);
      await sleep(FADE_OUT_MS);

      try {
        const currentActive = await resolveServerActiveAgentId();
        if (currentActive && currentActive !== agentId) {
          const deact = await deactivateToClinic(locale, {
            agentId: currentActive,
            skipBroadcast: true,
          });
          if (!deact.ok) {
            showToast(deact.error ?? 'Failed to return to clinic', 'error');
            return { ok: false, error: deact.error };
          }
        }

        if (currentActive === agentId) {
          const activeRes = await getActiveAgent();
          if (
            activeRes.success &&
            activeRes.data?.active_agent === agentId &&
            activeRes.data.session_id
          ) {
            const sid = activeRes.data.session_id;
            setActiveAgent(agentId, sid);
            const existing = useAgentStore.getState().getAgentMessages(agentId);
            if (existing.length === 0) {
              await hydrateAgentMessagesFromSession(agentId, sid, setAgentMessages);
            }
            pushAgentHistory(agentId);
            publishActiveAgentSync({
              type: 'activated',
              agentId,
              sessionId: sid,
            });
            await sleep(FADE_IN_MS);
            return { ok: true, resumed: true };
          }
        }

        if (isHubAgentTarget(agentId) && hubRoutes) {
          const hub = await activateDedicatedHubAgent(agentId, locale, hubRoutes);
          if (!hub.ok) {
            if (hub.errorCode && isAgentSwitchRequiresClinic(hub)) {
              const active = await resolveServerActiveAgentId();
              if (active && active !== agentId) {
                return queueSwitchConfirm(active, agentId);
              }
            }
            showToast(hub.error ?? 'Failed to activate expert', 'error');
            return { ok: false, error: hub.error };
          }
          await sleep(FADE_IN_MS);
          return { ok: true, hub: true };
        }

        const res = await activateAgent(agentId, locale, triggerMessage);
        if (!res.success || !res.data) {
          if (isAgentSwitchRequiresClinic(res)) {
            const active = await resolveServerActiveAgentId();
            if (active && active !== agentId) {
              return queueSwitchConfirm(active, agentId);
            }
          }
          showToast(res.error ?? 'Failed to activate expert', 'error');
          return { ok: false, error: res.error };
        }

        const { session_id, greeting, agent_id, resumed } = res.data;
        setActiveAgent(agent_id, session_id);

        const existing = useAgentStore.getState().getAgentMessages(agent_id);
        if (existing.length === 0) {
          if (resumed) {
            const loaded = await hydrateAgentMessagesFromSession(
              agent_id,
              session_id,
              setAgentMessages
            );
            if (!loaded) {
              setAgentMessages(agent_id, [
                {
                  id: `greeting_${Date.now()}`,
                  role: 'assistant',
                  content: greeting,
                  timestamp: new Date().toISOString(),
                  sessionId: session_id,
                },
              ]);
            }
          } else {
            setAgentMessages(agent_id, [
              {
                id: `greeting_${Date.now()}`,
                role: 'assistant',
                content: greeting,
                timestamp: new Date().toISOString(),
                sessionId: session_id,
              },
            ]);
          }
        }

        pushAgentHistory(agent_id);
        publishActiveAgentSync({
          type: 'activated',
          agentId: agent_id,
          sessionId: session_id,
        });
        await sleep(FADE_IN_MS);
        return { ok: true, resumed: Boolean(resumed) };
      } catch {
        showToast('Failed to activate expert', 'error');
        return { ok: false };
      } finally {
        setSwitching(false);
      }
    },
    [
      locale,
      hubRoutes,
      setSwitching,
      setSwitcherOpen,
      setActiveAgent,
      setAgentMessages,
      showToast,
      queueSwitchConfirm,
    ]
  );

  /** Path B precheck — explicit UI switch (cards, +, referrals). */
  const requestAgentSwitch = useCallback(
    async (agentId: string, triggerMessage?: string): Promise<AgentSwitchResult> => {
      const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
      if (!entry || entry.status === 'coming_soon') {
        showToast('Coming soon', 'info');
        return { ok: false };
      }

      const current = await resolveServerActiveAgentId();
      if (needsExplicitSwitchConfirm(current, agentId)) {
        return queueSwitchConfirm(current!, agentId);
      }
      return performAgentSwitch(agentId, triggerMessage);
    },
    [performAgentSwitch, queueSwitchConfirm, showToast]
  );

  const confirmPendingAgentSwitch = useCallback(async () => {
    const pending = useAgentStore.getState().pendingAgentSwitch;
    if (!pending) return { ok: false as const };
    setPendingAgentSwitch(null);
    return performAgentSwitch(pending.toAgentId);
  }, [performAgentSwitch, setPendingAgentSwitch]);

  const cancelPendingAgentSwitch = useCallback(() => {
    setPendingAgentSwitch(null);
  }, [setPendingAgentSwitch]);

  /** Silent restore for v1.3 sticky routing — no overlay, no activate call. */
  const resumeActiveAgentSilently = useCallback(
    async (agentId: string, sessionId: string) => {
      setActiveAgent(agentId, sessionId);
      const existing = useAgentStore.getState().getAgentMessages(agentId);
      if (existing.length === 0) {
        await hydrateAgentMessagesFromSession(agentId, sessionId, setAgentMessages);
      }
      pushAgentHistory(agentId);
      return { ok: true as const };
    },
    [setActiveAgent, setAgentMessages]
  );

  const syncActiveAgentFromGateway = useCallback(
    async (agentId: string, assistantMessage: ChatMessage) => {
      const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
      if (!entry || entry.status === 'coming_soon') {
        return { ok: false as const };
      }

      setSwitching(true);
      setSwitcherOpen(false);
      await sleep(FADE_OUT_MS);

      try {
        let sessionId = assistantMessage.sessionId;
        const activeRes = await getActiveAgent();
        if (activeRes.success && activeRes.data?.active_agent === agentId) {
          sessionId = activeRes.data.session_id ?? sessionId;
        } else if (!sessionId) {
          const activateRes = await activateAgent(agentId, locale);
          if (!activateRes.success || !activateRes.data) {
            if (isAgentSwitchRequiresClinic(activateRes)) {
              const active = await resolveServerActiveAgentId();
              if (active && active !== agentId) {
                queueSwitchConfirm(active, agentId);
                return { ok: false as const, needsConfirm: true as const };
              }
            }
            showToast(activateRes.error ?? 'Failed to activate expert', 'error');
            return { ok: false as const, error: activateRes.error };
          }
          sessionId = activateRes.data.session_id;
        }

        setActiveAgent(agentId, sessionId);
        setAgentMessages(agentId, [
          {
            ...assistantMessage,
            sessionId,
            streamComplete: assistantMessage.streamComplete ?? true,
          },
        ]);
        pushAgentHistory(agentId);
        publishActiveAgentSync({
          type: 'activated',
          agentId,
          sessionId,
        });
        await sleep(FADE_IN_MS);
        return { ok: true as const };
      } catch {
        showToast('Failed to activate expert', 'error');
        return { ok: false as const };
      } finally {
        setSwitching(false);
      }
    },
    [
      locale,
      setSwitching,
      setSwitcherOpen,
      setActiveAgent,
      setAgentMessages,
      showToast,
      queueSwitchConfirm,
    ]
  );

  const exitToClinic = useCallback(
    async (options?: { skipHistory?: boolean }) => {
      const currentAgentId = useAgentStore.getState().activeAgentId;
      if (!currentAgentId) {
        const activeRes = await getActiveAgent();
        if (!activeRes.data?.active_agent) {
          return { ok: true as const };
        }
      }

      setSwitching(true);
      await sleep(FADE_OUT_MS);

      try {
        const result = await deactivateToClinic(locale, {
          agentId: currentAgentId ?? undefined,
        });
        if (!result.ok) {
          showToast(result.error ?? 'Failed to return to clinic', 'error');
          return { ok: false as const };
        }

        if (result.returnMessage) {
          showToast(result.returnMessage, 'info');
        }
        if (!options?.skipHistory) {
          clearAgentHistory();
        } else {
          stripAgentParamsFromUrl();
        }

        await sleep(FADE_IN_MS);
        return { ok: true as const, reloadClinic: true as const };
      } finally {
        setSwitching(false);
      }
    },
    [locale, setSwitching, showToast]
  );

  const statusBadge =
    activeAgentId && getAgentStatusBadge(activeAgentId, locale as SupportedLocale);

  return {
    activeAgentId,
    agentSessionId,
    isSwitching,
    pendingAgentSwitch,
    statusBadge,
    fetchActiveAgent,
    resumeActiveAgentSilently,
    switchToAgent: performAgentSwitch,
    requestAgentSwitch,
    confirmPendingAgentSwitch,
    cancelPendingAgentSwitch,
    syncActiveAgentFromGateway,
    exitToClinic,
  };
}
