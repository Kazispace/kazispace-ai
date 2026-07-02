'use client';

import { useTranslations } from 'next-intl';
import { Clock, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { InterviewPrepCard as PrepCardData } from '@/types/interview-contract';

interface InterviewPrepCardProps {
  prep: PrepCardData;
  onStart: () => void;
  disabled?: boolean;
}

export function InterviewPrepCard({ prep, onStart, disabled }: InterviewPrepCardProps) {
  const t = useTranslations('interview');

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-kazi-navy">{t('prepTitle')}</h2>
            {prep.job_title && (
              <p className="text-sm text-gray-600 mt-1">{prep.job_title}</p>
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

          <Button className="w-full" onClick={onStart} disabled={disabled}>
            {prep.primary_cta ?? t('startInterview')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
