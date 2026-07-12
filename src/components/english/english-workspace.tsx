'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface EnglishWorkspaceProps {
  locale: string;
}

/** Secondary EPP tools — chips below composer cover the top quick actions. */
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
          {t('workspaceLinks.passportDetail')}
        </Link>
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
