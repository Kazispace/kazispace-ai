'use client';

import { type ReactNode, useEffect } from 'react';

import { JobDetailRail } from '@/components/jobs/job-detail-rail';
import { cn } from '@/lib/utils';

interface JobDetailRailHostProps {
  jobId: string | null;
  locale: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Chat column + optional job detail rail.
 * Desktop: right aside (~480px). Mobile: full-screen overlay.
 */
export function JobDetailRailHost({
  jobId,
  locale,
  onClose,
  children,
  className,
}: JobDetailRailHostProps) {
  useEffect(() => {
    if (!jobId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jobId, onClose]);

  return (
    <div className={cn('relative flex min-h-0 flex-1', className)}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>

      {jobId ? (
        <>
          <aside
            className={cn(
              'hidden min-h-0 w-[min(480px,40vw)] shrink-0 flex-col',
              'border-l border-gray-200/80 bg-white lg:flex',
              'animate-in fade-in slide-in-from-right-4 duration-200'
            )}
          >
            <JobDetailRail
              jobId={jobId}
              locale={locale}
              onClose={onClose}
            />
          </aside>
          <div
            className={cn(
              'absolute inset-0 z-30 flex flex-col bg-white lg:hidden',
              'animate-in fade-in slide-in-from-right duration-200'
            )}
          >
            <JobDetailRail
              jobId={jobId}
              locale={locale}
              onClose={onClose}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
