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

/** Coze-style horizontal step pills. */
export function CvPipelineSteps({ pipelineState, isWorking }: CvPipelineStepsProps) {
  const t = useTranslations('cv');
  const currentStep = resolveCvPipelineStep(pipelineState);
  const currentIndex = cvPipelineStepIndex(currentStep);

  return (
    <ol
      className="flex items-center gap-1.5 overflow-x-auto max-w-full"
      aria-label={t('pipelineAria')}
    >
      {CV_PIPELINE_STEP_ORDER.map((stepId, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const showPulse = isCurrent && isWorking;

        return (
          <li key={stepId} className="flex items-center gap-1.5 shrink-0">
            {index > 0 ? (
              <span
                className={cn(
                  'w-4 h-px shrink-0',
                  isComplete ? 'bg-kazi-orange/60' : 'bg-workspace-border'
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                isComplete && 'bg-kazi-orange/10 text-kazi-orange',
                isCurrent && 'bg-kazi-orange text-white shadow-sm',
                !isComplete && !isCurrent && 'bg-workspace-hover text-workspace-muted',
                showPulse && 'animate-pulse'
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                  isComplete && 'bg-kazi-orange/20 text-kazi-orange',
                  isCurrent && !isComplete && 'bg-white/25 text-white',
                  !isComplete && !isCurrent && 'bg-workspace-border text-workspace-muted'
                )}
              >
                {isComplete ? '✓' : index + 1}
              </span>
              {t(STEP_I18N_KEY[stepId])}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
