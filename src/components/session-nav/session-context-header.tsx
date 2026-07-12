'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { resolveSurfaceFromPathname } from '@/lib/agent-transition/surfaces';

interface SessionContextHeaderProps {
  locale: string;
}

export function SessionContextHeader({ locale }: SessionContextHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const surface = resolveSurfaceFromPathname(pathname);

  const title = useMemo(() => {
    if (surface === 'clinic') {
      return t('clinicTitle');
    }
    const segment = pathname.split('/').filter(Boolean)[1];
    const agent = AGENT_REGISTRY.find((entry) => {
      if (surface === 'cv' && entry.agentId === 'cv_builder') return true;
      if (surface === 'interview' && entry.agentId === 'mock_interview') return true;
      if (surface === 'english' && entry.agentId === 'english_tutor') return true;
      return false;
    });
    if (!agent) return t('workspace');
    const name = getAgentLabel(agent, locale, 'name');
    return `${agent.emoji} ${name}`;
  }, [locale, pathname, surface, t]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E5E6EB] bg-white px-4">
      <h1 className="truncate text-sm font-semibold text-[#1D2129]">{title}</h1>
      <LocaleSwitcher locale={locale} />
    </header>
  );
}
