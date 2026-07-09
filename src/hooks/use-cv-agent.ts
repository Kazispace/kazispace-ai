'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  activateAgent,
  deactivateAgent,
  fetchAgentMessages,
  fetchAgentSessions,
  getActiveAgent,
  parseAgentReply,
  sendAgentChat,
} from '@/lib/agent-api';
import { isAgentBlocked, isPaywallError } from '@/lib/api-errors';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { consumeCvAgentHandoff } from '@/lib/cv-agent-handoff';
import {
  extractCvMetaButtons,
  extractCvPreviewFromAgent,
  extractCvReplyFromAgent,
  hydrateCvMetaFromAgentHistory,
  patchDiffFromAgentMeta,
  patchPipelineStateFromMeta,
  resolveAgentMeta,
  extractCvParsedSections,
  type CvPreviewContent,
} from '@/lib/cv-api';
import { uploadCvResumeFile, resolveCvUploadErrorMessage } from '@/lib/cv-input-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type {
  ActivateAgentResponse,
  AgentChatResponse,
  AgentSessionSummary,
  CvChatMessage,
  CvDiffPayload,
} from '@/types';
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

export function useCvAgent(jobId?: string | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const params = useParams();
  const locale = typeof params.locale === 'string' ? params.locale : 'en';
  const t = useTranslations('cv');
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
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedSections, setParsedSections] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const finishSessionLoad = useCallback((gen: number) => {
    if (gen === activateGenRef.current) {
      setIsLoading(false);
    }
  }, []);

  const loadSessionMessages = useCallback(
    async (sid: string, gen: number, greeting?: string) => {
      const hist = await fetchAgentMessages(sid);
      if (gen !== activateGenRef.current) return;

      if (!hist.success) {
        setError(hist.error ?? 'Failed to load session');
        setMessages([]);
        setPreview(null);
        setDiff(null);
        setPipelineState(null);
        return;
      }

      if (hist.data?.messages?.length) {
        setMessages(
          hist.data.messages.map((m, i) => ({
            id: m.id ?? `hist_${i}`,
            role: m.role as CvChatMessage['role'],
            content: m.content,
          }))
        );
        hydrateCvMetaFromAgentHistory(hist.data.messages, {
          setPipelineState,
          setPreview,
          setDiff,
          setParsedSections,
        });
        if (hist.data.pipeline_state) {
          setPipelineState(hist.data.pipeline_state);
        }
        return;
      }

      if (greeting) {
        setMessages([{ id: nextId('cv'), role: 'assistant', content: greeting }]);
      } else {
        setMessages([]);
        setPreview(null);
        setDiff(null);
        setPipelineState(null);
      }
    },
    []
  );

  const refreshSessions = useCallback(async () => {
    if (!enabled || !isLoggedIn) return;
    setSessionsLoading(true);
    const res = await fetchAgentSessions(CV_BUILDER_AGENT_ID);
    if (res.success && res.data) {
      setSessions(res.data.sessions);
    }
    setSessionsLoading(false);
  }, [enabled, isLoggedIn]);

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
      const sections = extractCvParsedSections(data);
      if (sections) setParsedSections(sections);
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
    setIsReadOnly(false);
    setParsedSections(null);
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
        const sid = activeRes.data.session_id;
        setSessionId(sid);
        await loadSessionMessages(sid, gen, handoff?.greeting);
        finishSessionLoad(gen);
        void refreshSessions();
        return;
      }
    }

    if (handoffSessionId) {
      setSessionId(handoffSessionId);
      await loadSessionMessages(handoffSessionId, gen, handoff?.greeting);
      finishSessionLoad(gen);
      void refreshSessions();
      return;
    }

    const res = await activateAgent(CV_BUILDER_AGENT_ID, locale, undefined, {
      job_id: jobId ?? undefined,
    });
    if (gen !== activateGenRef.current) return;

    if (!res.success || !res.data) {
      handleApiError(res);
      finishSessionLoad(gen);
      return;
    }

    const { session_id, greeting, resumed } = res.data;
    setSessionId(session_id);
    if (resumed) {
      await loadSessionMessages(session_id, gen);
      applyActivateResponse(res.data);
    } else {
      setMessages([{ id: nextId('cv'), role: 'assistant', content: greeting }]);
      applyActivateResponse(res.data);
    }
    finishSessionLoad(gen);
    void refreshSessions();
  }, [
    applyActivateResponse,
    enabled,
    finishSessionLoad,
    handleApiError,
    jobId,
    loadSessionMessages,
    locale,
    refreshSessions,
  ]);

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
      setSessions([]);
      setIsReadOnly(false);
      setParsedSections(null);
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
    setIsReadOnly(false);
    setParsedSections(null);
    void startSession();
  }, [enabled, isLoggedIn, jobId, startSession]);

  const selectSession = useCallback(
    async (sid: string) => {
      if (!enabled || !isLoggedIn || sid === sessionId) return;
      const gen = ++activateGenRef.current;
      setIsLoading(true);
      setError(null);
      setSessionId(sid);
      setMessages([]);
      setPreview(null);
      setDiff(null);
      setPipelineState(null);
      setNextActions([]);
      setQuickReplies([]);
      setParsedSections(null);

      const entry = sessions.find((s) => s.session_id === sid);
      setIsReadOnly(entry?.status === 'exited');

      await loadSessionMessages(sid, gen);
      finishSessionLoad(gen);
    },
    [enabled, finishSessionLoad, isLoggedIn, loadSessionMessages, sessionId, sessions]
  );

  const sendAgentMessage = useCallback(
    async (text: string, options?: { showUserBubble?: boolean }) => {
      if (!text.trim() || isSending || !enabled || !sessionId || isReadOnly) {
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
      const res = await sendAgentChat(CV_BUILDER_AGENT_ID, text.trim(), sessionId);
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
      void refreshSessions();
      return { ok: true as const };
    },
    [applyResponse, enabled, isReadOnly, isSending, openPaywall, refreshSessions, sessionId, showToast]
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

  const confirmCv = acceptCv;

  const regenerateCv = useCallback(
    () => sendAgentMessage('__action:regenerate', { showUserBubble: false }),
    [sendAgentMessage]
  );

  const uploadResume = useCallback(
    async (file: File) => {
      if (!enabled || !isLoggedIn || !sessionId || isReadOnly || isSending || isUploading) {
        return { ok: false as const };
      }

      setIsUploading(true);
      setError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('user'),
          role: 'user',
          content: `📎 ${file.name}`,
        },
      ]);

      const res = await uploadCvResumeFile(file, locale);
      if (!res.success || !res.data) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role === 'user' && last.content === `📎 ${file.name}`) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        showToast(resolveCvUploadErrorMessage(res.error, res.errorCode, t), 'error');
        setIsUploading(false);
        return { ok: false as const, error: res.error };
      }

      const agentPayload: AgentChatResponse = {
        agent_id: res.data.agent_id,
        response: res.data.response,
        meta: res.data.response.meta,
      };
      applyResponse(agentPayload);
      void refreshSessions();
      setIsUploading(false);
      return { ok: true as const };
    },
    [
      applyResponse,
      enabled,
      isLoggedIn,
      isReadOnly,
      isSending,
      isUploading,
      locale,
      refreshSessions,
      sessionId,
      showToast,
      t,
    ]
  );

  const restartSession = useCallback(async () => {
    if (!enabled || !isLoggedIn || isSending || isLoading) return;
    const gen = ++activateGenRef.current;
    setIsLoading(true);
    setError(null);
    setIsReadOnly(false);

    try {
      setNeedsOnboarding(false);
      setNeedsProfile(false);
      setMessages([]);
      setPreview(null);
      setDiff(null);
      setPipelineState(null);
      setNextActions([]);
      setQuickReplies([]);
      setSessionId(null);
      setParsedSections(null);

      const deact = await deactivateAgent(CV_BUILDER_AGENT_ID, locale);
      if (gen !== activateGenRef.current) return;
      if (!deact.success) {
        showToast(deact.error ?? 'Failed to reset CV session', 'error');
        return;
      }

      const res = await activateAgent(CV_BUILDER_AGENT_ID, locale, undefined, {
        job_id: jobId ?? undefined,
        force_new_session: true,
      });
      if (gen !== activateGenRef.current) return;

      if (!res.success || !res.data) {
        handleApiError(res);
        return;
      }

      const { session_id, greeting } = res.data;
      setSessionId(session_id);
      setMessages([{ id: nextId('cv'), role: 'assistant', content: greeting }]);
      applyActivateResponse(res.data);
      void refreshSessions();
    } finally {
      finishSessionLoad(gen);
    }
  }, [
    applyActivateResponse,
    enabled,
    finishSessionLoad,
    handleApiError,
    isLoading,
    isLoggedIn,
    isSending,
    jobId,
    locale,
    refreshSessions,
    showToast,
  ]);

  const isSessionReady =
    !!sessionId &&
    !isLoading &&
    !needsProfile &&
    !needsOnboarding &&
    !error &&
    !isReadOnly &&
    !isUploading;

  return {
    messages,
    preview,
    diff,
    pipelineState,
    nextActions,
    quickReplies,
    parsedSections,
    sessions,
    sessionsLoading,
    sessionId,
    isLoading,
    isSending,
    isUploading,
    error,
    needsLogin: !isLoggedIn,
    needsOnboarding,
    needsProfile,
    isSessionReady,
    isReadOnly,
    sendMessage,
    sendPayload: sendAgentMessage,
    intakeConfirm,
    acceptCv,
    confirmCv,
    regenerateCv,
    uploadResume,
    selectSession,
    refreshSessions,
    restart: restartSession,
  };
}
