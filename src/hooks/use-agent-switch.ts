'use client';

import { useCallback } from 'react';
import {
  activateAgent,
  deactivateAgent,
  fetchAgentMessages,
  getActiveAgent,
} from '@/lib/agent-api';
import { AGENT_REGISTRY, getAgentStatusBadge } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import { useAgentStore, useUIStore } from '@/lib/store';
import type { ChatMessage } from '@/types';

const FADE_OUT_MS = 300;
const FADE_IN_MS = 700;

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

export function useAgentSwitch(locale: string) {
  const {
    activeAgentId,
    agentSessionId,
    isSwitching,
    setSwitching,
    setActiveAgent,
    setAgentMessages,
    addAgentMessage,
    setSwitcherOpen,
  } = useAgentStore();
  const showToast = useUIStore((s) => s.showToast);

  const fetchActiveAgent = useCallback(async () => {
    const res = await getActiveAgent();
    if (!res.success || !res.data?.active_agent) return null;
    setActiveAgent(res.data.active_agent, res.data.session_id);
    return res.data;
  }, [setActiveAgent]);

  const switchToAgent = useCallback(
    async (agentId: string, triggerMessage?: string) => {
      const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
      if (!entry || entry.status === 'coming_soon') {
        showToast('Coming soon', 'info');
        return { ok: false as const };
      }

      setSwitching(true);
      setSwitcherOpen(false);
      await sleep(FADE_OUT_MS);

      try {
        const currentActive = useAgentStore.getState().activeAgentId;
        if (currentActive && currentActive !== agentId) {
          await deactivateAgent(currentActive, locale);
          setActiveAgent(null, null);
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
            await sleep(FADE_IN_MS);
            return { ok: true as const, resumed: true as const };
          }
        }

        const res = await activateAgent(agentId, locale, triggerMessage);
        if (!res.success || !res.data) {
          showToast(res.error ?? 'Failed to activate expert', 'error');
          return { ok: false as const, error: res.error };
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
        await sleep(FADE_IN_MS);
        return { ok: true as const, resumed: Boolean(resumed) };
      } catch {
        showToast('Failed to activate expert', 'error');
        return { ok: false as const };
      } finally {
        setSwitching(false);
      }
    },
    [locale, setSwitching, setSwitcherOpen, setActiveAgent, setAgentMessages, showToast]
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
    ]
  );

  const exitToClinic = useCallback(
    async (options?: { skipHistory?: boolean }) => {
      if (!activeAgentId) return { ok: true as const };

      setSwitching(true);
      await sleep(FADE_OUT_MS);

      try {
        const res = await deactivateAgent(activeAgentId, locale);
        if (!res.success || !res.data) {
          showToast(res.error ?? 'Failed to return to clinic', 'error');
          return { ok: false as const };
        }

        setActiveAgent(null, null);
        if (res.data.return_message) {
          showToast(res.data.return_message, 'info');
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
    [activeAgentId, locale, setSwitching, setActiveAgent, showToast]
  );

  const statusBadge =
    activeAgentId && getAgentStatusBadge(activeAgentId, locale as SupportedLocale);

  return {
    activeAgentId,
    agentSessionId,
    isSwitching,
    statusBadge,
    fetchActiveAgent,
    switchToAgent,
    syncActiveAgentFromGateway,
    exitToClinic,
  };
}
