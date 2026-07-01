'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  extractCvButtons,
  extractCvPreview,
  extractCvReply,
  postCvChat,
  type CvPreviewContent,
} from '@/lib/cv-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type { CvChatMessage } from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useCvChat(jobId?: string | null) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const [messages, setMessages] = useState<CvChatMessage[]>([]);
  const [preview, setPreview] = useState<CvPreviewContent | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const applyResponse = useCallback(
    (data: Parameters<typeof extractCvReply>[0]) => {
      const reply = extractCvReply(data);
      if (reply) {
        setMessages((prev) => [
          ...prev,
          { id: nextId('cv'), role: 'assistant', content: reply },
        ]);
      }
      const nextPreview = extractCvPreview(data);
      if (nextPreview) {
        setPreview(nextPreview);
      }
      setQuickReplies(extractCvButtons(data));
    },
    []
  );

  const handleApiError = useCallback(
    (res: { error?: string; errorCode?: string }) => {
      if (res.errorCode === 'ONBOARDING_INCOMPLETE') {
        setNeedsOnboarding(true);
        setError(null);
        return;
      }
      setError(res.error ?? 'Failed to start CV session');
    },
    []
  );

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNeedsOnboarding(false);
    const res = await postCvChat({
      action: 'start',
      job_id: jobId ?? undefined,
    });
    if (!res.success || !res.data) {
      handleApiError(res);
      setIsLoading(false);
      return;
    }
    applyResponse(res.data);
    setIsLoading(false);
  }, [applyResponse, handleApiError, jobId]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoading(false);
      setMessages([]);
      setPreview(null);
      setQuickReplies([]);
      return;
    }
    setMessages([]);
    setPreview(null);
    setQuickReplies([]);
    setError(null);
    setNeedsOnboarding(false);
    void startSession();
  }, [isLoggedIn, jobId, startSession]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      setIsSending(true);
      setError(null);
      setQuickReplies([]);
      setMessages((prev) => [
        ...prev,
        { id: nextId('user'), role: 'user', content: text.trim() },
      ]);
      const res = await postCvChat({
        action: 'message',
        message: text.trim(),
        job_id: jobId ?? undefined,
      });
      if (!res.success || !res.data) {
        if (res.errorCode === 'ONBOARDING_INCOMPLETE') {
          setNeedsOnboarding(true);
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
    [applyResponse, isSending, jobId, showToast]
  );

  return {
    messages,
    preview,
    quickReplies,
    isLoading,
    isSending,
    error,
    needsLogin: !isLoggedIn,
    needsOnboarding,
    sendMessage,
    restart: startSession,
  };
}
