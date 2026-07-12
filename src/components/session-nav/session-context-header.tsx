'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import type { CurrentSessionsByAgent } from '@/hooks/use-active-agent-sessions';
import { getDedicatedHubAgentFromPathname } from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import {
  resolveContextHeaderSession,
  resolveSessionNavBadge,
  type SessionNavBadgeKind,
} from '@/lib/session-nav';
import { cn } from '@/lib/utils';

interface SessionContextHeaderProps {
  locale: string;
  sessionsByAgent: CurrentSessionsByAgent;
}

function statusPillClass(kind: SessionNavBadgeKind): string {
  switch (kind) {
    case 'inProgress':
    case 'pipeline':
      return 'bg-green-100 text-green-800';
    case 'resumable':
      return 'bg-amber-100 text-amber-800';
    case 'archived':
    case 'notStarted':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function SessionContextHeader({
  locale,
  sessionsByAgent,
}: SessionContextHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const currentSession = resolveContextHeaderSession(pathname, sessionsByAgent);

  const { title, statusLabel, statusKind } = useMemo(() => {
    const agentId = getDedicatedHubAgentFromPathname(pathname);
    const agent = agentId
      ? AGENT_REGISTRY.find((entry) => entry.agentId === agentId)
      : undefined;

    if (!agent) {
      return {
        title: t('workspace'),
        statusLabel: null as string | null,
        statusKind: null as ReturnType<typeof resolveSessionNavBadge> | null,
      };
    }

    const name = getAgentLabel(agent, locale, 'name');
    const sessionTitle = currentSession?.title?.trim();
    const titleText = sessionTitle
      ? `${agent.emoji} ${name} · ${sessionTitle}`
      : `${agent.emoji} ${name}`;

    const badge = resolveSessionNavBadge(currentSession);
    const statusLabelMap = {
      inProgress: t('badgeInProgress'),
      resumable: t('badgeResumable'),
      archived: t('badgeArchived'),
      notStarted: t('badgeNotStarted'),
      pipeline: currentSession?.pipeline_state ?? t('badgeInProgress'),
      comingSoon: t('comingSoon'),
      clinicInline: t('clinicInlineHint'),
    } as const;

    return {
      title: titleText,
      statusLabel: badge ? statusLabelMap[badge.kind] : null,
      statusKind: badge,
    };
  }, [currentSession, locale, pathname, t]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#E5E6EB] bg-white px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="truncate text-sm font-semibold text-[#1D2129]">{title}</h1>
        {statusLabel && statusKind && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
              statusPillClass(statusKind.kind)
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <LocaleSwitcher locale={locale} />
    </header>
  );
}
