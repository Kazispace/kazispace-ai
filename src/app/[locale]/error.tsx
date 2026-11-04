'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { reloadForChunkError, shouldReloadForChunkError } from '@/lib/chunk-reload';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorBoundary');
  const tStates = useTranslations('states');
  const locale = useLocale();

  // A script file that failed to download: reload once instead of showing this screen.
  const [reloading] = useState(() => shouldReloadForChunkError(error));

  useEffect(() => {
    if (reloading) {
      reloadForChunkError();
      return;
    }
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error, reloading]);

  if (reloading) return <div className="min-h-screen" aria-busy="true" />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t('description')}</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>{tStates('retry')}</Button>
        <Button variant="outline" asChild>
          {/* Full navigation, not next/link — the crash may have left app state
              broken, so force a fresh load rather than a client transition. */}
          <a href={`/${locale}/chat`}>{t('backToClinic')}</a>
        </Button>
      </div>
    </div>
  );
}
