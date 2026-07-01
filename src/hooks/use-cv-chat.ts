'use client';

import { useCallback, useEffect, useState } from 'react';
import { extractCvPreview, extractCvReply, postCvChat } from '@/lib/cv-api';
import { useAuthStore, useUIStore } from '@/lib/store';
import type { CvChatMessage } from '@/types';

function nextId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useCvChat(jobId?: string | null) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const [messages, setMessages] = useState<CvChatMessage[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResponse = useCallback((reply: string, preview: string | null) => {
    if (reply) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId('cv'),
          role: 'assistant',
          content: reply,
        },
      ]);
    }
    if (preview) {
      setPreviewHtml(preview);
    }
  }, []);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await postCvChat({
      action: 'start',
      job_id: jobId ?? undefined,
    });
    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to start CV session');
      setIsLoading(false);
      return;
    }
    applyResponse(extractCvReply(res.data), extractCvPreview(res.data));
    setIsLoading(false);
  }, [applyResponse, jobId]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoading(false);
      return;
    }
    void startSession();
  }, [isLoggedIn, startSession]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) return;
      setIsSending(true);
      setError(null);
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
        showToast(res.error ?? 'Failed to send message', 'error');
        setIsSending(false);
        return { ok: false as const, error: res.error };
      }
      applyResponse(extractCvReply(res.data), extractCvPreview(res.data));
      setIsSending(false);
      return { ok: true as const };
    },
    [applyResponse, isSending, jobId, showToast]
  );

  return {
    messages,
    previewHtml,
    isLoading,
    isSending,
    error,
    needsLogin: !isLoggedIn,
    sendMessage,
    restart: startSession,
  };
}
