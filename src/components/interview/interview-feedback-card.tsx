'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { InterviewFeedbackSummary } from '@/types';

interface InterviewFeedbackCardProps {
  targetRole: string | null;
  feedback: InterviewFeedbackSummary;
  locale: string;
  onPracticeAgain: () => void;
}

function scoreTone(value: number) {
  if (value >= 4) return 'text-green-600';
  if (value >= 3) return 'text-amber-600';
  return 'text-red-600';
}

function stars(value: number) {
  const n = Math.round(value);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function InterviewFeedbackCard({
  targetRole,
  feedback,
  locale,
  onPracticeAgain,
}: InterviewFeedbackCardProps) {
  const t = useTranslations('interview');
  const scores = feedback.scores ?? {};

  const dimensions: Array<{ key: keyof NonNullable<InterviewFeedbackSummary['scores']>; label: string }> = [
    { key: 'clarity', label: t('scores.clarity') },
    { key: 'relevance', label: t('scores.relevance') },
    { key: 'confidence', label: t('scores.confidence') },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-xl self-start">
      <h3 className="font-semibold text-kazi-orange mb-4">
        {t('feedbackTitle', { role: targetRole ?? '' })}
      </h3>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {dimensions.map(({ key, label }) => {
          const val = scores[key] ?? 0;
          return (
            <div
              key={key}
              className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
              <p className={`text-lg font-bold ${scoreTone(val)}`}>{val}/5</p>
              <p className="text-xs text-amber-500">{stars(val)}</p>
            </div>
          );
        })}
      </div>

      {feedback.overall_summary && (
        <section className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('overallSummary')}
          </h4>
          <p className="text-sm text-gray-800">{feedback.overall_summary}</p>
        </section>
      )}

      {feedback.strengths && feedback.strengths.length > 0 && (
        <section className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('strengths')}
          </h4>
          <ul className="text-sm text-gray-800 list-disc pl-4 space-y-1">
            {feedback.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {feedback.improvements && feedback.improvements.length > 0 && (
        <section className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('improvements')}
          </h4>
          <ul className="text-sm text-gray-800 list-disc pl-4 space-y-1">
            {feedback.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {feedback.sample_better_answer && (
        <section className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('sampleAnswer')}
          </h4>
          <p className="text-sm italic text-gray-700 border-l-2 border-kazi-orange pl-3">
            {feedback.sample_better_answer}
          </p>
        </section>
      )}

      {feedback.next_step && (
        <section className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('nextStep')}
          </h4>
          <p className="text-sm bg-orange-50 border border-orange-100 rounded-lg p-3">
            {feedback.next_step}
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onPracticeAgain}>
          {t('practiceAgain')}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${locale}/cv`}>{t('buildCv')}</Link>
        </Button>
      </div>
    </div>
  );
}
