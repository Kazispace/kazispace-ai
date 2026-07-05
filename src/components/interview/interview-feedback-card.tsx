'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { getInterviewCtaHref, sortInterviewCtas } from '@/lib/interview-cta';
import type { InterviewCta, InterviewFeedbackSummary } from '@/types';

interface InterviewFeedbackCardProps {
  targetRole: string | null;
  feedback: InterviewFeedbackSummary;
  ctas: InterviewCta[];
  locale: string;
  jobId?: string | null;
  onCtaAction: (cta: InterviewCta) => void;
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

function defaultCtaLabel(
  t: ReturnType<typeof useTranslations<'interview'>>,
  ctaType: InterviewCta['cta_type']
): string {
  switch (ctaType) {
    case 'weakness_drill':
      return t('cta.weaknessDrill');
    case 'retry_full':
      return t('practiceAgain');
    case 'edit_cv':
      return t('buildCv');
    case 'view_jobs':
      return t('cta.viewJobs');
    case 'back_to_clinic':
      return t('cta.backToClinic');
    default:
      return t('cta.continue');
  }
}

export function InterviewFeedbackCard({
  targetRole,
  feedback,
  ctas,
  locale,
  jobId,
  onCtaAction,
  onPracticeAgain,
}: InterviewFeedbackCardProps) {
  const t = useTranslations('interview');
  const scores = feedback.scores ?? {};
  const showScores = feedback.tier !== 'free';

  const dimensions: Array<{ key: keyof NonNullable<InterviewFeedbackSummary['scores']>; label: string }> = [
    { key: 'clarity', label: t('scores.clarity') },
    { key: 'relevance', label: t('scores.relevance') },
    { key: 'confidence', label: t('scores.confidence') },
  ];

  const sortedCtas =
    ctas.length > 0
      ? sortInterviewCtas(ctas)
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-xl self-start">
      <h3 className="font-semibold text-kazi-orange mb-4">
        {t('feedbackTitle', { role: targetRole ?? '' })}
      </h3>

      {showScores && (
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
      )}

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

      {feedback.weakness_tags && feedback.weakness_tags.length > 0 && (
        <section className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            {t('weaknessTags')}
          </h4>
          <ul className="text-sm text-gray-800 list-disc pl-4 space-y-1">
            {feedback.weakness_tags.map((tag) => (
              <li key={`${tag.tag}-${tag.question_index ?? 0}`}>{tag.label}</li>
            ))}
          </ul>
        </section>
      )}

      {feedback.sample_better_answer && feedback.tier !== 'free' && (
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
        {sortedCtas ? (
          sortedCtas.map((cta) => {
            const label = cta.label?.trim() || defaultCtaLabel(t, cta.cta_type);
            const href = getInterviewCtaHref(locale, cta, jobId);

            if (href) {
              return (
                <Button
                  key={`${cta.cta_type}-${label}`}
                  size="sm"
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
                size="sm"
                variant={cta.primary ? 'default' : 'outline'}
                onClick={() => onCtaAction(cta)}
              >
                {label}
              </Button>
            );
          })
        ) : (
          <>
            <Button size="sm" onClick={() => onPracticeAgain()}>
              {t('practiceAgain')}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link
                href={
                  jobId
                    ? `/${locale}/cv?job_id=${encodeURIComponent(jobId)}`
                    : `/${locale}/cv`
                }
              >
                {t('buildCv')}
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
