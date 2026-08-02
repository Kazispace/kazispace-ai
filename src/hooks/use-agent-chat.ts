'use client';

import { useCallback } from 'react';
import { fetchAgentMessages, sendAgentChat } from '@/lib/agent-api';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { parsePendingTransition } from '@/lib/agent-pending-transition';
import { useAgentStore } from '@/lib/store';
import { mapAgentHistoryToChatMessages } from '@/lib/agent-sessions';
import type { RawAgentHistoryMessage } from '@/lib/agent-sessions';
import type { ChatMessage } from '@/types';

export function useAgentChat(
  agentId: string | null,
  sessionId: string | null,
  locale?: string
) {
  const {
    setAgentMessages,
    addAgentMessage,
    updateAgentMessage,
    setAgentSending,
    setAgentStreaming,
  } = useAgentStore();

  const messages = useAgentStore((s) =>
    agentId ? s.getAgentMessages(agentId) : []
  );

  const isAgentSending = useAgentStore((s) =>
    agentId ? s.getAgentSlice(agentId).isSending : false
  );

  const isAgentStreaming = useAgentStore((s) =>
    agentId ? s.getAgentSlice(agentId).isStreaming : false
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
          sessionId,
          locale
        )
      );
    }
  }, [agentId, sessionId, locale, setAgentMessages]);

  const sendMessage = useCallback(
    async (
      text: string,
      opts?: {
        displayContent?: string;
        actionMeta?: import('@/types/chat-envelope').UserMessageActionMeta;
      }
    ) => {
      if (!agentId || !sessionId) {
        return { ok: false as const, error: 'No active expert' };
      }

      const displayContent = opts?.displayContent?.trim() || text.trim();
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: displayContent,
        timestamp: new Date().toISOString(),
        sessionId,
      };
      addAgentMessage(agentId, userMsg);
      setAgentSending(agentId, true);

      const assistantId = `assistant_${Date.now()}`;
      addAgentMessage(agentId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        sessionId,
      });
      setAgentStreaming(agentId, true);

      const res = await sendAgentChat(
        agentId,
        displayContent,
        sessionId,
        opts?.actionMeta ? { actionMeta: opts.actionMeta } : undefined
      );
      setAgentSending(agentId, false);
      setAgentStreaming(agentId, false);

      if (!res.success || !res.data) {
        updateAgentMessage(agentId, assistantId, {
          content: `⚠️ ${res.error ?? 'Something went wrong.'}`,
        });
        return { ok: false as const, error: res.error };
      }

      const { assistant, escalation } = handleAgentEnvelope(res.data);
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
        content: assistant.content,
        ...(assistant.intent ? { intent: assistant.intent } : {}),
        ...(assistant.nextActions ? { nextActions: assistant.nextActions } : {}),
        ...(assistant.cards ? { cards: assistant.cards } : {}),
        ...(assistant.workflow ? { workflow: assistant.workflow } : {}),
        ...(assistant.assistantMeta
          ? { assistantMeta: assistant.assistantMeta }
          : {}),
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
