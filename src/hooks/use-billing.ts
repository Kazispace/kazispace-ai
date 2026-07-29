'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBillingSummary, getCurrentPlan } from '@/lib/api-client';
import { parseCreditBalance } from '@/lib/api-mappers';
import { getCachedBilling, setCachedBilling } from '@/lib/billing-cache';
import { useAuthStore } from '@/lib/store';
import type { CreditBalance, CurrentPlan } from '@/types';

/** Billing summary + plan; uses `billing-cache` (5 min TTL) unless `refresh(true)`. */
export function useBilling() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!isLoggedIn) {
        setBalance(null);
        setPlan(null);
        setIsLoading(false);
        return;
      }

      if (!force) {
        const cached = getCachedBilling();
        if (cached) {
          setBalance(cached.balance);
          setPlan(cached.plan);
          setIsLoading(false);
          setError(null);
          return;
        }
      }
      setError(null);
      setIsLoading(true);

      const [summaryRes, planRes] = await Promise.all([
        getBillingSummary(),
        getCurrentPlan(),
      ]);

      let nextBalance: CreditBalance | null = null;
      let nextPlan: CurrentPlan | null = null;

      if (summaryRes.success && summaryRes.data) {
        nextBalance = parseCreditBalance(summaryRes.data);
        setBalance(nextBalance);
      } else {
        setError(summaryRes.error ?? 'Failed to load credits');
      }

      if (planRes.success && planRes.data) {
        nextPlan = planRes.data;
        setPlan(nextPlan);
      }

      if (nextBalance) {
        setCachedBilling(nextBalance, nextPlan);
      }

      setIsLoading(false);
    },
    [isLoggedIn]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, plan, isLoading, error, refresh: () => refresh(true) };
}
