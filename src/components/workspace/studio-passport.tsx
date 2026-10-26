'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { EppPassportHome } from '@/components/english/epp-passport-home';
import { EnglishAbilitySection } from '@/components/spaces/panels/english-ability-section';
import { useEnglishProfile } from '@/hooks/use-english-profile';
import { EPP_PROFILE_ENABLED } from '@/lib/constants';
import { englishSpaceHref } from '@/lib/spaces/routes';

/**
 * Studio「英语护照」(KAZI-1171, Owen 2026-10-26: the passport was missing from Studio).
 *
 * The same two readings the English Space panel shows, read-only:
 * - the passport level and dimensions, when the user has one;
 * - the ability from practice (no 「练这个」 here: practice happens in the English Space).
 *
 * One link always: open the English Space, where the tutor lives now that `/english` is gone.
 */
export function StudioPassport({ locale, authenticated }: { locale: string; authenticated: boolean }) {
  const t = useTranslations('studio.passport');
  const { profile, profileStatus } = useEnglishProfile({
    enabled: EPP_PROFILE_ENABLED && authenticated,
  });
  const hasPassport = profile != null && (profileStatus === 'ready' || profileStatus === 'active');

  return (
    <div data-testid="studio-passport" className="flex flex-col gap-2">
      {hasPassport && profile ? <EppPassportHome profile={profile} className="p-0" /> : null}
      {authenticated ? <EnglishAbilitySection /> : null}
      {!hasPassport ? <p className="text-xs text-workspace-secondary">{t('empty')}</p> : null}
      <Link
        href={englishSpaceHref(locale)}
        data-testid="studio-passport-open-space"
        className="self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {t('openSpace')}
      </Link>
    </div>
  );
}
