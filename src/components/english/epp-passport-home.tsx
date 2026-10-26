/**
 * English proficiency passport card: level, progress and dimensions.
 * Shown in the English Space panel and in Studio (KAZI-1171).
 *
 * ❌ Former: the `/english/passport` page, with CTAs into `/english/training`,
 * `/assessment`, `/growth` and the sample-jobs anchor.
 * ✅ Now: those pages are gone (Owen 2026-10-26), so the backend's `cta_hints` are not
 * rendered. The only action is the optional `action` link a host passes (Studio: open
 * the English Space).
 */
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EppDimensionBars } from '@/components/english/epp-dimension-bars';
import { clampPct } from '@/lib/interview-irp-utils';
import { cn } from '@/lib/utils';
import type { EnglishProfile } from '@/types';

interface EppPassportHomeProps {
  profile: EnglishProfile;
  /** One link under the card; absent ⇒ no button. */
  action?: { label: string; href: string };
  className?: string;
}

export function EppPassportHome({ profile, action, className }: EppPassportHomeProps) {
  const t = useTranslations('english.passport');

  const progressPct = clampPct(profile.level_progress_pct);

  return (
    <div
      className={cn('flex w-full flex-1 flex-col gap-4 p-4', className)}
    >
      {profile.level_locked && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
          {t('levelLocked', { level: profile.display_level })}
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('title')}</p>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl font-bold text-kazi-navy">
                L{profile.display_level}
              </span>
              <div>
                <p className="text-sm font-semibold text-kazi-navy">
                  {profile.level_name ?? t('levelUnknown')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('trainingSessions', {
                    count: profile.total_training_sessions ?? 0,
                  })}
                </p>
              </div>
            </div>
            {progressPct != null && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>{t('levelProgress')}</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-kazi-navy">{t('dimensionsTitle')}</h3>
            </div>
            <EppDimensionBars dimensions={profile.dimensions} />
          </div>

          {action ? (
            <Button asChild className="w-full">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
