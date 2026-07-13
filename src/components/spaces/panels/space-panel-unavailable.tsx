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
      <p className="text-sm font-medium text-[#1D2129]">{t('panelUnavailable')}</p>
      <p className="text-xs text-[#86909C]">
        {t('panelUnavailableDetail', { panelId })}
      </p>
    </div>
  );
}
