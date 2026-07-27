'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { JobSprintCvPanel } from '@/components/spaces/panels/job-sprint-cv-panel';
import { cn } from '@/lib/utils';

interface CvWorkspaceRailProps {
  locale: string;
  jobId?: string | null;
  onClose: () => void;
  className?: string;
}

/** Right-rail CV preview / export — chat stays in Clinic or Space column. */
export function CvWorkspaceRail({
  locale,
  jobId,
  onClose,
  className,
}: CvWorkspaceRailProps) {
  const t = useTranslations('cv');

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-white', className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200/80 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1D2129]">{t('title')}</p>
          <p className="truncate text-xs text-[#86909C]">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4E5969] hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          aria-label={t('closeRail')}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <JobSprintCvPanel locale={locale} jobId={jobId} className="h-full" />
      </div>
    </div>
  );
}
