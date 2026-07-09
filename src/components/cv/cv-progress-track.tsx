'use client';

import { useTranslations } from 'next-intl';

import {
  CV_PIPELINE_STEP_ORDER,
  cvPipelineStepIndex,
  resolveCvPipelineStep,
  type CvPipelineStepId,
} from '@/lib/cv-pipeline';
import { cn } from '@/lib/utils';

const STEP_I18N_KEY: Record<CvPipelineStepId, string> = {
  intake: 'stepIntake',
  analyze: 'stepAnalyze',
  generate: 'stepGenerate',
  review: 'stepReview',
  done: 'stepDone',
};

interface CvProgressTrackProps {
  pipelineState?: string | null;
  isWorking?: boolean;
  className?: string;
}

export function CvProgressTrack({
  pipelineState,
  isWorking,
  className,
}: CvProgressTrackProps) {
  const t = useTranslations('cv');
  const step = resolveCvPipelineStep(pipelineState);
  const index = cvPipelineStepIndex(step);
  const total = CV_PIPELINE_STEP_ORDER.length - 1;
  const pct = Math.round((index / total) * 100);

  return (
    <div className={cn('flex flex-col gap-1.5 min-w-[140px]', className)} aria-label={t('pipelineAria')}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className={cn('text-white/70 truncate', isWorking && 'text-white')}>
          {t(STEP_I18N_KEY[step])}
        </span>
        <span className="text-white/40 tabular-nums shrink-0">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full bg-kazi-orange transition-all duration-500 ease-out',
            isWorking && 'animate-pulse'
          )}
          style={{ width: `${Math.max(pct, 8)}%` }}
        />
      </div>
    </div>
  );
}
