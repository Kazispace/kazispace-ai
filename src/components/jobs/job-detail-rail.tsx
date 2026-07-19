'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { JobDetailBody } from '@/components/jobs/job-detail-body';
import { cn } from '@/lib/utils';

interface JobDetailRailProps {
  jobId: string;
  locale: string;
  onClose: () => void;
  className?: string;
}

/** Right-rail job detail (desktop) / full overlay host (mobile via parent). */
export function JobDetailRail({
  jobId,
  locale,
  onClose,
  className,
}: JobDetailRailProps) {
  const router = useRouter();
  const t = useTranslations('jobs');

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col bg-white',
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-kazi-navy">
          {t('detailTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          aria-label={t('closeDetail')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <JobDetailBody
          jobId={jobId}
          locale={locale}
          density="rail"
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}
