'use client';

import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import {
  createEnglishTrainingSession,
  getEnglishTrainingSession,
  submitEnglishTrainingAudioItem,
} from '@/lib/english-api';
import { DEFAULT_ENGLISH_SCENARIO_ID } from '@/types';
import type { EnglishTrainingSession } from '@/types';

export type TrainingFlowPhase =
  | 'idle'
  | 'creating'
  | 'active'
  | 'scoring'
  | 'done'
  | 'error';

async function pollTrainingUntilComplete(
  sessionId: string,
  maxAttempts = 24,
  intervalMs = 1500
): Promise<EnglishTrainingSession> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await getEnglishTrainingSession(sessionId);
    if (!res.success || !res.data) {
      throw new Error(res.error ?? 'Failed to poll training session');
    }
    if (res.data.status === 'failed') {
      throw new Error('Training scoring failed');
    }
    if (res.data.status === 'completed') {
      return res.data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Training feedback timed out');
}

export function useEnglishTraining() {
  const [session, setSession] = useState<EnglishTrainingSession | null>(null);
  const [phase, setPhase] = useState<TrainingFlowPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      const res = await createEnglishTrainingSession({ scenario_id: scenarioId });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to start training');
      }
      return res.data;
    },
  });

  const startTraining = useCallback(
    async (scenarioId = DEFAULT_ENGLISH_SCENARIO_ID) => {
      setError(null);
      setPhase('creating');
      try {
        const data = await startMutation.mutateAsync(scenarioId);
        setSession(data);
        setPhase('active');
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start training';
        setError(message);
        setPhase('error');
        throw err;
      }
    },
    [startMutation]
  );

  const submitResponse = useCallback(
    async (params: {
      item_index: number;
      audio: Blob;
      transcript?: string;
    }) => {
      if (!session?.session_id) {
        throw new Error('No active training session');
      }
      setError(null);
      setPhase('scoring');
      try {
        const res = await submitEnglishTrainingAudioItem(session.session_id, params);
        if (!res.success) {
          throw new Error(res.error ?? 'Failed to submit response');
        }
        const completed = await pollTrainingUntilComplete(session.session_id);
        setSession(completed);
        setPhase('done');
        return completed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Training failed';
        setError(message);
        setPhase('error');
        throw err;
      }
    },
    [session?.session_id]
  );

  const resetTraining = useCallback(() => {
    setSession(null);
    setPhase('idle');
    setError(null);
  }, []);

  return {
    session,
    phase,
    error,
    startTraining,
    submitResponse,
    resetTraining,
    isCreating: startMutation.isPending || phase === 'creating',
    isScoring: phase === 'scoring',
  };
}
