'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface InterviewWorkspaceProps {
  locale: string;
}

/** §19.3.1 / §19.4 — IRP history entry (B: workspace attachment). */
export function InterviewWorkspace({ locale }: InterviewWorkspaceProps) {
  const t = useTranslations('interview');

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-kazi-navy">{t('workspaceTitle')}</h3>
      <p className="text-xs text-gray-500">{t('workspaceHint')}</p>
      <nav className="flex flex-col gap-2">
        <Link
          href={`/${locale}/interview/growth`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('viewHistory')}
        </Link>
        <Link
          href={`/${locale}/interview/readiness`}
          className="text-sm text-kazi-orange hover:underline"
        >
          {t('viewReadiness')}
        </Link>
        <Link href={`/${locale}/mine`} className="text-sm text-gray-600 hover:underline">
          {t('backToMine')}
        </Link>
      </nav>
    </div>
  );
}
