'use client';

/** @deprecated KAZI-134 — prep shown as assistant messages + quick replies. */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Briefcase, Clock, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { InterviewJobContext, InterviewPrepCard as PrepCardData } from '@/types';

interface InterviewPrepCardProps {
  prep: PrepCardData;
  jobContext?: InterviewJobContext | null;
  locale: string;
  jobId?: string | null;
  onStart: () => void;
  onSkip: () => void;
  disabled?: boolean;
  embedded?: boolean;
}

export function InterviewPrepCard({
  prep,
  jobContext,
  locale,
  jobId,
  onStart,
  onSkip,
  disabled,
  embedded,
}: InterviewPrepCardProps) {
  const t = useTranslations('interview');

  const cvHref = jobId
    ? `/${locale}/cv?job_id=${encodeURIComponent(jobId)}`
    : `/${locale}/cv`;

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full'
      }
    >
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-kazi-navy">{t('prepTitle')}</h2>
            {jobContext && (
              <div className="flex items-start gap-2 mt-2 text-sm text-gray-700">
                <Briefcase className="w-4 h-4 shrink-0 mt-0.5 text-kazi-orange" />
                <div>
                  <p className="font-medium text-kazi-navy">{jobContext.title}</p>
                  <p className="text-gray-500">{jobContext.company}</p>
                </div>
              </div>
            )}
          </div>

          {prep.estimated_duration_min != null && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{t('prepDuration', { min: prep.estimated_duration_min })}</span>
            </div>
          )}

          {prep.focus_areas && prep.focus_areas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-kazi-navy mb-2">
                <Target className="w-4 h-4" />
                {t('prepFocusAreas')}
              </div>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {prep.focus_areas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          )}

          {prep.sample_questions && prep.sample_questions.length > 0 && (
            <div>
              <p className="text-sm font-medium text-kazi-navy mb-2">{t('prepSampleQuestions')}</p>
              <ul className="space-y-2">
                {prep.sample_questions.map((q, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button className="w-full" onClick={onStart} disabled={disabled}>
              {t('startInterview')}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={onSkip}
              disabled={disabled}
            >
              {t('skipPrep')}
            </Button>
            <Button className="w-full" variant="secondary" asChild>
              <Link href={cvHref}>{t('optimizeCv')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
