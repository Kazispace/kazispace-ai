'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { BackToClinicButton } from '@/components/clinic/back-to-clinic-button';
import { Button } from '@/components/ui/button';
import { getInterviewCtaHref, sortInterviewCtas } from '@/lib/interview-cta';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { InterviewCta } from '@/types';

interface InterviewFeedbackActionsProps {
  ctas: InterviewCta[];
  locale: string;
  jobId?: string | null;
  onCtaAction: (cta: InterviewCta) => void;
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

/** Inline CTAs after feedback messages — not a standalone result card (§19 P2). */
export function InterviewFeedbackActions({
  ctas,
  locale,
  jobId,
  onCtaAction,
}: InterviewFeedbackActionsProps) {
  const t = useTranslations('interview');
  const sortedCtas =
    ctas.length > 0
      ? sortInterviewCtas(ctas)
      : [
          {
            cta_type: 'retry_full' as const,
            label: t('practiceAgain'),
            primary: true,
            job_id: jobId ?? null,
          },
          {
            cta_type: 'edit_cv' as const,
            label: t('buildCv'),
            primary: false,
            job_id: jobId ?? null,
          },
        ];

  return (
    <div className="flex flex-wrap gap-2 self-start max-w-xl">
      {sortedCtas.map((cta) => {
          const label = cta.label?.trim() || defaultCtaLabel(t, cta.cta_type);

          if (cta.cta_type === 'back_to_clinic') {
            return (
              <BackToClinicButton
                key={`${cta.cta_type}-${label}`}
                size="sm"
                variant={cta.primary ? 'default' : 'outline'}
                locale={locale}
                agentId={MOCK_INTERVIEW_AGENT_ID}
              >
                {label}
              </BackToClinicButton>
            );
          }

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
        })}
    </div>
  );
}
