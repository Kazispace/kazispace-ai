'use client';

import type { ReactNode } from 'react';
import {
  Briefcase,
  FileText,
  Gauge,
  Languages,
  LayoutGrid,
  Mic,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAgentSessionList } from '@/hooks/use-agent-session-list';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export type WorkspaceSideRailHubAction =
  | 'cv'
  | 'interview'
  | 'english'
  | 'jobs';

interface WorkspaceSideRailHubProps {
  locale: string;
  className?: string;
  onOpenCv?: () => void;
  onOpenCvSession?: (sessionId: string) => void;
  onOpenAgentSession?: (agentId: string, sessionId: string) => void;
  onNavigate?: (path: string) => void;
}

/** Dense vertical asset hub — zones stacked; each asset is a compact icon link. */
export function WorkspaceSideRailHub({
  locale,
  className,
  onOpenCv,
  onOpenCvSession,
  onOpenAgentSession,
  onNavigate,
}: WorkspaceSideRailHubProps) {
  const t = useTranslations('cv.railHub');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const { sessions: cvSessions, isLoading: cvLoading } = useAgentSessionList(
    CV_BUILDER_AGENT_ID,
    isLoggedIn
  );
  const { sessions: interviewSessions } = useAgentSessionList(
    MOCK_INTERVIEW_AGENT_ID,
    isLoggedIn
  );
  const { sessions: englishSessions } = useAgentSessionList(
    ENGLISH_TUTOR_AGENT_ID,
    isLoggedIn
  );

  const push = (path: string) => onNavigate?.(path);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-y-auto text-[#1D2129]',
        className
      )}
    >
      <ZoneBlock title={t('zoneCareer')}>
        <AssetIcon
          icon={Plus}
          label={t('assetNewResume')}
          onClick={() => onOpenCv?.()}
        />
        {cvLoading ? (
          <AssetSkeleton />
        ) : (
          cvSessions.map((session, index) => (
            <AssetIcon
              key={session.session_id}
              icon={FileText}
              label={formatResumeLabel(session.title, index, t)}
              onClick={() => onOpenCvSession?.(session.session_id)}
            />
          ))
        )}
        <AssetIcon
          icon={Gauge}
          label={t('assetReadiness')}
          onClick={() => push(`/${locale}/interview/readiness`)}
        />
        <AssetIcon
          icon={Mic}
          label={t('tileInterview')}
          onClick={() => push(`/${locale}/interview`)}
        />
        <AssetIcon
          icon={Languages}
          label={t('tileEnglish')}
          onClick={() => push(`/${locale}/english`)}
        />
        {interviewSessions.slice(0, 8).map((session, index) => (
          <AssetIcon
            key={session.session_id}
            icon={Mic}
            label={formatSessionShort(session.title, index, t('sessionInterview'))}
            onClick={() =>
              onOpenAgentSession?.(MOCK_INTERVIEW_AGENT_ID, session.session_id)
            }
          />
        ))}
        {englishSessions.slice(0, 8).map((session, index) => (
          <AssetIcon
            key={session.session_id}
            icon={Languages}
            label={formatSessionShort(session.title, index, t('sessionEnglish'))}
            onClick={() =>
              onOpenAgentSession?.(ENGLISH_TUTOR_AGENT_ID, session.session_id)
            }
          />
        ))}
      </ZoneBlock>

      <ZoneBlock title={t('zoneWork')}>
        <AssetIcon
          icon={Briefcase}
          label={t('tileJobs')}
          onClick={() => push(`/${locale}/jobs`)}
        />
      </ZoneBlock>

      <ZoneBlock title={t('zoneBusiness')}>
        <AssetIcon
          icon={LayoutGrid}
          label={t('tileSpaces')}
          onClick={() => push(`/${locale}/spaces`)}
        />
        <p className="col-span-full px-1 text-[10px] leading-snug text-[#86909C]">
          {t('zoneBusinessHint')}
        </p>
      </ZoneBlock>
    </div>
  );
}

function ZoneBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 px-3 py-2.5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
        {title}
      </h2>
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">{children}</div>
    </section>
  );
}

function AssetIcon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex min-w-0 flex-col items-center gap-0.5 rounded-lg p-1',
        'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40'
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F3F5] text-kazi-navy ring-1 ring-gray-200/80">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="line-clamp-2 w-full text-center text-[10px] leading-tight text-[#4E5969]">
        {label}
      </span>
    </button>
  );
}

function AssetSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1 p-1">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-2 w-10 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </>
  );
}

function formatResumeLabel(
  title: string,
  index: number,
  t: (key: 'resumeIndex', values: { index: number }) => string
): string {
  const trimmed = title?.trim();
  if (trimmed && trimmed.length <= 14) return trimmed;
  return t('resumeIndex', { index: index + 1 });
}

function formatSessionShort(
  title: string,
  index: number,
  prefix: string
): string {
  const trimmed = title?.trim();
  if (trimmed && trimmed.length <= 12) return trimmed;
  return `${prefix} ${index + 1}`;
}
