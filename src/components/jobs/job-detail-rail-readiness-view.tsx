'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { IrpReadinessPanel } from '@/components/interview/irp-readiness-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { JobPracticeContext } from '@/types/jobs';
import { useBilling } from '@/hooks/use-billing';
import { useInterviewReadiness } from '@/hooks/use-interview-profile';
import { useJobDetail } from '@/hooks/use-jobs';
import { isProPlan } from '@/lib/api-mappers';
import { IRP_PROFILE_ENABLED } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface JobDetailRailReadinessViewProps {
  jobId: string;
  locale: string;
  className?: string;
  /** Keep rail open; host sends FE-built practice prompt in the chat column. */
  onPracticeForJob?: (ctx: JobPracticeContext) => void;
  practiceDisabled?: boolean;
}

/** Compact interview-readiness body for the job detail rail (no page chrome). */
export function JobDetailRailReadinessView({
  jobId,
  locale,
  className,
  onPracticeForJob,
  practiceDisabled = false,
}: JobDetailRailReadinessViewProps) {
  const t = useTranslations('interview.irp');
  const { job } = useJobDetail(jobId);
  const {
    readinessResult,
    isReadinessLoading,
    readinessError,
    isReadinessLimitError,
    refetchReadiness,
  } = useInterviewReadiness(jobId, {
    enabled: IRP_PROFILE_ENABLED,
    source: 'job_search_detail',
  });
  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  if (!IRP_PROFILE_ENABLED) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6', className)}>
        <p className="text-sm text-gray-600">{t('featureDisabled')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4 px-4 py-3', className)}>
      <h3 className="text-base font-semibold text-kazi-navy">
        {t('readiness.pageTitle')}
      </h3>

      {isReadinessLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        </div>
      )}

      {readinessError && !isReadinessLoading && isReadinessLimitError && (
        <Card>
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm text-gray-700">{t('readiness.freeLimitBlocked')}</p>
            <Button size="sm" asChild>
              <Link href={`/${locale}/subscription`}>{t('readiness.upgradePro')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {readinessError && !isReadinessLoading && !isReadinessLimitError && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 text-center">
          <p className="text-sm text-red-600">
            {typeof readinessError === 'string'
              ? readinessError
              : t('readiness.retry')}
          </p>
          <Button
            size="sm"
            onClick={() => void refetchReadiness()}
            disabled={isReadinessLoading}
          >
            {t('readiness.retry')}
          </Button>
        </div>
      )}

      {readinessResult && !isReadinessLoading && (
        <IrpReadinessPanel
          result={readinessResult}
          locale={locale}
          jobId={jobId}
          jobTitle={job?.title ?? null}
          onRetry={() => void refetchReadiness()}
          isLoading={isReadinessLoading}
          isPro={isProUser}
          onPracticeForJob={onPracticeForJob}
          practiceDisabled={practiceDisabled}
        />
      )}
    </div>
  );
}
