'use client';

/**
 * IRP profile dashboard at `/interview/profile` (secondary route).
 * Cold-open `/interview` uses chat intake instead (KAZI-161).
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getIrpCtaHref, sortIrpCtas } from '@/lib/interview-irp-cta';
import { clampPct } from '@/lib/interview-irp-utils';
import { IrpDimensionBars } from '@/components/interview/irp-dimension-bars';
import type { InterviewProfile, IrpCtaHint } from '@/types';

interface IrpProfileHomeProps {
  profile: InterviewProfile;
  locale: string;
  onStartTraining: () => void;
  onCtaAction?: (cta: IrpCtaHint) => void;
  isPro?: boolean;
}

function defaultCtaLabel(
  t: ReturnType<typeof useTranslations<'interview.irp'>>,
  cta: IrpCtaHint
): string {
  if (
    cta.cta_type === 'start_training' &&
    cta.formal_rounds_remaining != null &&
    cta.formal_rounds_remaining > 0
  ) {
    return t('provisionalBanner', { remaining: cta.formal_rounds_remaining });
  }

  switch (cta.cta_type) {
    case 'start_training':
      return t('cta.startTraining');
    case 'readiness_check':
      return t('cta.readinessCheck');
    case 'growth_history':
      return t('cta.growthHistory');
    case 'edit_cv':
      return t('cta.editCv');
    case 'view_jobs':
      return t('cta.viewJobs');
    default:
      return t('cta.continue');
  }
}

export function IrpProfileHome({
  profile,
  locale,
  onStartTraining,
  onCtaAction,
  isPro = false,
}: IrpProfileHomeProps) {
  const t = useTranslations('interview.irp');

  const ctas =
    profile.cta_hints && profile.cta_hints.length > 0
      ? sortIrpCtas(profile.cta_hints)
      : [{ cta_type: 'start_training' as const, label: t('cta.startTraining'), primary: true }];

  const showTagDetails = isPro && profile.tags;
  const isProvisional = profile.profile_status === 'provisional';
  const progressPct = clampPct(profile.level_progress_pct);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('profileTitle')}</p>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl font-bold text-kazi-navy">
                {profile.level ?? '—'}
              </span>
              <div>
                <p className="text-sm font-semibold text-kazi-navy">
                  {profile.level_name ?? t('levelUnknown')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('trainingRounds', { count: profile.total_training_rounds ?? 0 })}
                </p>
              </div>
            </div>
            {progressPct != null && (
              <div className={`mt-3 ${isProvisional ? 'opacity-60' : ''}`}>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>
                    {t('levelProgress')}
                    {isProvisional && (
                      <span className="ml-1 text-amber-600">({t('provisionalShort')})</span>
                    )}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div
                  className={`h-1.5 bg-gray-100 rounded-full overflow-hidden ${
                    isProvisional ? 'border border-dashed border-gray-300' : ''
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${isProvisional ? 'bg-gray-400' : 'bg-kazi-orange'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-kazi-orange" />
              <h3 className="text-sm font-semibold text-kazi-navy">{t('dimensionsTitle')}</h3>
            </div>
            <IrpDimensionBars
              dimensions={profile.dimensions}
              profileStatus={profile.profile_status}
            />
          </div>

          {showTagDetails && (
            <>
              {profile.tags?.strengths && profile.tags.strengths.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {t('strengths')}
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {profile.tags.strengths.map((tag) => (
                      <li
                        key={tag.tag}
                        className="text-xs bg-green-50 text-green-800 border border-green-100 rounded-full px-2.5 py-1"
                      >
                        {tag.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {profile.tags?.improvements && profile.tags.improvements.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {t('improvements')}
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {profile.tags.improvements.map((tag) => (
                      <li
                        key={tag.tag}
                        className="text-xs bg-amber-50 text-amber-800 border border-amber-100 rounded-full px-2.5 py-1"
                      >
                        {tag.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {ctas.map((cta) => {
              const label = cta.label?.trim() || defaultCtaLabel(t, cta);
              const href = getIrpCtaHref(locale, cta, profile.target_job_id);

              if (cta.cta_type === 'start_training') {
                return (
                  <Button
                    key={`${cta.cta_type}-${label}`}
                    className="w-full"
                    variant={cta.primary ? 'default' : 'outline'}
                    onClick={onStartTraining}
                  >
                    {label}
                  </Button>
                );
              }

              if (href) {
                return (
                  <Button
                    key={`${cta.cta_type}-${label}`}
                    className="w-full"
                    variant={cta.primary ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={href}>{label}</Link>
                  </Button>
                );
              }

              return (
                <Button
                  key={`${cta.cta_type}-${label}`}
                  className="w-full"
                  variant={cta.primary ? 'default' : 'outline'}
                  onClick={() => onCtaAction?.(cta)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
