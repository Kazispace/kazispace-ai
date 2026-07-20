'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { JobDetailBody } from '@/components/jobs/job-detail-body';
import { JobDetailRailExternalView } from '@/components/jobs/job-detail-rail-external-view';
import { JobDetailRailPracticeView } from '@/components/jobs/job-detail-rail-practice-view';
import { JobDetailRailReadinessView } from '@/components/jobs/job-detail-rail-readiness-view';
import { cn } from '@/lib/utils';

type RailView =
  | { kind: 'detail' }
  | { kind: 'readiness'; jobId: string }
  | { kind: 'practice'; jobId: string }
  | { kind: 'external'; url: string; titleKey: 'apply' | 'detailTitle' };

interface JobDetailRailProps {
  jobId: string;
  locale: string;
  onClose: () => void;
  className?: string;
  /** Open Interview workspace for this job (`/interview?job_id=`). */
  onPracticeForJob?: (jobId: string) => void;
}

function createDetailView(): RailView {
  return { kind: 'detail' };
}

/** Right-rail job detail with in-panel back/forward history. */
export function JobDetailRail({
  jobId,
  locale,
  onClose,
  className,
  onPracticeForJob,
}: JobDetailRailProps) {
  const router = useRouter();
  const t = useTranslations('jobs');
  const [stack, setStack] = useState<RailView[]>(() => [createDetailView()]);
  const [index, setIndex] = useState(0);

  // New job → reset history.
  useEffect(() => {
    setStack([createDetailView()]);
    setIndex(0);
  }, [jobId]);

  const current = stack[index] ?? createDetailView();
  const canGoBack = index > 0;
  const canGoForward = index < stack.length - 1;

  const pushView = useCallback((view: RailView) => {
    setStack((prev) => [...prev.slice(0, index + 1), view]);
    setIndex(index + 1);
  }, [index]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goForward = useCallback(() => {
    setIndex((i) => Math.min(stack.length - 1, i + 1));
  }, [stack.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goBack();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBack, goForward]);

  const handleNavigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const handleOpenReadiness = useCallback(() => {
    pushView({ kind: 'readiness', jobId });
  }, [jobId, pushView]);

  const handleOpenPractice = useCallback(() => {
    pushView({ kind: 'practice', jobId });
  }, [jobId, pushView]);

  const handleOpenExternal = useCallback(
    (url: string) => {
      pushView({ kind: 'external', url, titleKey: 'apply' });
    },
    [pushView]
  );

  const title =
    current.kind === 'detail'
      ? t('detailTitle')
      : current.kind === 'readiness'
        ? t('cta.assess_readiness')
        : current.kind === 'practice'
          ? t('cta.start_interview')
          : t(current.titleKey);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col bg-white',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-2.5">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          aria-label={t('navBack')}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={!canGoForward}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          aria-label={t('navForward')}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-kazi-navy">
          {title}
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

      <div
        key={`${current.kind}-${index}`}
        className="min-h-0 flex-1 overflow-y-auto animate-in fade-in duration-150"
      >
        {current.kind === 'detail' ? (
          <JobDetailBody
            jobId={jobId}
            locale={locale}
            density="rail"
            onNavigate={handleNavigate}
            onOpenReadiness={handleOpenReadiness}
            onOpenExternal={handleOpenExternal}
          />
        ) : null}
        {current.kind === 'readiness' ? (
          <JobDetailRailReadinessView
            jobId={current.jobId}
            locale={locale}
            onPracticeForJob={
              onPracticeForJob ? handleOpenPractice : undefined
            }
          />
        ) : null}
        {current.kind === 'practice' && onPracticeForJob ? (
          <JobDetailRailPracticeView
            jobId={current.jobId}
            onStart={onPracticeForJob}
          />
        ) : null}
        {current.kind === 'external' ? (
          <JobDetailRailExternalView url={current.url} />
        ) : null}
      </div>
    </div>
  );
}
