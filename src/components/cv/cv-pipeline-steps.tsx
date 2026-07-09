'use client';

import { useTranslations } from 'next-intl';

import {
  CV_PIPELINE_STEP_ORDER,
  cvPipelineStepIndex,
  resolveCvPipelineStep,
  type CvPipelineStepId,
} from '@/lib/cv-pipeline';
import { cn } from '@/lib/utils';

interface CvPipelineStepsProps {
  pipelineState?: string | null;
  isWorking?: boolean;
}

const STEP_I18N_KEY: Record<CvPipelineStepId, string> = {
  intake: 'stepIntake',
  analyze: 'stepAnalyze',
  generate: 'stepGenerate',
  review: 'stepReview',
  done: 'stepDone',
};

/** Compact status strip — Cursor status-bar style. */
export function CvPipelineSteps({ pipelineState, isWorking }: CvPipelineStepsProps) {
  const t = useTranslations('cv');
  const currentStep = resolveCvPipelineStep(pipelineState);
  const currentIndex = cvPipelineStepIndex(currentStep);

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto max-w-full"
      aria-label={t('pipelineAria')}
    >
      {CV_PIPELINE_STEP_ORDER.map((stepId, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const showPulse = isCurrent && isWorking;

        return (
          <span key={stepId} className="flex items-center gap-0.5 shrink-0">
            {index > 0 ? (
              <span className="text-workspace-muted/40 text-[10px]" aria-hidden>
                ›
              </span>
            ) : null}
            <span
              className={cn(
                'text-[10px] whitespace-nowrap transition-colors',
                isComplete && 'text-workspace-muted',
                isCurrent && 'text-workspace-accent',
                !isComplete && !isCurrent && 'text-workspace-muted/50',
                showPulse && 'animate-pulse'
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {t(STEP_I18N_KEY[stepId])}
            </span>
          </span>
        );
      })}
    </div>
  );
}
