'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBillingSummary, getCurrentPlan } from '@/lib/api-client';
import { parseCreditBalance } from '@/lib/api-mappers';
import { useAuthStore } from '@/lib/store';
import type { CreditBalance, CurrentPlan } from '@/types';

export function useBilling() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) {
      setBalance(null);
      setPlan(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [summaryRes, planRes] = await Promise.all([
      getBillingSummary(),
      getCurrentPlan(),
    ]);

    if (summaryRes.success && summaryRes.data) {
      setBalance(parseCreditBalance(summaryRes.data));
    } else {
      setError(summaryRes.error ?? 'Failed to load credits');
    }

    if (planRes.success && planRes.data) {
      setPlan(planRes.data);
    }

    setIsLoading(false);
  }, [isLoggedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, plan, isLoading, error, refresh };
}
