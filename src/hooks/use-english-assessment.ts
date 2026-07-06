'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  completeEnglishAssessment,
  createEnglishAssessmentSession,
  getEnglishAssessmentSession,
  submitEnglishAssessmentAudioItem,
  submitEnglishAssessmentTextItem,
} from '@/lib/english-api';
import type {
  EnglishAssessmentCompleteResult,
  EnglishAssessmentSession,
  EnglishOnboardingRequest,
} from '@/types';

export type AssessmentFlowPhase =
  | 'idle'
  | 'creating'
  | 'active'
  | 'scoring'
  | 'completing'
  | 'done'
  | 'error';

async function pollAssessmentUntilSettled(
  sessionId: string,
  maxAttempts = 20,
  intervalMs = 1500
): Promise<EnglishAssessmentSession> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await getEnglishAssessmentSession(sessionId);
    if (!res.success || !res.data) {
      throw new Error(res.error ?? 'Failed to poll assessment session');
    }
    if (res.data.status === 'completed' || res.data.status === 'failed') {
      return res.data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Assessment scoring timed out');
}

export function useEnglishAssessment() {
  const [session, setSession] = useState<EnglishAssessmentSession | null>(null);
  const [phase, setPhase] = useState<AssessmentFlowPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnglishAssessmentCompleteResult | null>(null);

  const startMutation = useMutation({
    mutationFn: async (onboarding?: EnglishOnboardingRequest) => {
      const res = await createEnglishAssessmentSession({
        variant: 'quick',
        ...(onboarding ?? {}),
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to start assessment');
      }
      return res.data;
    },
  });

  const startQuickAssessment = useCallback(
    async (onboarding?: EnglishOnboardingRequest) => {
      setError(null);
      setPhase('creating');
      try {
        const data = await startMutation.mutateAsync(onboarding);
        setSession(data);
        setPhase('active');
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start assessment';
        setError(message);
        setPhase('error');
        throw err;
      }
    },
    [startMutation]
  );

  const submitItem = useCallback(
    async (params: {
      item_index: number;
      type: 'speaking' | 'writing';
      audio?: Blob;
      transcript?: string;
      text?: string;
    }) => {
      if (!session?.session_id) {
        throw new Error('No active assessment session');
      }
      setError(null);
      if (params.type === 'writing') {
        const res = await submitEnglishAssessmentTextItem(session.session_id, {
          item_index: params.item_index,
          answer_mode: 'text',
          text: params.text ?? '',
        });
        if (!res.success) throw new Error(res.error ?? 'Failed to submit writing');
        return;
      }
      if (!params.audio) throw new Error('Audio recording required');
      const res = await submitEnglishAssessmentAudioItem(session.session_id, {
        item_index: params.item_index,
        audio: params.audio,
        transcript: params.transcript,
      });
      if (!res.success) throw new Error(res.error ?? 'Failed to submit speaking');
    },
    [session?.session_id]
  );

  const completeAssessment = useCallback(async () => {
    if (!session?.session_id) {
      throw new Error('No active assessment session');
    }
    setPhase('scoring');
    setError(null);
    try {
      await pollAssessmentUntilSettled(session.session_id, 1, 0);
      setPhase('completing');
      const res = await completeEnglishAssessment(session.session_id);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to complete assessment');
      }
      setResult(res.data);
      setPhase('done');
      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assessment failed';
      setError(message);
      setPhase('error');
      throw err;
    }
  }, [session?.session_id]);

  const resetAssessment = useCallback(() => {
    setSession(null);
    setPhase('idle');
    setError(null);
    setResult(null);
  }, []);

  return {
    session,
    phase,
    error,
    result,
    startQuickAssessment,
    submitItem,
    completeAssessment,
    resetAssessment,
    isCreating: startMutation.isPending || phase === 'creating',
    isScoring: phase === 'scoring' || phase === 'completing',
  };
}
