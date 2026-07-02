'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { activateAgent, sendAgentChat } from '@/lib/agent-api';
import { isAgentBlocked, isPaywallError } from '@/lib/api-errors';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import {
  extractCvButtonsFromAgent,
  extractCvDiffFromAgent,
  extractCvPreviewFromAgent,
  extractCvReplyFromAgent,
  type CvPreviewContent,
} from '@/lib/cv-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type { ActivateAgentResponse, AgentChatResponse, CvChatMessage, CvDiffPayload } from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function applyAgentMetaSideEffects(
  data: Pick<AgentChatResponse, 'meta'>,
  openPaywall: (code: string) => void
): boolean {
  const errorCode = data.meta?.error_code;
  if (errorCode && isPaywallError({ errorCode })) {
    openPaywall(errorCode);
    return true;
  }
  return false;
}

export function useCvAgent(
  jobId?: string | null,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const params = useParams();
  const locale = typeof params.locale === 'string' ? params.locale : 'en';
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const activateGenRef = useRef(0);

  const [messages, setMessages] = useState<CvChatMessage[]>([]);
  const [preview, setPreview] = useState<CvPreviewContent | null>(null);
  const [diff, setDiff] = useState<CvDiffPayload | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const applyResponse = useCallback(
    (data: AgentChatResponse, options?: { skipReply?: boolean }) => {
      applyAgentMetaSideEffects(data, openPaywall);

      if (!options?.skipReply) {
        const reply = extractCvReplyFromAgent(data);
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { id: nextId('cv'), role: 'assistant', content: reply },
          ]);
        }
      }
      const nextPreview = extractCvPreviewFromAgent(data);
      if (nextPreview) {
        setPreview(nextPreview);
      }
      const nextDiff = extractCvDiffFromAgent(data);
      setDiff(nextDiff);
      const buttons = extractCvButtonsFromAgent(data);
      if (buttons.length > 0) {
        setQuickReplies(buttons);
      }
      if (data.session_id) {
        setSessionId(data.session_id);
      }
    },
    [openPaywall]
  );

  const applyActivateResponse = useCallback(
    (data: ActivateAgentResponse) => {
      applyAgentMetaSideEffects(data, openPaywall);
      const nextPreview = extractCvPreviewFromAgent(data);
      if (nextPreview) {
        setPreview(nextPreview);
      }
      const buttons = extractCvButtonsFromAgent({
        response: { next_actions: data.response?.next_actions },
        meta: data.meta,
      });
      if (buttons.length > 0) {
        setQuickReplies(buttons);
      }
    },
    [openPaywall]
  );

  const handleApiError = useCallback(
    (res: { error?: string; errorCode?: string }) => {
      if (res.errorCode === 'ONBOARDING_INCOMPLETE') {
        setNeedsOnboarding(true);
        setError(null);
        return;
      }
      if (isAgentBlocked(res)) {
        setNeedsProfile(true);
        setError(null);
        return;
      }
      if (isPaywallError(res) && res.errorCode) {
        openPaywall(res.errorCode);
        setError(null);
        return;
      }
      setError(res.error ?? 'Failed to start CV session');
    },
    [openPaywall]
  );

  const startSession = useCallback(async () => {
    if (!enabled) return;
    const gen = ++activateGenRef.current;
    setIsLoading(true);
    setError(null);
    setNeedsOnboarding(false);
    setNeedsProfile(false);
    setSessionId(null);

    const res = await activateAgent(CV_BUILDER_AGENT_ID, locale, undefined, {
      job_id: jobId ?? undefined,
    });
    if (gen !== activateGenRef.current) return;

    if (!res.success || !res.data) {
      handleApiError(res);
      setIsLoading(false);
      return;
    }

    const { session_id, greeting } = res.data;
    setSessionId(session_id);
    setMessages([
      {
        id: nextId('cv'),
        role: 'assistant',
        content: greeting,
      },
    ]);
    applyActivateResponse(res.data);
    setIsLoading(false);
  }, [applyActivateResponse, enabled, handleApiError, jobId, locale]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    if (!isLoggedIn) {
      setIsLoading(false);
      setMessages([]);
      setPreview(null);
      setDiff(null);
      setQuickReplies([]);
      setSessionId(null);
      return;
    }
    setMessages([]);
    setPreview(null);
    setDiff(null);
    setQuickReplies([]);
    setSessionId(null);
    setError(null);
    setNeedsOnboarding(false);
    setNeedsProfile(false);
    void startSession();
  }, [enabled, isLoggedIn, jobId, startSession]);

  const sendAgentMessage = useCallback(
    async (text: string, options?: { showUserBubble?: boolean }) => {
      if (!text.trim() || isSending || !enabled || !sessionId) {
        return { ok: false as const };
      }
      setIsSending(true);
      setError(null);
      setQuickReplies([]);
      if (options?.showUserBubble !== false) {
        setMessages((prev) => [
          ...prev,
          { id: nextId('user'), role: 'user', content: text.trim() },
        ]);
      }
      const res = await sendAgentChat(
        CV_BUILDER_AGENT_ID,
        text.trim(),
        sessionId
      );
      if (!res.success || !res.data) {
        if (res.errorCode === 'ONBOARDING_INCOMPLETE') {
          setNeedsOnboarding(true);
        } else if (isAgentBlocked(res)) {
          setNeedsProfile(true);
        } else if (isPaywallError(res) && res.errorCode) {
          openPaywall(res.errorCode);
        } else {
          showToast(res.error ?? 'Failed to send message', 'error');
        }
        setIsSending(false);
        return { ok: false as const, error: res.error };
      }
      applyResponse(res.data);
      setIsSending(false);
      return { ok: true as const };
    },
    [applyResponse, enabled, isSending, openPaywall, sessionId, showToast]
  );

  const sendMessage = useCallback(
    (text: string) => sendAgentMessage(text),
    [sendAgentMessage]
  );

  const confirmCv = useCallback(
    () => sendAgentMessage('confirm', { showUserBubble: false }),
    [sendAgentMessage]
  );

  const regenerateCv = useCallback(
    () => sendAgentMessage('__action:regenerate', { showUserBubble: false }),
    [sendAgentMessage]
  );

  const isSessionReady =
    !!sessionId && !isLoading && !needsProfile && !needsOnboarding && !error;

  return {
    messages,
    preview,
    diff,
    quickReplies,
    isLoading,
    isSending,
    error,
    needsLogin: !isLoggedIn,
    needsOnboarding,
    needsProfile,
    isSessionReady,
    sendMessage,
    confirmCv,
    regenerateCv,
    restart: startSession,
  };
}
