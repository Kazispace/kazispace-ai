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

export function CvPipelineSteps({ pipelineState, isWorking }: CvPipelineStepsProps) {
  const t = useTranslations('cv');
  const currentStep = resolveCvPipelineStep(pipelineState);
  const currentIndex = cvPipelineStepIndex(currentStep);

  return (
    <div
      className="px-4 py-2 border-b border-gray-100 bg-white overflow-x-auto"
      aria-label={t('pipelineAria')}
    >
      <ol className="flex items-center gap-1 min-w-max">
        {CV_PIPELINE_STEP_ORDER.map((stepId, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const showPulse = isCurrent && isWorking;

          return (
            <li
              key={stepId}
              className="flex items-center gap-1"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {index > 0 && (
                <span
                  className={cn(
                    'w-4 h-px shrink-0',
                    isComplete ? 'bg-kazi-orange' : 'bg-gray-200'
                  )}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors',
                  isComplete && 'text-kazi-orange',
                  isCurrent && 'bg-orange-50 text-kazi-orange',
                  !isComplete && !isCurrent && 'text-gray-400'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    isComplete && 'bg-kazi-orange text-white',
                    isCurrent && !isComplete && 'border-2 border-kazi-orange text-kazi-orange',
                    !isComplete && !isCurrent && 'border border-gray-300 text-gray-400',
                    showPulse && 'animate-pulse'
                  )}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                <span className="whitespace-nowrap">{t(STEP_I18N_KEY[stepId])}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
