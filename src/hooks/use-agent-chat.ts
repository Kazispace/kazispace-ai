'use client';

import { useCallback } from 'react';
import { fetchAgentMessages, parseAgentReply, sendAgentChat } from '@/lib/agent-api';
import { parseAgentEscalation } from '@/lib/agent-escalation';
import { parsePendingTransition } from '@/lib/agent-pending-transition';
import { useAgentStore } from '@/lib/store';
import { mapAgentHistoryToChatMessages } from '@/lib/agent-sessions';
import type { RawAgentHistoryMessage } from '@/lib/agent-sessions';
import type { ChatMessage } from '@/types';

export function useAgentChat(agentId: string | null, sessionId: string | null) {
  const {
    setAgentMessages,
    addAgentMessage,
    updateAgentMessage,
    isAgentSending,
    isAgentStreaming,
    setAgentSending,
    setAgentStreaming,
  } = useAgentStore();

  const messages = useAgentStore((s) =>
    agentId ? s.agentMessages[agentId] ?? [] : []
  );

  const loadAgentHistory = useCallback(async () => {
    if (!agentId || !sessionId) return;
    const res = await fetchAgentMessages(sessionId);
    if (!res.success || !res.data) return;

    const list = res.data.messages ?? [];
    if (list.length > 0) {
      setAgentMessages(
        agentId,
        mapAgentHistoryToChatMessages(
          list as RawAgentHistoryMessage[],
          sessionId
        )
      );
    }
  }, [agentId, sessionId, setAgentMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!agentId || !sessionId) {
        return { ok: false as const, error: 'No active expert' };
      }

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        sessionId,
      };
      addAgentMessage(agentId, userMsg);
      setAgentSending(true);

      const assistantId = `assistant_${Date.now()}`;
      addAgentMessage(agentId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        sessionId,
      });
      setAgentStreaming(true);

      const res = await sendAgentChat(agentId, text, sessionId);
      setAgentSending(false);
      setAgentStreaming(false);

      if (!res.success || !res.data) {
        updateAgentMessage(agentId, assistantId, {
          content: `⚠️ ${res.error ?? 'Something went wrong.'}`,
        });
        return { ok: false as const, error: res.error };
      }

      const parsed = parseAgentReply(res.data);
      const escalation = parseAgentEscalation(res.data);
      const pendingTransition = parsePendingTransition(res.data);

      if (pendingTransition) {
        return {
          ok: true as const,
          pendingTransition,
          /** Sync Path C: handoff text is this send's user input, not `trigger_message_id`. */
          triggerMessage: text,
          assistantPlaceholderId: assistantId,
        };
      }

      updateAgentMessage(agentId, assistantId, {
        content: parsed.reply || '…',
        ...(parsed.nextActions.length > 0 ? { nextActions: parsed.nextActions } : {}),
        ...(parsed.cards.length > 0 ? { cards: parsed.cards } : {}),
        ...(parsed.workflow ? { workflow: parsed.workflow } : {}),
      });
      return {
        ok: true as const,
        ...(escalation ? { escalation } : {}),
      };
    },
    [
      agentId,
      sessionId,
      addAgentMessage,
      updateAgentMessage,
      setAgentSending,
      setAgentStreaming,
    ]
  );

  return {
    messages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage,
  };
}
