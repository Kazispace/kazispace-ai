'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, X } from 'lucide-react';

import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import type { SupportedLocale } from '@/lib/constants';
import {
  buildSessionNavRows,
  navigateToSessionNavTarget,
  resolveActiveNavRowId,
  type SessionNavRow,
} from '@/lib/session-nav';
import { cn } from '@/lib/utils';

interface SessionNavPanelProps {
  locale: string;
  open: boolean;
  mobileDrawer: boolean;
  onClose: () => void;
}

function rowLabel(row: SessionNavRow, locale: string, t: ReturnType<typeof useTranslations<'sessionNav'>>): string {
  if (row.id === 'clinic') return t('clinic');
  const agent = AGENT_REGISTRY.find((a) => a.agentId === row.agentId);
  if (!agent) return row.id;
  return getAgentLabel(agent, locale as SupportedLocale, 'name');
}

function rowBadge(
  row: SessionNavRow,
  t: ReturnType<typeof useTranslations<'sessionNav'>>
): string | null {
  if (row.badge === 'comingSoon') return t('comingSoon');
  if (row.disabled && row.disabledReason === 'clinicInline') return t('clinicInlineHint');
  return null;
}

export function SessionNavPanel({
  locale,
  open,
  mobileDrawer,
  onClose,
}: SessionNavPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const rows = useMemo(() => buildSessionNavRows(locale), [locale]);
  const activeId = resolveActiveNavRowId(pathname);

  if (!open && !mobileDrawer) return null;

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

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {rows.map((row) => {
          const isActive = row.id === activeId;
          const badge = rowBadge(row, t);
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
                    {rowLabel(row, locale, t)}
                  </span>
                </div>
                {badge && (
                  <p className="mt-0.5 pl-7 text-xs text-[#86909C]">{badge}</p>
                )}
              </button>
            </li>
          );
        })}
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
      className={cn(
        'hidden md:block shrink-0 overflow-hidden border-r border-[#E5E6EB] transition-[width] duration-200 ease-out',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="h-full w-[260px]">{panelBody}</div>
    </aside>
  );
}
