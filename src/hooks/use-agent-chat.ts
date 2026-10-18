'use client';

import { useCallback } from 'react';
import { fetchAgentMessages, sendAgentChat } from '@/lib/agent-api';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { parsePendingTransition } from '@/lib/agent-pending-transition';
import { useAgentStore } from '@/lib/store';
import { mapAgentHistoryToChatMessages } from '@/lib/agent-sessions';
import type { RawAgentHistoryMessage } from '@/lib/agent-sessions';
import type { ChatMessage } from '@/types';
import { rememberFailedSend, takeFailedSend } from '@/lib/chat/failed-send-options';
import { isOffline, retryAtFrom } from '@/lib/chat/connectivity';
import { isLlmBusy } from '@/lib/api-errors';

export function useAgentChat(
  agentId: string | null,
  sessionId: string | null,
  locale?: string
) {
  const {
    setAgentMessages,
    addAgentMessage,
    updateAgentMessage,
    removeAgentMessage,
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
        /** Re-send an existing "Not sent" bubble in place (D13). */
        retryMessageId?: string;
      }
    ) => {
      if (!agentId || !sessionId) {
        return { ok: false as const, error: 'No active expert' };
      }

      const displayContent = opts?.displayContent?.trim() || text.trim();
      const userMsgId = opts?.retryMessageId ?? `user_${Date.now()}`;
      // D16: typed offline → queued bubble; it sends when back online.
      const status = isOffline() ? ('queued' as const) : ('sending' as const);
      if (opts?.retryMessageId) {
        updateAgentMessage(agentId, userMsgId, { status, retryAt: undefined });
      } else {
        const userMsg: ChatMessage = {
          id: userMsgId,
          role: 'user',
          content: displayContent,
          timestamp: new Date().toISOString(),
          sessionId,
          status,
        };
        addAgentMessage(agentId, userMsg);
      }
      if (status === 'queued') {
        rememberFailedSend(`agent:${agentId}`, userMsgId, {
          text,
          displayContent: opts?.displayContent,
          actionMeta: opts?.actionMeta,
        });
        return { ok: false as const, error: 'offline', queued: true as const };
      }
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
        // D13: keep the user's bubble, mark it "Not sent"; no warning reply.
        removeAgentMessage(agentId, assistantId);
        updateAgentMessage(agentId, userMsgId, {
          status: 'failed',
          retryAt: isLlmBusy(res) ? retryAtFrom(res.retryAfter) : undefined,
        });
        rememberFailedSend(`agent:${agentId}`, userMsgId, {
          text,
          displayContent: opts?.displayContent,
          actionMeta: opts?.actionMeta,
        });
        return { ok: false as const, error: res.error };
      }

      updateAgentMessage(agentId, userMsgId, { status: 'sent' });

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
      removeAgentMessage,
      setAgentSending,
      setAgentStreaming,
    ]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (!agentId) return { ok: false as const };
      const msg = useAgentStore
        .getState()
        .getAgentMessages(agentId)
        .find((m) => m.id === messageId);
      if (!msg || msg.role !== 'user') return { ok: false as const };
      const scope = `agent:${agentId}`;
      const original = takeFailedSend(scope, messageId);
      const res = await sendMessage(original?.text ?? msg.content, {
        displayContent: original?.displayContent,
        actionMeta: original?.actionMeta,
        retryMessageId: messageId,
      });
      if (!res.ok && original) rememberFailedSend(scope, messageId, original);
      return res;
    },
    [agentId, sendMessage]
  );

  return {
    messages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage,
    retryMessage,
  };
}
