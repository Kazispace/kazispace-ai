'use client';

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

interface SessionIconRailCreditsProps {
  locale: string;
}

export function SessionIconRailCredits({ locale }: SessionIconRailCreditsProps) {
  const t = useTranslations('sessionNav');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { balance, isLoading } = useBilling();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/${locale}/login`}
        className="flex w-10 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[#86909C] hover:bg-[#F2F3F5]"
        aria-label={t('creditsSignIn')}
        title={t('creditsSignIn')}
      >
        <Coins className="h-4 w-4" aria-hidden />
        <span className="text-[9px] font-medium leading-none">—</span>
      </Link>
    );
  }

  const total = creditRailTotal(balance);
  const low = isCreditRailLow(balance);
  const label = isLoading ? '…' : formatCreditRailAmount(total);

  return (
    <Link
      href={`/${locale}/credits`}
      className={cn(
        'flex w-10 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors hover:bg-[#F2F3F5]',
        low ? 'text-red-600' : 'text-emerald-600'
      )}
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
      <Coins className="h-4 w-4 shrink-0" aria-hidden />
      <span
        className={cn(
          'max-w-[2.5rem] truncate text-[9px] font-semibold tabular-nums leading-none',
          low ? 'text-red-600' : 'text-emerald-700'
        )}
      >
        {label}
      </span>
    </Link>
  );
}
