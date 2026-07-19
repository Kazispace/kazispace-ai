'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Play } from 'lucide-react';

import { openHubAgentSession } from '@/lib/hub-agent-open';
import { getAgentHubPath } from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types';

type ClinicParkedCapabilityBannerProps = {
  locale: string;
  session: AgentSessionSummary;
  disabled?: boolean;
  className?: string;
  onResumed?: () => void;
};

/**
 * Lifecycle-Park M3: 「{name} 任务进行中 / 可继续」
 * Explicit resume → POST …/sessions/open (not new). Hub URL switch is unrelated.
 */
export function ClinicParkedCapabilityBanner({
  locale,
  session,
  disabled,
  className,
  onResumed,
}: ClinicParkedCapabilityBannerProps) {
  const t = useTranslations('clinic');
  const showToast = useUIStore((s) => s.showToast);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const agent = AGENT_REGISTRY.find((entry) => entry.agentId === session.agent_id);
  const displayName = agent
    ? getAgentLabel(agent, locale as SupportedLocale, 'name')
    : session.agent_id;

  const handleContinue = async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      // openHubAgentSession → POST …/sessions/open (resume Current; clears parked).
      // Named “Hub” historically; clinic-inline agents (job_search) stay on Clinic.
      const result = await openHubAgentSession(session.agent_id, locale);
      if (!result.ok) {
        showToast(result.error ?? t('parkResumeFailed'), 'error');
        return;
      }
      onResumed?.();
      showToast(t('parkResumed', { agent: displayName }), 'info');

      // job_search has no Hub path (clinic-inline) — stay on Clinic.
      const hubPath = getAgentHubPath(locale, session.agent_id);
      if (hubPath) {
        router.push(hubPath);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-kazi-orange/35 bg-orange-50/90 px-3 py-2',
        className
      )}
      role="status"
    >
      <span className="text-lg shrink-0" aria-hidden>
        {agent?.emoji ?? '📌'}
      </span>
      <p className="min-w-0 flex-1 text-xs text-[#1D2129]">
        <span className="font-medium">
          {t('parkInProgress', { agent: displayName })}
        </span>
        {session.title?.trim() ? (
          <span className="mt-0.5 block truncate text-[11px] text-[#4E5969]">
            {session.title.trim()}
          </span>
        ) : null}
      </p>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void handleContinue()}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full bg-kazi-orange px-2.5 py-1',
          'text-[11px] font-medium text-white transition-colors',
          'hover:bg-kazi-orange/90 disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40'
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Play className="h-3 w-3 fill-current" aria-hidden />
        )}
        {t('parkContinue')}
      </button>
    </div>
  );
}
