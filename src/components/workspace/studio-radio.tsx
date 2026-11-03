'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useRadioHome } from '@/hooks/use-radio-home';
import { formatRadioDate } from '@/lib/radio/format';
import { isRadioLocale, radioHomeHref, radioStoryHref } from '@/lib/radio/routes';

/**
 * Studio「个人电台」(KAZI-1209; kazispace-ui D28, studio.md Sections, personal-radio.md Who sees it).
 *
 * - Interface not Chinese (MVP: Chinese only, the user 2026-11-03) ⇒ `studio.comingSoon`, and the
 *   server is not asked.
 * - Chinese ⇒ `GET /radio/home`:
 *   - loading ⇒ a skeleton (never an entry drawn first and taken away);
 *   - off (404) or not for this user (403 audience / not Pro) ⇒ `studio.comingSoon`, nothing to tap;
 *   - open with a story in progress ⇒ the continue card (`radio.studio.continue` primary,
 *     `radio.studio.open` secondary);
 *   - open with none, or the status cannot be read ⇒ the no-story form (`radio.studio.open`).
 */
export function StudioRadio({ locale, authenticated }: { locale: string; authenticated: boolean }) {
  const t = useTranslations('radio.studio');
  const tStudio = useTranslations('studio');
  const offered = isRadioLocale(locale) && authenticated;
  const { access, home, isLoading } = useRadioHome({ enabled: offered });

  if (!offered || access === 'closed') {
    return (
      <p data-testid="studio-radio" className="text-xs text-workspace-muted">
        {tStudio('comingSoon')}
      </p>
    );
  }
  if (isLoading || access === null) {
    return (
      <div data-testid="studio-radio-loading" aria-busy="true" className="flex flex-col gap-2">
        <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
        <div className="h-7 w-24 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  const current = home?.continue_listening?.[0];
  if (current) {
    return (
      <div data-testid="studio-radio" className="flex flex-col gap-2">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-[11px] text-workspace-muted">{t('continueTitle')}</p>
          <p className="mt-0.5 text-sm font-medium text-workspace-text" data-testid="studio-radio-current">
            {current.title}
          </p>
          <p className="mt-0.5 text-xs text-workspace-secondary">
            {t('lastListened', { date: formatRadioDate(current.updated_at, locale) })}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href={radioStoryHref(locale, current.save_id, 'studio')}
              data-testid="studio-radio-continue"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t('continue')}
            </Link>
            <Link
              href={radioHomeHref(locale)}
              data-testid="studio-radio-open"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-workspace-text hover:bg-gray-50"
            >
              {t('open')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="studio-radio" className="flex flex-col gap-1">
      <p className="text-sm font-medium text-workspace-text">{t('title')}</p>
      <p className="text-xs text-workspace-secondary">{t('subtitle')}</p>
      <Link
        href={radioHomeHref(locale)}
        data-testid="studio-radio-open"
        className="mt-1 self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {t('open')}
      </Link>
    </div>
  );
}
