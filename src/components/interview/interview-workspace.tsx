'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';

import { IrpGrowthHistory } from '@/components/interview/irp-growth-history';
import { IrpProfileHome } from '@/components/interview/irp-profile-home';
import { JobDetailRailReadinessView } from '@/components/jobs/job-detail-rail-readiness-view';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/hooks/use-billing';
import {
  useInterviewProfile,
  useInterviewProfileHistory,
} from '@/hooks/use-interview-profile';
import { isProPlan } from '@/lib/api-mappers';
import { IRP_PROFILE_ENABLED } from '@/lib/constants';
import { cn } from '@/lib/utils';

type WorkspaceView = 'menu' | 'profile' | 'growth' | 'readiness';

interface InterviewWorkspaceProps {
  locale: string;
  showProfileLink?: boolean;
  /** When set, "Practice" from readiness stays in the interview chat column. */
  onPracticeInChat?: (ctx: { jobId: string; jobTitle?: string | null }) => void;
}

/** §19.3.1 / §19.4 — IRP history entry as in-panel views (no deep page hops). */
export function InterviewWorkspace({
  locale,
  showProfileLink = false,
  onPracticeInChat,
}: InterviewWorkspaceProps) {
  const t = useTranslations('interview');
  const tIrp = useTranslations('interview.irp');
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get('job_id');
  const [view, setView] = useState<WorkspaceView>('menu');

  const viewTitle =
    view === 'profile'
      ? t('viewProfile')
      : view === 'growth'
        ? t('viewHistory')
        : view === 'readiness'
          ? t('viewReadiness')
          : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {view !== 'menu' ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-2">
          <button
            type="button"
            onClick={() => setView('menu')}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-kazi-orange hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t('workspaceTitle')}
          </button>
          {viewTitle ? (
            <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-kazi-navy">
              {viewTitle}
            </h2>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'menu' ? (
          <WorkspaceMenu
            locale={locale}
            showProfileLink={showProfileLink}
            onOpen={setView}
          />
        ) : null}
        {view === 'profile' ? (
          <WorkspaceProfilePane
            locale={locale}
            onBackToChat={() => setView('menu')}
            onOpenGrowth={() => setView('growth')}
            onOpenReadiness={() => setView('readiness')}
          />
        ) : null}
        {view === 'growth' ? <WorkspaceGrowthPane /> : null}
        {view === 'readiness' ? (
          jobIdFromUrl ? (
            <JobDetailRailReadinessView
              jobId={jobIdFromUrl}
              locale={locale}
              onPracticeForJob={onPracticeInChat}
            />
          ) : (
            <div className="space-y-3 p-4">
              <p className="text-sm text-gray-600">{tIrp('readiness.jobRequired')}</p>
              <Button size="sm" type="button" onClick={() => setView('menu')}>
                {t('workspaceTitle')}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceMenu({
  locale,
  showProfileLink,
  onOpen,
}: {
  locale: string;
  showProfileLink: boolean;
  onOpen: (view: WorkspaceView) => void;
}) {
  const t = useTranslations('interview');

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-kazi-navy">{t('workspaceTitle')}</h3>
      <p className="text-xs text-gray-500">{t('workspaceHint')}</p>
      <nav className="flex flex-col gap-2">
        {showProfileLink ? (
          <button
            type="button"
            onClick={() => onOpen('profile')}
            className="text-left text-sm text-kazi-orange hover:underline"
          >
            {t('viewProfile')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onOpen('growth')}
          className="text-left text-sm text-kazi-orange hover:underline"
        >
          {t('viewHistory')}
        </button>
        <button
          type="button"
          onClick={() => onOpen('readiness')}
          className="text-left text-sm text-kazi-orange hover:underline"
        >
          {t('viewReadiness')}
        </button>
        <p className="pt-2 text-xs text-gray-400">
          {/* Keep /mine as the only external hop from this panel — user profile home. */}
          <a
            href={`/${locale}/mine`}
            className="text-gray-600 hover:underline"
          >
            {t('backToMine')}
          </a>
        </p>
      </nav>
    </div>
  );
}

function WorkspaceProfilePane({
  locale,
  onBackToChat,
  onOpenGrowth,
  onOpenReadiness,
}: {
  locale: string;
  onBackToChat: () => void;
  onOpenGrowth: () => void;
  onOpenReadiness: () => void;
}) {
  const t = useTranslations('interview.irp');
  const { profile, isProfileLoading, profileError, refetchProfile } =
    useInterviewProfile({ enabled: IRP_PROFILE_ENABLED });
  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  if (!IRP_PROFILE_ENABLED) {
    return (
      <p className="p-4 text-sm text-gray-600">{t('featureDisabled')}</p>
    );
  }

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-kazi-orange" />
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <p className="text-sm text-red-600">{profileError}</p>
        <Button size="sm" onClick={() => void refetchProfile()}>
          {t('profileRetry')}
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-600">{t('readiness.noProfile')}</p>
        <Button size="sm" type="button" onClick={onBackToChat}>
          {t('readiness.startTraining')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('pb-4')}>
      <IrpProfileHome
        profile={profile}
        locale={locale}
        isPro={isProUser}
        onStartTraining={onBackToChat}
        onCtaAction={(cta) => {
          if (cta.cta_type === 'growth_history') onOpenGrowth();
          else if (cta.cta_type === 'readiness_check') onOpenReadiness();
          else onBackToChat();
        }}
      />
    </div>
  );
}

function WorkspaceGrowthPane() {
  const t = useTranslations('interview.irp');
  const { history, isHistoryLoading, historyError, refetchHistory } =
    useInterviewProfileHistory({ enabled: IRP_PROFILE_ENABLED });
  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  if (!IRP_PROFILE_ENABLED) {
    return (
      <p className="p-4 text-sm text-gray-600">{t('featureDisabled')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-sm font-semibold text-kazi-navy">
          {t('growth.pageTitle')}
        </h3>
        <p className="text-xs text-gray-500">{t('growth.subtitle')}</p>
      </div>

      {isHistoryLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-kazi-orange" />
        </div>
      ) : null}

      {historyError && !isHistoryLoading ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-600">{historyError}</p>
          <Button size="sm" onClick={() => void refetchHistory()}>
            {t('growth.retry')}
          </Button>
        </div>
      ) : null}

      {history && !isHistoryLoading && !historyError ? (
        <IrpGrowthHistory
          items={history.items}
          badges={history.badges}
          isPro={isProUser}
        />
      ) : null}
    </div>
  );
}
