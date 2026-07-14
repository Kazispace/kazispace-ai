'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { IrpReadinessPanel } from '@/components/interview/irp-readiness-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBilling } from '@/hooks/use-billing';
import { useInterviewReadiness } from '@/hooks/use-interview-profile';
import { isProPlan } from '@/lib/api-mappers';
import { IRP_PROFILE_ENABLED } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface JobSprintInterviewPanelProps {
  locale: string;
  jobId?: string | null;
  className?: string;
}

/** Template-internal interview IRP panel (surfaces.ts → interview_irp). */
export function JobSprintInterviewPanel({
  locale,
  jobId,
  className,
}: JobSprintInterviewPanelProps) {
  const t = useTranslations('spaces');
  const tIrp = useTranslations('interview.irp');
  const resolvedJobId = jobId?.trim() || null;

  const {
    readinessResult,
    isReadinessLoading,
    readinessError,
    isReadinessLimitError,
    refetchReadiness,
  } = useInterviewReadiness(resolvedJobId, {
    enabled: IRP_PROFILE_ENABLED,
    source: 'interview_prep',
  });

  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  return (
    <div className={cn('flex h-full flex-col overflow-y-auto bg-white', className)}>
      <div className="border-b border-gray-200/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-kazi-navy">{t('panelInterview')}</h2>
        <p className="text-xs text-gray-500">{t('interviewPanelHint')}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {!IRP_PROFILE_ENABLED ? (
          <p className="text-sm text-gray-600">{tIrp('featureDisabled')}</p>
        ) : null}

        {IRP_PROFILE_ENABLED && !resolvedJobId ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center space-y-3">
            <p className="text-sm text-gray-700">{tIrp('readiness.jobRequired')}</p>
            <Button size="sm" asChild>
              <Link href={`/${locale}/jobs`}>{tIrp('cta.viewJobs')}</Link>
            </Button>
          </div>
        ) : null}

        {IRP_PROFILE_ENABLED && resolvedJobId && isReadinessLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-kazi-orange" />
          </div>
        ) : null}

        {IRP_PROFILE_ENABLED &&
        resolvedJobId &&
        readinessError &&
        !isReadinessLoading &&
        isReadinessLimitError ? (
          <Card>
            <CardContent className="space-y-3 p-5 text-center">
              <p className="text-sm text-gray-700">{tIrp('readiness.freeLimitBlocked')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" asChild>
                  <Link href={`/${locale}/subscription`}>{tIrp('readiness.upgradePro')}</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/${locale}/jobs`}>{tIrp('cta.viewJobs')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {IRP_PROFILE_ENABLED &&
        resolvedJobId &&
        readinessError &&
        !isReadinessLoading &&
        !isReadinessLimitError ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center space-y-3">
            <p className="text-sm text-red-600">{readinessError}</p>
            <Button
              size="sm"
              onClick={() => void refetchReadiness()}
              disabled={isReadinessLoading}
            >
              {tIrp('readiness.retry')}
            </Button>
          </div>
        ) : null}

        {IRP_PROFILE_ENABLED &&
        resolvedJobId &&
        readinessResult &&
        !isReadinessLoading ? (
          <IrpReadinessPanel
            result={readinessResult}
            locale={locale}
            jobId={resolvedJobId}
            onRetry={() => void refetchReadiness()}
            isLoading={isReadinessLoading}
            isPro={isProUser}
          />
        ) : null}
      </div>
    </div>
  );
}
