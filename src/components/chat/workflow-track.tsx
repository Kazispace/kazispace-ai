'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

import { resolveLocalizedLabel } from '@/lib/chat-envelope';
import { cn } from '@/lib/utils';
import type { AssistantWorkflow } from '@/types/chat-envelope';

interface WorkflowTrackProps {
  workflow: AssistantWorkflow;
  locale: string;
  className?: string;
}

export function WorkflowTrack({ workflow, locale, className }: WorkflowTrackProps) {
  const t = useTranslations('workflow');
  const steps = workflow.steps.filter((s) => s.status !== 'skipped');

  if (steps.length === 0) return null;

  const current = steps.find((s) => s.status === 'current');
  const currentDetail = current
    ? resolveLocalizedLabel(current.detail, locale)
    : '';

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white px-3 py-2.5 max-w-xl',
        className
      )}
      aria-label={t('trackAria')}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          {t('progressLabel')}
        </span>
        {typeof workflow.progress_pct === 'number' ? (
          <span className="text-[11px] tabular-nums text-gray-400">
            {workflow.progress_pct}%
          </span>
        ) : null}
      </div>

      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const label = resolveLocalizedLabel(step.label, locale, step.id);
          const isDone = step.status === 'done';
          const isCurrent = step.status === 'current';

          return (
            <li key={step.id} className="flex items-center gap-1.5 min-w-0">
              {index > 0 ? (
                <span className="text-gray-300 text-[10px]" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border',
                  isCurrent &&
                    'border-kazi-orange bg-orange-50 text-kazi-orange',
                  isDone && 'border-green-200 bg-green-50 text-green-700',
                  !isCurrent && !isDone && 'border-gray-200 bg-gray-50 text-gray-400'
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <span className="w-3 text-center tabular-nums shrink-0">
                    {index + 1}
                  </span>
                )}
                <span className="truncate max-w-[7rem] sm:max-w-[9rem]">{label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {currentDetail ? (
        <p className="mt-2 text-xs text-gray-600">{currentDetail}</p>
      ) : null}

      {typeof workflow.progress_pct === 'number' ? (
        <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-kazi-orange transition-all duration-300"
            style={{ width: `${workflow.progress_pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
