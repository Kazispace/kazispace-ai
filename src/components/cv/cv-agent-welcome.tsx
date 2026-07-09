'use client';

import { useTranslations } from 'next-intl';

interface CvAgentWelcomeProps {
  className?: string;
}

/** Coze-style agent intro when chat is empty. */
export function CvAgentWelcome({ className }: CvAgentWelcomeProps) {
  const t = useTranslations('cv');

  return (
    <div className={className}>
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-kazi-orange to-amber-400 flex items-center justify-center text-3xl shadow-md mb-4">
          📄
        </div>
        <h2 className="text-lg font-semibold text-workspace-text">{t('title')}</h2>
        <p className="text-sm text-workspace-muted mt-1 max-w-sm">{t('agentWelcome')}</p>
      </div>
    </div>
  );
}
