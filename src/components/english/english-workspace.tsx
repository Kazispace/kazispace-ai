'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { EPP_PROFILE_ENABLED } from '@/lib/constants';
import { englishWorkspaceShowsOnboarding } from '@/lib/english-profile-routes';
import { useEnglishProfile } from '@/hooks/use-english-profile';

interface EnglishWorkspaceProps {
  locale: string;
}

/** Secondary EPP tools — chips below composer cover the top quick actions. */
export function EnglishWorkspace({ locale }: EnglishWorkspaceProps) {
  const t = useTranslations('english');
  const { profileStatus, isProfileLoading } = useEnglishProfile({
    enabled: EPP_PROFILE_ENABLED,
  });

  const showOnboardingLink = englishWorkspaceShowsOnboarding({
    isProfileLoading,
    profileStatus,
  });

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-kazi-navy">{t('workspaceTitle')}</h3>
      <p className="text-xs text-gray-500">{t('workspaceHint')}</p>
      <nav className="flex flex-col gap-2">
        <Link
          href={`/${locale}/english/passport`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('workspaceLinks.passportDetail')}
        </Link>
        {showOnboardingLink ? (
          <Link
            href={`/${locale}/english/onboarding`}
            className="text-sm text-kazi-orange hover:underline"
          >
            {t('workspaceLinks.onboarding')}
          </Link>
        ) : null}
        <Link
          href={`/${locale}/english/passport#sample-jobs`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('workspaceLinks.sampleJobs')}
        </Link>
        <Link
          href={`/${locale}/english/growth`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('workspaceLinks.growth')}
        </Link>
      </nav>
    </div>
  );
}
