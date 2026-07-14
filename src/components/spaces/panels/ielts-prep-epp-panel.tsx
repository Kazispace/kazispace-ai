'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { EppPassportHome } from '@/components/english/epp-passport-home';
import { EppPassportSkeleton } from '@/components/english/epp-passport-skeleton';
import { EppSampleJobsPanel } from '@/components/english/epp-sample-jobs-panel';
import { Button } from '@/components/ui/button';
import {
  useEnglishProfile,
  useEnglishSampleJobs,
} from '@/hooks/use-english-profile';
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

  const {
    profile,
    profileStatus,
    isProfileLoading,
    profileError,
    refetchProfile,
  } = useEnglishProfile({ enabled: EPP_PROFILE_ENABLED && isLoggedIn });

  const showPassport =
    profile != null &&
    (profileStatus === 'ready' || profileStatus === 'active');

  const { sampleJobs } = useEnglishSampleJobs(profile?.display_level, {
    enabled: EPP_PROFILE_ENABLED && isLoggedIn && showPassport,
  });

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
      <div className="shrink-0 border-b border-gray-200/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-kazi-navy">{t('panelEnglish')}</h2>
        <p className="text-xs text-gray-500">{t('eppPanelHint')}</p>
      </div>

      {isProfileLoading ? <EppPassportSkeleton /> : null}

      {!isProfileLoading && profileError && !profile ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-red-600">{profileError}</p>
          <Button size="sm" onClick={() => void refetchProfile()}>
            {tEnglish('retry')}
          </Button>
        </div>
      ) : null}

      {!isProfileLoading && !profileError && (profileStatus === 'empty' || !profile) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-gray-700">{t('eppPanelEmpty')}</p>
          <Button size="sm" asChild>
            <Link href={`/${locale}/english/onboarding`}>{t('eppPanelEmptyCta')}</Link>
          </Button>
        </div>
      ) : null}

      {showPassport && profile ? (
        <>
          <EppPassportHome
            profile={profile}
            locale={locale}
            showBackToClinic={false}
          />
          {sampleJobs ? (
            <div id="sample-jobs" className="scroll-mt-4 px-4 pb-4">
              <EppSampleJobsPanel sampleJobs={sampleJobs} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
