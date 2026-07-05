'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { clampPct } from '@/lib/interview-irp-utils';
import type { InterviewReadinessResult, ReadinessTier } from '@/types';

interface IrpReadinessPanelProps {
  result: InterviewReadinessResult;
  locale: string;
  jobId?: string | null;
  isPro?: boolean;
  onRetry?: () => void;
  isLoading?: boolean;
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

export function IrpReadinessPanel({
  result,
  locale,
  jobId,
  isPro = false,
  onRetry,
  isLoading,
}: IrpReadinessPanelProps) {
  const t = useTranslations('interview.irp');

  const score = clampPct(result.readiness_score_pct);
  const gaps = result.gap_analysis ?? [];
  const visibleGaps = isPro ? gaps : gaps.slice(0, 1);
  const lockedGapCount = isPro ? 0 : Math.max(0, gaps.length - visibleGaps.length);
  const freeRemaining = result.free_tier_remaining_today;
  const showFreeLimit = !isPro && freeRemaining === 0;

  if (score == null) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-3">
          <p className="text-sm text-gray-700">{t('readiness.noProfile')}</p>
          <Button asChild size="sm">
            <Link href={`/${locale}/interview`}>{t('readiness.startTraining')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-kazi-orange shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('readiness.title')}
            </p>
            <p className={`text-3xl font-bold tabular-nums ${tierTone(result.readiness_tier)}`}>
              {score}%
            </p>
            {result.readiness_tier && (
              <p className="text-sm text-gray-600 mt-1">
                {t(`readiness.tier.${result.readiness_tier}`)}
              </p>
            )}
          </div>
        </div>

        {result.disclaimer === 'provisional_profile' && (
          <p className="text-xs bg-amber-50 border border-amber-100 text-amber-800 rounded-lg p-3">
            {t('provisionalBannerShort')}
          </p>
        )}

        {visibleGaps.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {t('readiness.gapTitle')}
            </h3>
            <ul className="space-y-2">
              {visibleGaps.map((gap) => (
                <li
                  key={`${gap.dimension}-${gap.label}`}
                  className="text-sm bg-gray-50 border border-gray-100 rounded-lg p-3"
                >
                  <p className="font-medium text-kazi-navy">{gap.label}</p>
                  {gap.recommendation && (
                    <p className="text-xs text-gray-600 mt-1">{gap.recommendation}</p>
                  )}
                  {gap.impact_points != null && (
                    <p className="text-[10px] text-red-600 mt-1">
                      {t('readiness.impact', { points: gap.impact_points })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {lockedGapCount > 0 && (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
            {t('readiness.lockedGaps', { count: lockedGapCount })}
          </p>
        )}

        {showFreeLimit && (
          <div className="text-xs text-gray-600 bg-orange-50 border border-orange-100 rounded-lg p-3 space-y-2">
            <p>{t('readiness.freeLimit')}</p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/${locale}/subscription`}>{t('readiness.upgradePro')}</Link>
            </Button>
          </div>
        )}

        {isPro && result.recommended_training && result.recommended_training.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {t('readiness.trainingPlan')}
            </h3>
            <ul className="text-sm text-gray-700 list-disc pl-4 space-y-1">
              {result.recommended_training.map((item, i) => (
                <li key={`${item.type}-${i}`}>
                  {t('readiness.trainingItem', {
                    type: item.type,
                    rounds: item.rounds ?? 1,
                  })}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {jobId && (
            <Button size="sm" asChild>
              <Link href={`/${locale}/interview?job_id=${encodeURIComponent(jobId)}`}>
                {t('readiness.practiceForJob')}
              </Link>
            </Button>
          )}
          {onRetry && !showFreeLimit && (
            <Button size="sm" variant="outline" onClick={onRetry} disabled={isLoading}>
              {t('readiness.refresh')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
