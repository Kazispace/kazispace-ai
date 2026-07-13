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

type SpaceWorkspaceErrorReason = 'loadFailed' | 'unsupportedTemplate';

export function SpaceWorkspaceError({
  message,
  reason = 'loadFailed',
}: {
  message?: string | null;
  reason?: SpaceWorkspaceErrorReason;
}) {
  const t = useTranslations('spaces');
  const hint =
    reason === 'unsupportedTemplate'
      ? t('unsupportedTemplateHint')
      : t('apiNotReadyHint');

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm text-[#4E5969]">
        {message ?? t(reason === 'unsupportedTemplate' ? 'unsupportedTemplate' : 'loadFailed')}
      </p>
      <p className="text-xs text-[#86909C]">{hint}</p>
    </div>
  );
}
