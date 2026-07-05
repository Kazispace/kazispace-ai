'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { useInterviewProfile } from '@/hooks/use-interview-profile';
import type { ReadinessTier } from '@/types';

interface IrpReadinessMiniCardProps {
  jobId: string;
  locale: string;
}

function tierTone(tier?: ReadinessTier | null) {
  switch (tier) {
    case 'dominant':
    case 'strong':
      return 'text-green-600';
    case 'competitive':
      return 'text-amber-600';
    case 'needs_prep':
      return 'text-orange-600';
    case 'large_gap':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function IrpReadinessMiniCard({ jobId, locale }: IrpReadinessMiniCardProps) {
  const t = useTranslations('interview.irp');
  // Mini card only runs readiness-check mutation; skip profile query fetch.
  const { checkReadiness, readinessResult, isReadinessLoading, readinessError } =
    useInterviewProfile({ enabled: false });

  useEffect(() => {
    void checkReadiness(jobId);
  }, [checkReadiness, jobId]);

  const score = readinessResult?.readiness_score_pct;
  const detailHref = `/${locale}/interview/readiness?job_id=${encodeURIComponent(jobId)}`;

  return (
    <Card className="border-kazi-orange/20 bg-orange-50/50">
      <CardContent className="p-4">
        {isReadinessLoading && (
          <p className="text-xs text-gray-600">{t('readiness.loading')}</p>
        )}
        {readinessError && (
          <p className="text-xs text-red-600">{readinessError}</p>
        )}
        {!isReadinessLoading && !readinessError && score != null && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {t('readiness.miniTitle')}
              </p>
              <p
                className={`text-xl font-bold tabular-nums ${tierTone(readinessResult?.readiness_tier)}`}
              >
                {score}%
              </p>
              {readinessResult?.readiness_tier && (
                <p className="text-[10px] text-gray-600">
                  {t(`readiness.tier.${readinessResult.readiness_tier}`)}
                </p>
              )}
            </div>
            <Link
              href={detailHref}
              className="text-xs font-medium text-kazi-orange whitespace-nowrap"
            >
              {t('readiness.viewDetails')} →
            </Link>
          </div>
        )}
        {!isReadinessLoading && !readinessError && score == null && readinessResult && (
          <p className="text-xs text-gray-600">{t('readiness.noProfile')}</p>
        )}
      </CardContent>
    </Card>
  );
}
