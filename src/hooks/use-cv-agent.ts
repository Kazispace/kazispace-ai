'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { activateAgent, deactivateAgent, getActiveAgent, parseAgentReply, sendAgentChat } from '@/lib/agent-api';
import { isAgentBlocked, isPaywallError } from '@/lib/api-errors';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { consumeCvAgentHandoff } from '@/lib/cv-agent-handoff';
import {
  extractCvMetaButtons,
  extractCvPreviewFromAgent,
  extractCvReplyFromAgent,
  patchDiffFromAgentMeta,
  patchPipelineStateFromMeta,
  resolveAgentMeta,
  type CvPreviewContent,
} from '@/lib/cv-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type { ActivateAgentResponse, AgentChatResponse, CvChatMessage, CvDiffPayload } from '@/types';
import type { ChatNextAction } from '@/types/chat-envelope';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function applyAgentMetaSideEffects(
  data: Pick<AgentChatResponse, 'meta' | 'response'>,
  openPaywall: (code: string) => void
): boolean {
  const meta = resolveAgentMeta(data);
  const errorCode = meta?.error_code;
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
  const [pipelineState, setPipelineState] = useState<string | null>(null);
  const [nextActions, setNextActions] = useState<ChatNextAction[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const applyCtaState = useCallback((data: AgentChatResponse | ActivateAgentResponse) => {
    const { nextActions: actions } = parseAgentReply(data as AgentChatResponse);
    if (actions.length > 0) {
      setNextActions(actions);
    }
    const buttons = extractCvMetaButtons(data);
    if (buttons.length > 0) {
      setQuickReplies(buttons);
    }
  }, []);

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
      patchDiffFromAgentMeta(data, setDiff);
      patchPipelineStateFromMeta(data, setPipelineState);
      applyCtaState(data);
      if (data.session_id) {
        setSessionId(data.session_id);
      }
    },
    [applyCtaState, openPaywall]
  );

  const applyActivateResponse = useCallback(
    (data: ActivateAgentResponse) => {
      applyAgentMetaSideEffects(data, openPaywall);
      const nextPreview = extractCvPreviewFromAgent(data);
      if (nextPreview) {
        setPreview(nextPreview);
      }
      patchDiffFromAgentMeta(data, setDiff);
      patchPipelineStateFromMeta(data, setPipelineState);
      applyCtaState(data);
    },
    [applyCtaState, openPaywall]
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

    const handoff = consumeCvAgentHandoff();
    const handoffSessionId = handoff?.sessionId;

    if (!handoffSessionId) {
      const activeRes = await getActiveAgent();
      if (gen !== activateGenRef.current) return;
      if (
        activeRes.success &&
        activeRes.data?.active_agent === CV_BUILDER_AGENT_ID &&
        activeRes.data.session_id
      ) {
        setSessionId(activeRes.data.session_id);
        if (handoff?.greeting) {
          setMessages([
            {
              id: nextId('cv'),
              role: 'assistant',
              content: handoff.greeting,
            },
          ]);
        }
        setIsLoading(false);
        return;
      }
    }

    if (handoffSessionId) {
      setSessionId(handoffSessionId);
      if (handoff?.greeting) {
        setMessages([
          {
            id: nextId('cv'),
            role: 'assistant',
            content: handoff.greeting,
          },
        ]);
      }
      setIsLoading(false);
      return;
    }

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
      setPipelineState(null);
      setNextActions([]);
      setQuickReplies([]);
      setSessionId(null);
      return;
    }
    setMessages([]);
    setPreview(null);
    setDiff(null);
    setPipelineState(null);
    setNextActions([]);
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
      const ctaSnapshot = { nextActions: [] as ChatNextAction[], quickReplies: [] as string[] };
      setIsSending(true);
      setError(null);
      setNextActions((prev) => {
        ctaSnapshot.nextActions = prev;
        return [];
      });
      setQuickReplies((prev) => {
        ctaSnapshot.quickReplies = prev;
        return [];
      });
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
        setNextActions(ctaSnapshot.nextActions);
        setQuickReplies(ctaSnapshot.quickReplies);
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

  const intakeConfirm = useCallback(
    () => sendAgentMessage('__action:confirm', { showUserBubble: false }),
    [sendAgentMessage]
  );

  const acceptCv = useCallback(
    () => sendAgentMessage('__action:accept_cv', { showUserBubble: false }),
    [sendAgentMessage]
  );

  /** @deprecated alias — diff panel Accept */
  const confirmCv = acceptCv;

  const regenerateCv = useCallback(
    () => sendAgentMessage('__action:regenerate', { showUserBubble: false }),
    [sendAgentMessage]
  );

  const restartSession = useCallback(async () => {
    if (!enabled || isSending || isLoading) return;
    const gen = ++activateGenRef.current;
    setIsLoading(true);
    setError(null);
    setNeedsOnboarding(false);
    setNeedsProfile(false);
    setMessages([]);
    setPreview(null);
    setDiff(null);
    setPipelineState(null);
    setNextActions([]);
    setQuickReplies([]);
    setSessionId(null);

    await deactivateAgent(CV_BUILDER_AGENT_ID, locale);
    if (gen !== activateGenRef.current) return;

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
  }, [
    applyActivateResponse,
    enabled,
    handleApiError,
    isLoading,
    isSending,
    jobId,
    locale,
  ]);

  const isSessionReady =
    !!sessionId && !isLoading && !needsProfile && !needsOnboarding && !error;

  return {
    messages,
    preview,
    diff,
    pipelineState,
    nextActions,
    quickReplies,
    isLoading,
    isSending,
    error,
    needsLogin: !isLoggedIn,
    needsOnboarding,
    needsProfile,
    isSessionReady,
    sendMessage,
    intakeConfirm,
    acceptCv,
    confirmCv,
    regenerateCv,
    restart: restartSession,
  };
}
