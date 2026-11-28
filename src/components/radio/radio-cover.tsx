'use client';

import { BookOpen, Library, Radio } from 'lucide-react';

import { cn } from '@/lib/utils';

/** What a cover stands for (kazispace-ui Personal radio 0.35, Look · Covers). */
export type RadioCoverKind = 'story' | 'serial' | 'program';

/**
 * The fallback by kind, until the server sends cover images (KAZI-1513): a gradient with the kind's icon.
 * Stories `accent-start` → `bg-top`, serial stories `now` → `bg-top`, programmes `accent-end` → `bg-bottom`.
 */
const FALLBACK: Record<RadioCoverKind, string> = {
  story: 'from-radio-accent-start to-radio-bg-top',
  serial: 'from-radio-now to-radio-bg-top',
  program: 'from-radio-accent-end to-radio-bg-bottom',
};

const ICON = { story: BookOpen, serial: Library, program: Radio } as const;

/**
 * A square cover. Decoration only: no text, hidden from assistive technology (the title beside it names the
 * item, and is not repeated).
 */
export function RadioCover({ kind, size = 56, className }: { kind: RadioCoverKind; size?: number; className?: string }) {
  const Icon = ICON[kind];
  return (
    <span
      aria-hidden
      data-testid="radio-cover"
      data-kind={kind}
      style={{ width: size, height: size }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br', FALLBACK[kind], className)}
    >
      <Icon className="text-white/85" style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  );
}
