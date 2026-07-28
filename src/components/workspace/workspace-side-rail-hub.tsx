'use client';

import { useState } from 'react';
import {
  Briefcase,
  FileText,
  Landmark,
  Languages,
  LayoutGrid,
  Mic,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type WorkspaceSideRailHubZoneId = 'career' | 'work' | 'finance' | 'business';

export type WorkspaceSideRailHubAction =
  | 'cv'
  | 'interview'
  | 'english'
  | 'jobs';

interface WorkspaceSideRailHubProps {
  className?: string;
  onAction?: (action: WorkspaceSideRailHubAction) => void;
}

interface ZoneConfig {
  id: WorkspaceSideRailHubZoneId;
  labelKey: 'zoneCareer' | 'zoneWork' | 'zoneFinance' | 'zoneBusiness';
  icon: LucideIcon;
  enabled: boolean;
}

const ZONES: ZoneConfig[] = [
  { id: 'career', labelKey: 'zoneCareer', icon: Sparkles, enabled: true },
  { id: 'work', labelKey: 'zoneWork', icon: Briefcase, enabled: true },
  { id: 'finance', labelKey: 'zoneFinance', icon: Landmark, enabled: false },
  { id: 'business', labelKey: 'zoneBusiness', icon: LayoutGrid, enabled: false },
];

/** Shallow icon hub for the right rail — drill down from tiles, not full CV by default. */
export function WorkspaceSideRailHub({
  className,
  onAction,
}: WorkspaceSideRailHubProps) {
  const t = useTranslations('cv.railHub');
  const [activeZone, setActiveZone] =
    useState<WorkspaceSideRailHubZoneId>('career');

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}>
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[#86909C]">
          {t('zonesLabel')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ZONES.map((zone) => {
            const Icon = zone.icon;
            const active = activeZone === zone.id;
            return (
              <button
                key={zone.id}
                type="button"
                disabled={!zone.enabled}
                onClick={() => zone.enabled && setActiveZone(zone.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  active && zone.enabled
                    ? 'bg-kazi-orange/12 text-kazi-navy'
                    : 'text-[#4E5969] hover:bg-gray-100',
                  !zone.enabled && 'cursor-not-allowed opacity-45'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{t(zone.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {activeZone === 'career' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <HubTile
              icon={FileText}
              title={t('tileCv')}
              hint={t('tileCvHint')}
              onClick={() => onAction?.('cv')}
            />
            <HubTile
              icon={Mic}
              title={t('tileInterview')}
              hint={t('tileInterviewHint')}
              onClick={() => onAction?.('interview')}
            />
            <HubTile
              icon={Languages}
              title={t('tileEnglish')}
              hint={t('tileEnglishHint')}
              onClick={() => onAction?.('english')}
            />
          </div>
        ) : activeZone === 'work' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <HubTile
              icon={Briefcase}
              title={t('tileJobs')}
              hint={t('tileJobsHint')}
              onClick={() => onAction?.('jobs')}
            />
          </div>
        ) : (
          <p className="text-sm text-[#86909C]">{t('zoneComingSoon')}</p>
        )}
      </div>
    </div>
  );
}

function HubTile({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/80 p-4',
        'text-center transition-colors hover:border-kazi-orange/35 hover:bg-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40'
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-200/80">
        <Icon className="h-6 w-6 text-kazi-navy" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-[#1D2129]">{title}</span>
      <span className="text-xs leading-snug text-[#86909C]">{hint}</span>
    </button>
  );
}
