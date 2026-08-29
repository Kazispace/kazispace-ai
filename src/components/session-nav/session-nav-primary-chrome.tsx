'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useBilling } from '@/hooks/use-billing';
import {
  creditRailTotal,
  formatCreditRailAmount,
  isCreditRailLow,
} from '@/lib/billing/credit-rail-display';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Heavier strokes than default nav icons (Coze-style primary affordances). */
export const PRIMARY_ICON_STROKE = 2.75;

/** Tailwind classes for the credits rail chip shell (testable). */
export function creditsChipShellClass(low: boolean): string {
  return cn(
    'flex min-h-[3rem] w-10 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors',
    low
      ? 'border-orange-200 bg-gradient-to-b from-orange-50 to-white hover:border-orange-300'
      : // KAZI-662: was a bare #E0E3E8 literal, a near-neighbor of
        // workspace.border (#E5E6EB) — merged into the existing token.
        'border-workspace-border bg-white hover:border-emerald-200/80 hover:bg-emerald-50/40'
  );
}

interface SessionIconRailCreditsProps {
  locale: string;
}

/**
 * Sidebar credits chip — uses `useBilling()` which reads `billing-cache` (5 min TTL)
 * before hitting the API; shared with Mine / Credits pages in the same session.
 */
export function SessionIconRailCredits({ locale }: SessionIconRailCreditsProps) {
  const t = useTranslations('sessionNav');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { balance, isLoading } = useBilling();

  const chipClass = creditsChipShellClass;

  if (!isLoggedIn) {
    return (
      <Link
        href={`/${locale}/login`}
        prefetch={false}
        className={chipClass(false)}
        aria-label={t('creditsSignIn')}
        title={t('creditsSignIn')}
      >
        <Coins className="h-4 w-4 text-workspace-secondary" strokeWidth={PRIMARY_ICON_STROKE} aria-hidden />
        <span className="text-xs font-bold leading-none text-workspace-muted">—</span>
      </Link>
    );
  }

  const total = creditRailTotal(balance);
  const low = isCreditRailLow(balance);
  const label = isLoading ? '…' : formatCreditRailAmount(total);

  return (
    <Link
      href={`/${locale}/credits`}
      className={chipClass(low)}
      aria-label={
        low
          ? t('creditsLowAria', { amount: label })
          : t('creditsRailAria', { amount: label })
      }
      title={
        low
          ? t('creditsLowAria', { amount: label })
          : t('creditsRailAria', { amount: label })
      }
    >
      <span className="relative flex flex-col items-center gap-0.5">
        <Coins
          className={cn(
            'h-4 w-4 shrink-0',
            low ? 'text-red-500' : 'text-emerald-600'
          )}
          strokeWidth={PRIMARY_ICON_STROKE}
          aria-hidden
        />
        {low ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden
          />
        ) : null}
      </span>
      <span
        className={cn(
          'max-w-[2.75rem] truncate text-xs font-bold tabular-nums leading-none tracking-tight',
          low ? 'text-red-600' : 'text-emerald-700'
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/** Circle + icon for high-salience “create” actions in session chrome. */
export function SessionNavPrimaryIconButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        // KAZI-662: #D0D3D9 is not a drift/near-neighbor of workspace.border
        // (#E5E6EB) despite looking like one at a glance — it's noticeably
        // more saturated (confirmed with design, Owen): this icon-button
        // border deliberately reads darker than a subtle divider border for
        // more contrast against white. Kept as a literal, not merged.
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D0D3D9] bg-white text-workspace-text',
        'shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors',
        'hover:border-primary/45 hover:bg-workspace-active hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}