'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, Coins } from 'lucide-react';
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
const PRIMARY_ICON_STROKE = 2.75;

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

  const chipClass = (low: boolean) =>
    cn(
      'flex min-h-[3.25rem] w-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors',
      low
        ? 'border-orange-200 bg-gradient-to-b from-orange-50 to-white hover:border-orange-300'
        : 'border-[#E0E3E8] bg-white hover:border-kazi-orange/35 hover:bg-[#FFF9F5]'
    );

  if (!isLoggedIn) {
    return (
      <Link
        href={`/${locale}/login`}
        className={chipClass(false)}
        aria-label={t('creditsSignIn')}
        title={t('creditsSignIn')}
      >
        <Coins className="h-5 w-5 text-[#4E5969]" strokeWidth={PRIMARY_ICON_STROKE} aria-hidden />
        <span className="text-xs font-bold leading-none text-[#86909C]">—</span>
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
      {low ? (
        <AlertCircle
          className="h-4 w-4 shrink-0 text-red-500"
          strokeWidth={PRIMARY_ICON_STROKE}
          aria-hidden
        />
      ) : (
        <Coins
          className="h-5 w-5 shrink-0 text-kazi-orange"
          strokeWidth={PRIMARY_ICON_STROKE}
          aria-hidden
        />
      )}
      <span
        className={cn(
          'max-w-[2.75rem] truncate text-xs font-bold tabular-nums leading-none tracking-tight',
          low ? 'text-red-600' : 'text-kazi-orange'
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
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D0D3D9] bg-white text-[#1D2129]',
        'shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors',
        'hover:border-kazi-orange/45 hover:bg-[#FFF4EC] hover:text-kazi-orange',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { PRIMARY_ICON_STROKE };
