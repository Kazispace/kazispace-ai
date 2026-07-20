'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useJobDetail } from '@/hooks/use-jobs';
import { cn } from '@/lib/utils';

interface JobDetailRailPracticeViewProps {
  jobId: string;
  className?: string;
  onStart: (jobId: string) => void;
}

/**
 * In-rail confirm before leaving for the Interview workspace.
 * Mock interview is not runnable as a free-form Clinic/Space chat turn.
 */
export function JobDetailRailPracticeView({
  jobId,
  className,
  onStart,
}: JobDetailRailPracticeViewProps) {
  const t = useTranslations('interview.irp.practice');
  const { job, isLoading } = useJobDetail(jobId);
  const title = job?.title?.trim() || null;

  return (
    <div className={cn('flex flex-col gap-4 px-4 py-3', className)}>
      <h3 className="text-base font-semibold text-kazi-navy">{t('title')}</h3>
      {/* Reserve a line while job title loads to avoid layout jump. */}
      <p className="min-h-5 text-sm font-medium text-gray-800">
        {isLoading && !title ? (
          <span className="inline-block h-4 w-40 animate-pulse rounded bg-gray-100" />
        ) : (
          title
        )}
      </p>
      <p className="text-sm text-gray-600">{t('hint')}</p>
      <Button size="sm" type="button" onClick={() => onStart(jobId)}>
        {t('cta')}
      </Button>
    </div>
  );
}
