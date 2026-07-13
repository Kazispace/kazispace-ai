'use client';

import { useTranslations } from 'next-intl';

import { InterviewWorkspace } from '@/components/interview/interview-workspace';
import { useInterviewProfile } from '@/hooks/use-interview-profile';
import { cn } from '@/lib/utils';

interface JobSprintInterviewPanelProps {
  locale: string;
  className?: string;
}

/** Template-internal interview IRP panel (surfaces.ts → interview_irp). */
export function JobSprintInterviewPanel({ locale, className }: JobSprintInterviewPanelProps) {
  const t = useTranslations('spaces');
  const { irpEnabled } = useInterviewProfile({ enabled: true });

  return (
    <div className={cn('flex h-full flex-col overflow-y-auto bg-white', className)}>
      <div className="border-b border-gray-200/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-kazi-navy">{t('panelInterview')}</h2>
        <p className="text-xs text-gray-500">{t('interviewPanelHint')}</p>
      </div>
      <InterviewWorkspace locale={locale} showProfileLink={irpEnabled} />
    </div>
  );
}
