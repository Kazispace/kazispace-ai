'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import type { ClinicActiveSessionEntry } from '@/lib/clinic-active-sessions';
import {
  formatSessionNavBadgeLabel,
  sessionNavBadgePillClass,
} from '@/lib/session-nav-badges';
import { cn } from '@/lib/utils';

interface ClinicActiveSessionsBannerProps {
  locale: string;
  entries: ClinicActiveSessionEntry[];
  className?: string;
}

export function ClinicActiveSessionsBanner({
  entries,
  className,
}: ClinicActiveSessionsBannerProps) {
  const router = useRouter();
  const tClinic = useTranslations('clinic');
  const tNav = useTranslations('sessionNav');

  if (entries.length === 0) return null;

  const badgeLabelFor = (entry: ClinicActiveSessionEntry) =>
    formatSessionNavBadgeLabel(entry.badge, entry.badgeDetail, (key) => tNav(key));

  if (entries.length === 1) {
    const entry = entries[0]!;
    const badgeLabel = badgeLabelFor(entry);
    const subtitle = entry.sessionTitle ?? badgeLabel;

    return (
      <button
        type="button"
        onClick={() => router.push(entry.href)}
        className={cn(
          'w-full mb-6 flex items-center gap-3 rounded-xl border border-kazi-orange/30 bg-orange-50/80 px-4 py-3 text-left',
          'hover:border-kazi-orange/50 hover:bg-orange-50 transition-colors',
          className
        )}
      >
        <span className="text-2xl shrink-0" aria-hidden>
          {entry.agent.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-kazi-navy truncate">
            {tClinic('activeSessionsContinue', { agent: entry.displayName })}
          </span>
          <span className="mt-0.5 block text-xs text-gray-600 truncate">{subtitle}</span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            sessionNavBadgePillClass(entry.badge)
          )}
        >
          {badgeLabel}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-kazi-orange" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'w-full mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden',
        className
      )}
    >
      <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {tClinic('activeSessionsTitle')}
      </p>
      <ul className="divide-y divide-gray-100">
        {entries.map((entry) => {
          const badgeLabel = badgeLabelFor(entry);
          return (
            <li key={entry.session.session_id}>
              <button
                type="button"
                onClick={() => router.push(entry.href)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  {entry.agent.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-kazi-navy truncate">
                    {entry.displayName}
                  </span>
                  {entry.sessionTitle ? (
                    <span className="mt-0.5 block text-xs text-gray-500 truncate">
                      {entry.sessionTitle}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    sessionNavBadgePillClass(entry.badge)
                  )}
                >
                  {badgeLabel}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
