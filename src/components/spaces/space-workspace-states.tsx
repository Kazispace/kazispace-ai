'use client';

import { useTranslations } from 'next-intl';

export function SpaceWorkspaceLoading() {
  const t = useTranslations('spaces');
  return (
    <div className="flex h-full items-center justify-center text-sm text-[#86909C]">
      {t('loading')}
    </div>
  );
}

export function SpaceWorkspaceError({ message }: { message?: string | null }) {
  const t = useTranslations('spaces');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm text-[#4E5969]">{message ?? t('loadFailed')}</p>
      <p className="text-xs text-[#86909C]">{t('apiNotReadyHint')}</p>
    </div>
  );
}
