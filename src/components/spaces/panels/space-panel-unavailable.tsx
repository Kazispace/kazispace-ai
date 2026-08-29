'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface SpacePanelUnavailableProps {
  panelId: string;
  className?: string;
}

export function SpacePanelUnavailable({ panelId, className }: SpacePanelUnavailableProps) {
  const t = useTranslations('spaces');

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-2 bg-white p-6 text-center',
        className
      )}
    >
      <p className="text-sm font-medium text-workspace-text">{t('panelUnavailable')}</p>
      <p className="text-xs text-workspace-muted">
        {t('panelUnavailableDetail', { panelId })}
      </p>
    </div>
  );
}
