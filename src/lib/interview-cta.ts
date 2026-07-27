import { buildClinicCvRailHref } from '@/lib/cv-entry';
import { resolveActionLabel } from '@/lib/chat-envelope';
import type { ChatNextAction } from '@/types/chat-envelope';
import type { InterviewCta, InterviewCtaType } from '@/types';

const CTA_TYPES: InterviewCtaType[] = [
  'weakness_drill',
  'retry_full',
  'edit_cv',
  'view_jobs',
  'back_to_clinic',
];

export function isInterviewCtaType(value: string): value is InterviewCtaType {
  return CTA_TYPES.includes(value as InterviewCtaType);
}

/** Returns route href, or null when the CTA is handled in-app (retry / drill). */
export function getInterviewCtaHref(
  locale: string,
  cta: InterviewCta,
  sessionJobId?: string | null
): string | null {
  const jobId = cta.job_id ?? sessionJobId ?? null;

  switch (cta.cta_type) {
    case 'edit_cv':
      return buildClinicCvRailHref(locale, jobId);
    case 'view_jobs':
      return `/${locale}/jobs`;
    case 'back_to_clinic':
      return `/${locale}/chat`;
    case 'weakness_drill':
    case 'retry_full':
      return null;
    default:
      return null;
  }
}

export function sortInterviewCtas(ctas: InterviewCta[]): InterviewCta[] {
  return [...ctas].sort((a, b) => Number(b.primary) - Number(a.primary));
}

/** Prefer legacy `ctas`; else map envelope `next_actions` (KAZI-135/137). */
export function resolveInterviewFeedbackCtas(
  input: {
    ctas?: InterviewCta[];
    assistant_response?: { next_actions?: ChatNextAction[] };
  },
  locale: string
): InterviewCta[] {
  if (input.ctas?.length) {
    return input.ctas;
  }

  const actions = input.assistant_response?.next_actions;
  if (!actions?.length) return [];

  const ctas: InterviewCta[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const ctaType = action.type;
    if (!isInterviewCtaType(ctaType)) continue;
    const raw = action as ChatNextAction & { primary?: boolean };
    ctas.push({
      cta_type: ctaType,
      label: resolveActionLabel(action, locale),
      primary: typeof raw.primary === 'boolean' ? raw.primary : i === 0,
      job_id: action.job_id ?? null,
    });
  }
  return ctas;
}
