'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { markNavIntent } from '@/lib/perf/nav-intent';

/**
 * Back to the top-level screen a sub-screen was reached from. Sub-screens hide the
 * mobile tab bar (kazispace-ui tab bar spec), so this is how a phone user returns.
 * The "With back" page-header state is not designed yet; this is the minimal form.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      onClick={() => markNavIntent()}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
