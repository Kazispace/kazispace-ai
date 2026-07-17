'use client';

import Link from 'next/link';
import { type ReactNode, type Ref } from 'react';
import { useTranslations } from 'next-intl';

import { ChatHeader } from '@/components/clinic/chat-header';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { useEmbeddedInWorkspaceShell } from '@/lib/workspace-shell-context';
import { cn } from '@/lib/utils';
import type { SpaceDetail } from '@/types/spaces';

interface SpaceShellProps {
  locale: string;
  space: SpaceDetail;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Scrollable message column (overflow-y-auto). */
  scrollRef?: Ref<HTMLDivElement>;
  onScroll?: () => void;
  /** Floating UI above composer, e.g. jump-to-latest. */
  scrollOverlay?: ReactNode;
}

/** Clinic-aligned shell: full-width column inside SessionNav main (h-full chain). */
export function SpaceShell({
  locale,
  space,
  children,
  footer,
  scrollRef,
  onScroll,
  scrollOverlay,
}: SpaceShellProps) {
  const tClinic = useTranslations('clinic');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const embeddedInWorkspace = useEmbeddedInWorkspaceShell();
  const spaceEmoji = space.template_icon ?? '💬';

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-white">
      {!embeddedInWorkspace ? (
        <ChatHeader
          locale={locale}
          mode="space"
          spaceName={space.name}
          spaceEmoji={spaceEmoji}
        />
      ) : null}

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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn('min-h-0 flex-1 overflow-y-auto bg-gray-bg p-4')}
        >
          {children}
        </div>
        {scrollOverlay}
      </div>

      {footer}
    </div>
  );
}
