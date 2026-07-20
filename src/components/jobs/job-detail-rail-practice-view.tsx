'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useJobDetail } from '@/hooks/use-jobs';
import { cn } from '@/lib/utils';

interface JobDetailRailPracticeViewProps {
  jobId: string;
  className?: string;
  onStart: (ctx: { jobId: string; jobTitle?: string | null }) => void;
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
  const t = useTranslations('interview.irp.readiness');
  const { job } = useJobDetail(jobId);
  const [starting, setStarting] = useState(false);
  const title = job?.title?.trim() || null;

  return (
    <div className={cn('flex flex-col gap-4 px-4 py-3', className)}>
      <h3 className="text-base font-semibold text-kazi-navy">
        {t('practiceRailTitle')}
      </h3>
      {title ? (
        <p className="text-sm font-medium text-gray-800">{title}</p>
      ) : null}
      <p className="text-sm text-gray-600">{t('practiceRailHint')}</p>
      <Button
        size="sm"
        type="button"
        disabled={starting}
        onClick={() => {
          if (starting) return;
          setStarting(true);
          onStart({ jobId, jobTitle: title });
        }}
      >
        {starting ? t('practiceRailStarting') : t('practiceRailCta')}
      </Button>
    </div>
  );
}
