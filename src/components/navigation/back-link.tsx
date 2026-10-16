'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { markNavIntent } from '@/lib/perf/nav-intent';

/**
 * Back to the top-level screen a sub-screen was reached from. Sub-screens hide the
 * mobile tab bar (kazispace-ui tab bar spec), so this is how a phone user returns.
 * Page header spec 0.2, "With back": arrow + the name of the screen it returns to,
 * and an accessible name that says where it goes ("Back to Me").
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const t = useTranslations('nav');
  return (
    <Link
      href={href}
      aria-label={t('backTo', { destination: label })}
      onClick={() => markNavIntent()}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
