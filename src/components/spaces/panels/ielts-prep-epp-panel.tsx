'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { EnglishWorkspace } from '@/components/english/english-workspace';
import { Button } from '@/components/ui/button';
import { EPP_PROFILE_ENABLED } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

interface IeltsPrepEppPanelProps {
  locale: string;
  className?: string;
}

/** Template-internal EPP panel (surfaces.ts → english_epp). */
export function IeltsPrepEppPanel({ locale, className }: IeltsPrepEppPanelProps) {
  const router = useRouter();
  const t = useTranslations('spaces');
  const tEnglish = useTranslations('english');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center gap-3 bg-white p-6 text-center',
          className
        )}
      >
        <p className="text-sm text-gray-600">{tEnglish('featureDisabled')}</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center gap-3 bg-white p-6 text-center',
          className
        )}
      >
        <p className="text-sm text-gray-600">{tEnglish('loginBanner')}</p>
        <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
          {tEnglish('signIn')}
        </Button>
        <p className="text-xs text-gray-500">{t('eppPanelHint')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-y-auto bg-white', className)}>
      <EnglishWorkspace locale={locale} />
    </div>
  );
}
