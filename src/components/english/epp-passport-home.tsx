/**
 * English proficiency passport dashboard at `/english/passport` (secondary route).
 * Cold-open `/english` uses chat intake (KAZI-162).
 */
'use client';

import { BackToClinicButton } from '@/components/clinic/back-to-clinic-button';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EppDimensionBars } from '@/components/english/epp-dimension-bars';
import { getEnglishCtaHref, sortEnglishCtas } from '@/lib/english-epp-cta';
import { clampPct } from '@/lib/interview-irp-utils';
import { cn } from '@/lib/utils';
import type { EnglishCtaHint, EnglishProfile } from '@/types';

interface EppPassportHomeProps {
  profile: EnglishProfile;
  locale: string;
  /** Hub passport page keeps Back to Clinic; space panel hides it (KAZI-183). */
  showBackToClinic?: boolean;
  className?: string;
}

function defaultCtaLabel(
  t: ReturnType<typeof useTranslations<'english.passport'>>,
  cta: EnglishCtaHint
): string {
  switch (cta.cta_type) {
    case 'start_training':
      return t('cta.startTraining');
    case 'retake_assessment':
      return t('cta.retakeAssessment');
    case 'view_history':
      return t('cta.viewHistory');
    case 'view_sample_jobs':
      return t('cta.viewSampleJobs');
    default:
      return t('cta.continue');
  }
}

export function EppPassportHome({
  profile,
  locale,
  showBackToClinic = true,
  className,
}: EppPassportHomeProps) {
  const t = useTranslations('english.passport');
  const router = useRouter();

  const ctas =
    profile.cta_hints && profile.cta_hints.length > 0
      ? sortEnglishCtas(profile.cta_hints)
      : [
          {
            cta_type: 'start_training' as const,
            label: t('cta.startTraining'),
            primary: true,
            scenario_id: 'workplace_oral_interview_intro_v1',
          },
        ];

  const progressPct = clampPct(profile.level_progress_pct);

  const handleCta = (cta: EnglishCtaHint) => {
    const href = getEnglishCtaHref(cta, locale);
    if (href) router.push(href);
  };

  return (
    <div
      className={cn(
        'flex w-full flex-1 flex-col gap-4 p-4',
        showBackToClinic && 'mx-auto max-w-lg',
        className
      )}
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
                    className="h-full rounded-full bg-kazi-orange"
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
            <EppDimensionBars dimensions={profile.dimensions} />
          </div>

          <div className="flex flex-col gap-2">
            {ctas.map((cta) => (
              <Button
                key={`${cta.cta_type}-${cta.scenario_id ?? ''}-${cta.label}`}
                variant={cta.primary ? 'default' : 'secondary'}
                className="w-full"
                onClick={() => handleCta(cta)}
              >
                {cta.label?.trim() || defaultCtaLabel(t, cta)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {showBackToClinic ? (
        <BackToClinicButton
          size="sm"
          variant="outline"
          className="self-start"
          locale={locale}
          agentId={ENGLISH_TUTOR_AGENT_ID}
        >
          {t('backToClinic')}
        </BackToClinicButton>
      ) : null}
    </div>
  );
}
