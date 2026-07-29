import type { CreditBalance, CurrentPlan } from '@/types';

/** Shared in-memory billing cache TTL (see `getCachedBilling`). */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface BillingCacheEntry {
  balance: CreditBalance;
  plan: CurrentPlan | null;
  fetchedAt: number;
}

let cache: BillingCacheEntry | null = null;

export function getCachedBilling(): BillingCacheEntry | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return cache;
}

export function setCachedBilling(balance: CreditBalance, plan: CurrentPlan | null): void {
  cache = { balance, plan, fetchedAt: Date.now() };
}

export function clearBillingCache(): void {
  cache = null;
}
