'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useAuthStore } from '@/lib/store';
import { topLevelHref } from '@/lib/top-level-nav';
import { cn } from '@/lib/utils';

const PRIMARY =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
// Outlined form of the primary button: the secondary style is not designed yet (kazispace-ui button spec).
const SECONDARY =
  'inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-workspace-border bg-white px-4 text-sm font-medium text-workspace-text transition-colors hover:bg-workspace-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

/**
 * The homepage's calls to action (kazispace-ui Homepage, "Calls to action"; D30).
 * Signed out: "Sign up" + "Log in", both to the sign-in screen. Signed in: "Open KaziSpace",
 * to Space. Until the session is known, the signed-out pair is drawn.
 */
export function HomeCtas({
  locale,
  placement,
}: {
  locale: string;
  /** `bar`: top bar (Log in is a text button on narrow screens). `hero`: both. `closing`: primary only. */
  placement: 'bar' | 'hero' | 'closing';
}) {
  const t = useTranslations('home');
  const authReady = useAuthStore((s) => s.authReady);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const signedIn = authReady && isLoggedIn;
  const login = `/${locale}/login`;

  if (signedIn) {
    return (
      <div className="flex items-center gap-2" data-testid={`home-cta-${placement}`}>
        <Link href={topLevelHref(locale, 'space')} className={PRIMARY}>
          {t('openApp')}
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center', placement === 'bar' ? 'gap-2' : 'gap-3')}
      data-testid={`home-cta-${placement}`}
    >
      {placement === 'hero' && (
        <>
          <Link href={login} className={PRIMARY}>
            {t('signUp')}
          </Link>
          <Link href={login} className={SECONDARY}>
            {t('logIn')}
          </Link>
        </>
      )}
      {placement === 'bar' && (
        <>
          <Link
            href={login}
            className={cn(
              SECONDARY,
              'max-md:border-transparent max-md:bg-transparent max-md:px-3'
            )}
          >
            {t('logIn')}
          </Link>
          <Link href={login} className={PRIMARY}>
            {t('signUp')}
          </Link>
        </>
      )}
      {placement === 'closing' && (
        <Link href={login} className={PRIMARY}>
          {t('signUp')}
        </Link>
      )}
    </div>
  );
}
