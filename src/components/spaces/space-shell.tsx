'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { ChatHeader } from '@/components/clinic/chat-header';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

/** @deprecated Use `column` — `page` kept for call-site compat, same full-width shell. */
export type SpaceShellVariant = 'page' | 'column';

interface SpaceShellProps {
  locale: string;
  space: SpaceDetail;
  variant?: SpaceShellVariant;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Clinic-aligned shell: navy header, guest banner, gray message area, composer footer. */
export function SpaceShell({
  locale,
  space,
  variant: _variant = 'column',
  children,
  footer,
}: SpaceShellProps) {
  const tClinic = useTranslations('clinic');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const spaceEmoji = space.template_icon ?? '💬';

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-white">
      <ChatHeader
        locale={locale}
        mode="space"
        spaceName={space.name}
        spaceEmoji={spaceEmoji}
      />

      {!isLoggedIn ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-orange-100 bg-orange-50 px-4 py-2">
          <span className="text-xs text-gray-600">
            <strong className="text-gray-900">{tClinic('guestBanner')}</strong>
          </span>
          <Link href={`/${locale}/login`}>
            <Button size="sm" variant="secondary" className="h-8 text-xs">
              {tClinic('signIn')}
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-bg p-4">
        {children}
      </div>

      {footer}
    </div>
  );
}
