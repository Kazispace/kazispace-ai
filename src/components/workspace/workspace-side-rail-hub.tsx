'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  FileText,
  Gauge,
  GraduationCap,
  Headphones,
  Languages,
  LayoutGrid,
  Mic,
  Plus,
  ScrollText,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAgentSessionList } from '@/hooks/use-agent-session-list';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import { partitionSessionsByRecency } from '@/lib/workspace-hub-sessions';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types';

interface WorkspaceSideRailHubProps {
  locale: string;
  className?: string;
  onClose?: () => void;
  onOpenCv?: () => void;
  onOpenCvSession?: (sessionId: string) => void;
  onOpenAgentSession?: (agentId: string, sessionId: string) => void;
  onNavigate?: (path: string) => void;
}

type AssetTone =
  | 'resume'
  | 'readiness'
  | 'interview'
  | 'english'
  | 'work'
  | 'spaces'
  | 'muted';

const TONE_ICON_CLASS: Record<AssetTone, string> = {
  resume: 'bg-sky-50 text-sky-900 ring-sky-200/90',
  readiness: 'bg-amber-50 text-amber-900 ring-amber-200/90',
  interview: 'bg-violet-50 text-violet-900 ring-violet-200/90',
  english: 'bg-emerald-50 text-emerald-900 ring-emerald-200/90',
  work: 'bg-[#FFF4EC] text-kazi-navy ring-kazi-orange/25',
  spaces: 'bg-[#F2F3F5] text-kazi-navy ring-gray-200/90',
  muted: 'bg-gray-50 text-[#86909C] ring-gray-200/80',
};

/** Dense vertical asset hub — zones stacked; each asset is a compact icon link. */
export function WorkspaceSideRailHub({
  locale,
  className,
  onClose,
  onOpenCv,
  onOpenCvSession,
  onOpenAgentSession,
  onNavigate,
}: WorkspaceSideRailHubProps) {
  const t = useTranslations('cv.railHub');
  const tCv = useTranslations('cv');
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

  const cvParts = useMemo(
    () => partitionSessionsByRecency(cvSessions),
    [cvSessions]
  );
  const interviewParts = useMemo(
    () => partitionSessionsByRecency(interviewSessions),
    [interviewSessions]
  );
  const englishParts = useMemo(
    () => partitionSessionsByRecency(englishSessions),
    [englishSessions]
  );

  const push = (path: string) => onNavigate?.(path);

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-y-auto text-[#1D2129]',
        className
      )}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1.5 top-1.5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4E5969] shadow-sm ring-1 ring-gray-200/80 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
          aria-label={tCv('closeRail')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      <ZoneBlock title={t('zoneCareer')} className="pt-2 pr-10">
        <AssetIcon
          icon={Plus}
          tone="resume"
          label={t('assetNewResume')}
          onClick={() => onOpenCv?.()}
        />
        <AssetIcon
          icon={Gauge}
          tone="readiness"
          label={t('assetReadiness')}
          onClick={() => push(`/${locale}/interview/readiness`)}
        />
        <AssetIcon
          icon={Mic}
          tone="interview"
          label={t('tileInterview')}
          onClick={() => push(`/${locale}/interview`)}
        />
        <AssetIcon
          icon={GraduationCap}
          tone="english"
          label={t('tileEnglish')}
          onClick={() => push(`/${locale}/english`)}
        />

        {cvLoading ? (
          <AssetSkeleton />
        ) : (
          <>
            {cvParts.recent.map((session, index) => (
              <CvSessionIcon
                key={session.session_id}
                session={session}
                index={index}
                t={t}
                onOpen={() => onOpenCvSession?.(session.session_id)}
              />
            ))}
            <CollapsibleOlder
              label={t('olderResumes', { count: cvParts.older.length })}
              itemCount={cvParts.older.length}
            >
              {cvParts.older.map((session, index) => (
                <CvSessionIcon
                  key={session.session_id}
                  session={session}
                  index={cvParts.recent.length + index}
                  t={t}
                  onOpen={() => onOpenCvSession?.(session.session_id)}
                />
              ))}
            </CollapsibleOlder>
          </>
        )}

        {interviewParts.recent.map((session, index) => (
          <AgentSessionIcon
            key={session.session_id}
            icon={Headphones}
            tone="interview"
            session={session}
            index={index}
            prefix={t('sessionInterview')}
            onOpen={() =>
              onOpenAgentSession?.(MOCK_INTERVIEW_AGENT_ID, session.session_id)
            }
          />
        ))}
        <CollapsibleOlder
          label={t('olderInterview', { count: interviewParts.older.length })}
          itemCount={interviewParts.older.length}
        >
          {interviewParts.older.map((session, index) => (
            <AgentSessionIcon
              key={session.session_id}
              icon={Headphones}
              tone="muted"
              session={session}
              index={interviewParts.recent.length + index}
              prefix={t('sessionInterview')}
              onOpen={() =>
                onOpenAgentSession?.(MOCK_INTERVIEW_AGENT_ID, session.session_id)
              }
            />
          ))}
        </CollapsibleOlder>

        {englishParts.recent.map((session, index) => (
          <AgentSessionIcon
            key={session.session_id}
            icon={BookOpen}
            tone="english"
            session={session}
            index={index}
            prefix={t('sessionEnglish')}
            onOpen={() =>
              onOpenAgentSession?.(ENGLISH_TUTOR_AGENT_ID, session.session_id)
            }
          />
        ))}
        <CollapsibleOlder
          label={t('olderEnglish', { count: englishParts.older.length })}
          itemCount={englishParts.older.length}
        >
          {englishParts.older.map((session, index) => (
            <AgentSessionIcon
              key={session.session_id}
              icon={Languages}
              tone="muted"
              session={session}
              index={englishParts.recent.length + index}
              prefix={t('sessionEnglish')}
              onOpen={() =>
                onOpenAgentSession?.(ENGLISH_TUTOR_AGENT_ID, session.session_id)
              }
            />
          ))}
        </CollapsibleOlder>
      </ZoneBlock>

      <ZoneBlock title={t('zoneWork')}>
        <AssetIcon
          icon={Briefcase}
          tone="work"
          label={t('tileJobs')}
          onClick={() => push(`/${locale}/jobs`)}
        />
      </ZoneBlock>

      <ZoneBlock title={t('zoneBusiness')}>
        <AssetIcon
          icon={LayoutGrid}
          tone="spaces"
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
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('border-b border-gray-100 px-3 py-2.5', className)}
    >
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
        {title}
      </h2>
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">{children}</div>
    </section>
  );
}

function CollapsibleOlder({
  label,
  itemCount,
  children,
}: {
  label: string;
  itemCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (itemCount <= 0) return null;

  return (
    <div className="col-span-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-0.5 py-1 text-left text-[10px] font-medium text-[#86909C] hover:bg-gray-50"
      >
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden
        />
        {label}
      </button>
      {open ? (
        <div className="mt-1 grid grid-cols-4 gap-1 sm:grid-cols-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CvSessionIcon({
  session,
  index,
  t,
  onOpen,
}: {
  session: AgentSessionSummary;
  index: number;
  t: ReturnType<typeof useTranslations<'cv.railHub'>>;
  onOpen: () => void;
}) {
  const exited = session.status === 'exited';
  const icon = exited ? ScrollText : FileText;
  return (
    <AssetIcon
      icon={icon}
      tone={exited ? 'muted' : 'resume'}
      label={formatResumeLabel(session.title, index, t)}
      onClick={onOpen}
    />
  );
}

function AgentSessionIcon({
  icon,
  tone,
  session,
  index,
  prefix,
  onOpen,
}: {
  icon: LucideIcon;
  tone: AssetTone;
  session: AgentSessionSummary;
  index: number;
  prefix: string;
  onOpen: () => void;
}) {
  return (
    <AssetIcon
      icon={icon}
      tone={tone}
      label={formatSessionShort(session.title, index, prefix)}
      onClick={onOpen}
    />
  );
}

function AssetIcon({
  icon: Icon,
  tone,
  label,
  onClick,
}: {
  icon: LucideIcon;
  tone: AssetTone;
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
        'hover:bg-gray-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
          TONE_ICON_CLASS[tone]
        )}
      >
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
  if (trimmed) {
    if (trimmed.length <= 12) return trimmed;
    return `${trimmed.slice(0, 11)}…`;
  }
  return t('resumeIndex', { index: index + 1 });
}

function formatSessionShort(
  title: string,
  index: number,
  prefix: string
): string {
  const trimmed = title?.trim();
  if (trimmed) {
    if (trimmed.length <= 12) return trimmed;
    return `${trimmed.slice(0, 11)}…`;
  }
  return `${prefix} ${index + 1}`;
}
