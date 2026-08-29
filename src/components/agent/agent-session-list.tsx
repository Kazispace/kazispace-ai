'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types';

interface AgentSessionListProps {
  sessions: AgentSessionSummary[];
  activeSessionId: string | null;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  className?: string;
}

function formatSessionTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusLabel(
  session: AgentSessionSummary,
  activeSessionId: string | null,
  t: ReturnType<typeof useTranslations<'agentSessions'>>
): string {
  if (session.session_id === activeSessionId) {
    return t('sessionCurrent');
  }
  if (session.status === 'active') return t('sessionActive');
  if (session.status === 'archived') return t('sessionArchived');
  return t('sessionExited');
}

function statusBadgeClass(
  session: AgentSessionSummary,
  activeSessionId: string | null
): string {
  if (session.session_id === activeSessionId) {
    return 'bg-blue-100 text-primary';
  }
  if (session.status === 'active') return 'bg-green-100 text-green-800';
  if (session.status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-100 text-amber-800';
}

export function AgentSessionList({
  sessions,
  activeSessionId,
  isLoading,
  disabled,
  onSelect,
  className,
}: AgentSessionListProps) {
  const t = useTranslations('agentSessions');

  if (isLoading && sessions.length === 0) {
    return (
      <p className={cn('text-xs text-gray-500 px-3 py-8 text-center', className)}>
        {t('sessionsLoading')}
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className={cn('text-xs text-gray-500 px-3 py-8 text-center', className)}>
        {t('sessionsEmpty')}
      </p>
    );
  }

  return (
    <ul className={cn('space-y-0.5', className)}>
      {sessions.map((session) => {
        const isHighlighted = session.session_id === activeSessionId;
        return (
          <li key={session.session_id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(session.session_id)}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2.5 transition-colors',
                isHighlighted
                  ? 'bg-blue-50 text-kazi-navy ring-1 ring-blue-200/80'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <p className="text-sm font-medium truncate">{session.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded',
                    statusBadgeClass(session, activeSessionId)
                  )}
                >
                  {statusLabel(session, activeSessionId, t)}
                </span>
                {session.updated_at ? (
                  <span className="text-[11px] text-gray-500">
                    {formatSessionTime(session.updated_at)}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
