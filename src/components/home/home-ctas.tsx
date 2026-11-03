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
  const space = topLevelHref(locale, 'space');
  // After sign-in the visitor lands in Space (Homepage 0.1, "Calls to action").
  const login = `/${locale}/login?redirect=${encodeURIComponent(space)}`;
  // Hidden but laid out: keeps the slot's width so nothing moves when the session is known.
  const hiddenProps = { 'aria-hidden': true, tabIndex: -1 } as const;

  const signedOut = (
    <div
      className={cn(
        'col-start-1 row-start-1 flex items-center',
        placement === 'bar' ? 'gap-2' : 'gap-3',
        signedIn && 'invisible'
      )}
      aria-hidden={signedIn || undefined}
    >
      {placement === 'hero' && (
        <>
          <Link href={login} className={PRIMARY} {...(signedIn ? hiddenProps : {})}>
            {t('signUp')}
          </Link>
          <Link href={login} className={SECONDARY} {...(signedIn ? hiddenProps : {})}>
            {t('logIn')}
          </Link>
        </>
      )}
      {placement === 'bar' && (
        <>
          <Link
            href={login}
            className={cn(SECONDARY, 'max-md:border-transparent max-md:bg-transparent max-md:px-3')}
            {...(signedIn ? hiddenProps : {})}
          >
            {t('logIn')}
          </Link>
          <Link href={login} className={PRIMARY} {...(signedIn ? hiddenProps : {})}>
            {t('signUp')}
          </Link>
        </>
      )}
      {placement === 'closing' && (
        <Link href={login} className={PRIMARY} {...(signedIn ? hiddenProps : {})}>
          {t('signUp')}
        </Link>
      )}
    </div>
  );

  return (
    <div
      className={cn('grid', placement === 'bar' ? 'justify-items-end' : placement === 'closing' ? 'justify-items-center' : 'justify-items-start')}
      data-testid={`home-cta-${placement}`}
    >
      {signedOut}
      {signedIn && (
        <div className="col-start-1 row-start-1 flex items-center">
          <Link href={space} className={PRIMARY}>
            {t('openApp')}
          </Link>
        </div>
      )}
    </div>
  );
}
