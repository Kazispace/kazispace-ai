'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { AgentTransitionProvider } from '@/components/agent-transition/agent-transition-provider';
import { JobSprintCvPanel } from '@/components/spaces/panels/job-sprint-cv-panel';
import {
  WorkspaceSideRailHub,
} from '@/components/workspace/workspace-side-rail-hub';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import { primeSessionNavHandoff } from '@/lib/session-nav-handoff';
import { openAgentSessionTarget } from '@/lib/session-nav';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type CvRailView = 'hub' | 'cv';

interface CvWorkspaceRailProps {
  locale: string;
  jobId?: string | null;
  drillDown?: boolean;
  /** When false, always show CV panel (Space rail). Default true for Clinic. */
  hubEnabled?: boolean;
  onClose: () => void;
  className?: string;
  /** Agent transition context — Clinic rail defaults to `clinic`; Space rail uses `cv` + space return href. */
  transitionFromSurface?: AgentSurfaceId;
  transitionReturnHref?: string;
}

function resolveInitialView(
  jobId?: string | null,
  drillDown?: boolean,
  hubEnabled = true
): CvRailView {
  if (!hubEnabled || jobId?.trim() || drillDown) return 'cv';
  return 'hub';
}

/** Right-rail workspace hub + optional CV drill-down — chat stays in Clinic or Space column. */
export function CvWorkspaceRail({
  locale,
  jobId,
  drillDown = false,
  hubEnabled = true,
  onClose,
  className,
  transitionFromSurface = 'clinic',
  transitionReturnHref,
}: CvWorkspaceRailProps) {
  const t = useTranslations('cv');
  const tHub = useTranslations('cv.railHub');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const router = useRouter();
  const pathname = usePathname();

  const [view, setView] = useState<CvRailView>(() =>
    resolveInitialView(jobId, drillDown, hubEnabled)
  );

  useEffect(() => {
    if (!hubEnabled || jobId?.trim() || drillDown) {
      setView('cv');
    }
  }, [jobId, drillDown, hubEnabled]);

  const openCvDrillDown = useCallback(() => setView('cv'), []);
  const backToHub = useCallback(() => setView('hub'), []);

  const openCvSession = useCallback((sessionId: string) => {
    primeSessionNavHandoff(CV_BUILDER_AGENT_ID, sessionId);
    setView('cv');
  }, []);

  const handleHubNavigate = useCallback(
    (path: string) => {
      onClose();
      router.push(path);
    },
    [onClose, router]
  );

  const openAgentSession = useCallback(
    (agentId: string, sessionId: string) => {
      onClose();
      openAgentSessionTarget(router, pathname, locale, agentId, sessionId);
    },
    [locale, onClose, pathname, router]
  );

  // CV detail / Space rail: header always shown (hubEnabled=false still uses CV panel header).
  const showFullHeader = view !== 'hub' || !hubEnabled;

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-white', className)}>
      {showFullHeader ? (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200/80 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            {view === 'cv' && hubEnabled && !jobId?.trim() ? (
              <button
                type="button"
                onClick={backToHub}
                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4E5969] hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
                aria-label={tHub('backToHub')}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1D2129]">
                {t('title')}
              </p>
              <p className="truncate text-xs text-[#86909C]">
                {jobId?.trim()
                  ? t('subtitleWithJob', { jobId })
                  : t('subtitle')}
              </p>
            </div>
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
      ) : null}
      <div className="min-h-0 flex-1">
        {view === 'hub' ? (
          <WorkspaceSideRailHub
            locale={locale}
            showCloseButton
            onClose={onClose}
            onOpenCv={openCvDrillDown}
            onOpenCvSession={openCvSession}
            onOpenAgentSession={openAgentSession}
            onNavigate={handleHubNavigate}
          />
        ) : (
          <AgentTransitionProvider
            locale={locale}
            fromSurface={transitionFromSurface}
            hubAgentId={CV_BUILDER_AGENT_ID}
            isLoggedIn={isLoggedIn}
            returnToClinicHref={transitionReturnHref}
          >
            <JobSprintCvPanel locale={locale} jobId={jobId} className="h-full" />
          </AgentTransitionProvider>
        )}
      </div>
    </div>
  );
}
