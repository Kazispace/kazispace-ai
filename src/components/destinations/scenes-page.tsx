'use client';

import { useTranslations } from 'next-intl';

/**
 * Scenes: practical English (KAZI-1485, kazispace-ui D36, Navigation 3.0). A placeholder until
 * its screens are designed (Owen: "场景tab下面的UI内容正在开发当中"): `studio.comingSoon`, nothing
 * to tap.
 */
export function ScenesPage() {
  const tNav = useTranslations('nav');
  const tStudio = useTranslations('studio');
  return (
    <div className="h-full overflow-y-auto bg-gray-bg" data-testid="scenes-page">
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-workspace-text">{tNav('scenes')}</h1>
        <p data-testid="scenes-coming-soon" className="text-sm text-workspace-muted">
          {tStudio('comingSoon')}
        </p>
      </main>
    </div>
  );
}
