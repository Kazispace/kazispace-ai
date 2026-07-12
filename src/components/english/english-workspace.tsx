'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface EnglishWorkspaceProps {
  locale: string;
}

export function EnglishWorkspace({ locale }: EnglishWorkspaceProps) {
  const t = useTranslations('english');

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-kazi-navy">{t('workspaceTitle')}</h3>
      <p className="text-xs text-gray-500">{t('workspaceHint')}</p>
      <nav className="flex flex-col gap-2">
        <Link
          href={`/${locale}/english/passport`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('quickActions.passport')}
        </Link>
        <Link
          href={`/${locale}/english/assessment`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('quickActions.assessment')}
        </Link>
        <Link
          href={`/${locale}/english/training?scenario=${encodeURIComponent(
            'workplace_oral_interview_intro_v1'
          )}`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('quickActions.training')}
        </Link>
        <Link
          href={`/${locale}/english/growth`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('passport.cta.viewHistory')}
        </Link>
      </nav>
    </div>
  );
}
