'use client';

import { useTranslations } from 'next-intl';

import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { AgentNavIcon } from '@/components/agents/agent-nav-icon';
import { cn } from '@/lib/utils';

interface LayerIndicatorProps {
  locale: string;
  activeAgentId: string | null;
  statusDetail?: string | null;
  onClinicClick?: () => void;
  className?: string;
}

/**
 * v1.3 layer breadcrumb — user always sees Clinic vs active expert.
 */
export function LayerIndicator({
  locale,
  activeAgentId,
  statusDetail,
  onClinicClick,
  className,
}: LayerIndicatorProps) {
  const t = useTranslations('clinic');
  const agentEntry = activeAgentId
    ? AGENT_REGISTRY.find((a) => a.agentId === activeAgentId)
    : null;
  const agentLabel = agentEntry
    ? getAgentLabel(agentEntry, locale, 'name')
    : activeAgentId;

  const inAgentLayer = Boolean(activeAgentId && agentEntry);

  return (
    <div
      className={cn(
        'shrink-0 border-b border-gray-200/80 bg-white px-4 py-2',
        className
      )}
      aria-label={t('layerAria')}
    >
      <div className="flex items-center gap-1.5 text-xs min-w-0">
        {inAgentLayer && onClinicClick ? (
          <button
            type="button"
            onClick={onClinicClick}
            className="shrink-0 font-medium text-gray-500 hover:text-primary transition-colors"
          >
            {t('layerClinic')}
          </button>
        ) : (
          <span
            className={cn(
              'shrink-0 font-medium',
              inAgentLayer ? 'text-gray-500' : 'text-kazi-navy'
            )}
          >
            {t('layerClinic')}
          </span>
        )}

        {inAgentLayer && agentLabel ? (
          <>
            <span className="text-gray-300 shrink-0" aria-hidden>
              ›
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0 font-semibold text-kazi-navy truncate">
              {agentEntry?.agentId ? (
                <AgentNavIcon agentId={agentEntry.agentId} sizeClassName="h-3.5 w-3.5" />
              ) : null}
              <span className="truncate">{agentLabel}</span>
            </span>
          </>
        ) : null}
      </div>

      {statusDetail ? (
        <p className="text-[11px] text-gray-500 mt-1 truncate">{statusDetail}</p>
      ) : inAgentLayer ? (
        <p className="text-[11px] text-primary/80 mt-1">{t('layerAgentActive')}</p>
      ) : (
        <p className="text-[11px] text-gray-500 mt-1">{t('layerClinicActive')}</p>
      )}
    </div>
  );
}
