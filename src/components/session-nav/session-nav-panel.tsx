'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, X } from 'lucide-react';

import type { CurrentSessionsByAgent } from '@/hooks/use-active-agent-sessions';
import {
  buildSessionNavRows,
  enrichSessionNavRows,
  navigateToSessionNavTarget,
  resolveActiveNavRowId,
  type SessionNavBadgeKind,
  type SessionNavRow,
} from '@/lib/session-nav';
import { cn } from '@/lib/utils';

interface SessionNavPanelProps {
  locale: string;
  open: boolean;
  mobileDrawer: boolean;
  onClose: () => void;
  sessionsByAgent: CurrentSessionsByAgent;
  isLoading?: boolean;
  fetchError?: string | null;
}

function rowBadgeText(
  row: SessionNavRow,
  t: ReturnType<typeof useTranslations<'sessionNav'>>
): string | null {
  if (row.badge === 'comingSoon') return t('comingSoon');
  if (row.disabled && row.disabledReason === 'clinicInline') return t('clinicInlineHint');
  if (!row.badge) return null;

  const kindLabels: Record<SessionNavBadgeKind, string> = {
    comingSoon: t('comingSoon'),
    clinicInline: t('clinicInlineHint'),
    inProgress: t('badgeInProgress'),
    resumable: t('badgeResumable'),
    archived: t('badgeArchived'),
    notStarted: t('badgeNotStarted'),
    pipeline: row.badgeDetail ?? t('badgeInProgress'),
  };

  return kindLabels[row.badge] ?? null;
}

export function SessionNavPanel({
  locale,
  open,
  mobileDrawer,
  onClose,
  sessionsByAgent,
  isLoading = false,
  fetchError = null,
}: SessionNavPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const rows = useMemo(() => {
    const base = buildSessionNavRows(locale, t('clinic'));
    return enrichSessionNavRows(base, sessionsByAgent);
  }, [locale, sessionsByAgent, t]);
  const activeId = resolveActiveNavRowId(pathname);

  useEffect(() => {
    if (!mobileDrawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileDrawer, onClose]);

  const panelBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-12 items-center justify-between border-b border-[#E5E6EB] px-3">
        <span className="text-sm font-semibold text-[#1D2129]">{t('panelTitle')}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
          aria-label={t('collapsePanel')}
        >
          {mobileDrawer ? <X className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {fetchError && (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('refreshFailed')}
        </p>
      )}

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && rows.every((row) => !row.currentSession) ? (
          Array.from({ length: 3 }).map((_, index) => (
            <li key={`skeleton-${index}`} className="rounded-lg px-3 py-2.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F3F5]" />
              <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[#F2F3F5]" />
            </li>
          ))
        ) : (
          rows.map((row) => {
            const isActive = row.id === activeId;
            const badge = rowBadgeText(row, t);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={row.disabled}
                  onClick={() => {
                    navigateToSessionNavTarget(router, row);
                    if (mobileDrawer) onClose();
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                    isActive && 'bg-[#FFF4EC]',
                    row.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-[#F2F3F5]',
                    !isActive && !row.disabled && 'text-[#1D2129]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" aria-hidden>
                      {row.emoji}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {row.displayName}
                    </span>
                  </div>
                  {badge && (
                    <p className="mt-0.5 pl-7 text-xs text-[#86909C]">{badge}</p>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  if (mobileDrawer) {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label={t('collapsePanel')}
          onClick={onClose}
        />
        <aside className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] shadow-xl md:hidden">
          {panelBody}
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'hidden md:block shrink-0 overflow-hidden border-r border-[#E5E6EB] transition-[width] duration-200 ease-out',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="h-full w-[260px]">{panelBody}</div>
    </aside>
  );
}
