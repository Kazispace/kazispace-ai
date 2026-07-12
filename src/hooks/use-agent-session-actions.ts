'use client';

import { useCallback, useState } from 'react';

import {
  exitAgentSession,
  newAgentSession,
} from '@/lib/agent-api';
import {
  publishSessionNavSessionOpened,
} from '@/lib/session-nav-events';

export function useAgentSessionActions(locale: string) {
  const [confirmAgentId, setConfirmAgentId] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | undefined>();
  const [isBusy, setIsBusy] = useState(false);

  const runNewSession = useCallback(
    async (
      agentId: string,
      options?: { confirmAbandon?: boolean; jobId?: string }
    ) => {
      setIsBusy(true);
      const res = await newAgentSession(agentId, locale, {
        confirm_abandon: options?.confirmAbandon,
        job_id: options?.jobId,
      });
      setIsBusy(false);

      if (
        res.errorCode === 'SESSION_IN_PROGRESS' ||
        res.error?.includes('SESSION_IN_PROGRESS')
      ) {
        setConfirmAgentId(agentId);
        setPendingJobId(options?.jobId);
        return { ok: false as const, needsConfirm: true as const };
      }

      if (res.success && res.data) {
        publishSessionNavSessionOpened(agentId, res.data);
        return { ok: true as const, data: res.data };
      }

      return { ok: false as const, error: res.error };
    },
    [locale]
  );

  const requestNewSession = useCallback(
    (agentId: string, options?: { jobId?: string }) =>
      runNewSession(agentId, options),
    [runNewSession]
  );

  const confirmAbandonAndNew = useCallback(async () => {
    if (!confirmAgentId) return { ok: false as const };
    const agentId = confirmAgentId;
    const jobId = pendingJobId;
    setConfirmAgentId(null);
    setPendingJobId(undefined);
    return runNewSession(agentId, { confirmAbandon: true, jobId });
  }, [confirmAgentId, pendingJobId, runNewSession]);

  const cancelConfirmAbandon = useCallback(() => {
    setConfirmAgentId(null);
    setPendingJobId(undefined);
  }, []);

  const exitSession = useCallback(
    async (agentId: string) => {
      setIsBusy(true);
      const res = await exitAgentSession(agentId, locale);
      setIsBusy(false);
      return res;
    },
    [locale]
  );

  return {
    requestNewSession,
    confirmAbandonAndNew,
    cancelConfirmAbandon,
    exitSession,
    confirmAgentId,
    isBusy,
  };
}
