'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface HubSessionStaleBannerProps {
  onRefresh: () => void;
  onDismiss: () => void;
}

export function HubSessionStaleBanner({
  onRefresh,
  onDismiss,
}: HubSessionStaleBannerProps) {
  const t = useTranslations('hub');

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <p>{t('sessionStaleMessage')}</p>
      <div className="flex items-center gap-2 shrink-0">
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          {t('sessionStaleDismiss')}
        </Button>
        <Button type="button" size="sm" onClick={onRefresh}>
          {t('sessionStaleRefresh')}
        </Button>
      </div>
    </div>
  );
}
