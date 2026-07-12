'use client';

/**
 * EPP onboarding form at `/english/onboarding` (secondary route).
 * Cold-open `/english` uses chat intake (KAZI-162).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { EnglishCareerGoal, EnglishOnboardingRequest, EnglishSelfAssessedBand } from '@/types';

const CAREER_GOALS: EnglishCareerGoal[] = [
  'better_job',
  'promotion',
  'interview_english',
  'prove_ability',
  'long_term_growth',
];

const SELF_BANDS: EnglishSelfAssessedBand[] = [
  'beginner',
  'elementary',
  'intermediate',
  'advanced',
];

interface EppOnboardingProps {
  onComplete: (data: EnglishOnboardingRequest) => void;
  isSaving?: boolean;
}

export function EppOnboarding({ onComplete, isSaving }: EppOnboardingProps) {
  const t = useTranslations('english.onboarding');
  const [careerGoal, setCareerGoal] = useState<EnglishCareerGoal>('better_job');
  const [selfBand, setSelfBand] = useState<EnglishSelfAssessedBand>('intermediate');

  return (
    <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full gap-4">
      <div>
        <h1 className="text-lg font-bold text-kazi-navy">{t('title')}</h1>
        <p className="text-xs text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <p className="text-sm font-medium text-kazi-navy mb-2">{t('goalQuestion')}</p>
            <div className="flex flex-col gap-2">
              {CAREER_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setCareerGoal(goal)}
                  className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                    careerGoal === goal
                      ? 'border-kazi-orange bg-kazi-orange/5 text-kazi-navy'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {t(`goals.${goal}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-kazi-navy mb-2">{t('levelQuestion')}</p>
            <div className="flex flex-col gap-2">
              {SELF_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setSelfBand(band)}
                  className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                    selfBand === band
                      ? 'border-kazi-orange bg-kazi-orange/5 text-kazi-navy'
                      : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {t(`bands.${band}`)}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={isSaving}
            onClick={() =>
              onComplete({ career_goal: careerGoal, self_assessed_band: selfBand })
            }
          >
            {t('quickCta')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
