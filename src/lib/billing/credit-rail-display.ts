import type { CreditBalance } from '@/types';

/**
 * Icon rail uses red styling when total credits are below this value.
 * Totals at or above use healthy (green) styling.
 */
export const CREDIT_RAIL_LOW_THRESHOLD = 100;

export function creditRailTotal(balance: CreditBalance | null | undefined): number {
  if (!balance) return 0;
  return (balance.cvCredits ?? 0) + (balance.interviewCredits ?? 0);
}

export function isCreditRailLow(balance: CreditBalance | null | undefined): boolean {
  return creditRailTotal(balance) < CREDIT_RAIL_LOW_THRESHOLD;
}

/** Compact label for narrow icon rail (e.g. 139.1k). */
export function formatCreditRailAmount(total: number): string {
  if (!Number.isFinite(total) || total < 0) return '0';
  if (total >= 10_000) return `${Math.round(total / 1000)}k`;
  if (total >= 1000) {
    const k = total / 1000;
    return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(Math.round(total));
}
