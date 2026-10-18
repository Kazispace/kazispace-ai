'use client';

import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/hooks/use-online-status';

/** D16: slim bar under the header while the device is offline. */
export function OfflineBar() {
  const online = useOnlineStatus();
  const t = useTranslations('states');
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-bar"
      className="flex items-center justify-center gap-2 bg-gray-100 px-4 py-1.5 text-xs text-gray-700"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t('offline')}</span>
    </div>
  );
}
