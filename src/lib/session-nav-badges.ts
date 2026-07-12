import type { SessionNavBadgeKind } from '@/lib/session-nav';

/** i18n keys under sessionNav — pass a translator scoped to sessionNav. */
export type SessionNavBadgeTranslator = (
  key:
    | 'comingSoon'
    | 'clinicInlineHint'
    | 'badgeInProgress'
    | 'badgeResumable'
    | 'badgeArchived'
    | 'badgeNotStarted'
    | 'pipelineFeedbackPending'
    | 'pipelineInterviewActive'
    | 'pipelineCvBuilding'
    | 'pipelinePrep'
    | 'pipelineReview'
    | 'pipelineCompleted'
) => string;

type SessionNavPipelineKey =
  | 'pipelineFeedbackPending'
  | 'pipelineInterviewActive'
  | 'pipelineCvBuilding'
  | 'pipelinePrep'
  | 'pipelineReview'
  | 'pipelineCompleted';

/**
 * Global pipeline_state → badge label (CV + Interview + job_search prep today).
 * TODO(KAZI-148): scope by agentId — e.g. resolvePipelineBadgeLabel(agentId, state, t)
 * so English Tutor / future agents do not share ambiguous keys like `completed`.
 */
export const PIPELINE_STATE_LABEL_KEYS: Record<string, SessionNavPipelineKey> = {
  feedback_pending: 'pipelineFeedbackPending',
  completed: 'pipelineCompleted',
  answering: 'pipelineInterviewActive',
  role_intake: 'pipelineInterviewActive',
  prep_hook: 'pipelinePrep',
  // CV-only review states (needs_confirmation, review_confirm)
  review_confirm: 'pipelineReview',
  needs_confirmation: 'pipelineReview',
  generated: 'pipelineCompleted',
  collecting: 'pipelineCvBuilding',
  intake: 'pipelineCvBuilding',
  entered: 'pipelineCvBuilding',
  profile_analysis: 'pipelineCvBuilding',
  cv_analysis: 'pipelineCvBuilding',
  job_target: 'pipelineCvBuilding',
  strength: 'pipelineCvBuilding',
  draft_generate: 'pipelineCvBuilding',
  polish: 'pipelineCvBuilding',
};

export function resolvePipelineBadgeLabel(
  pipelineState: string | null | undefined,
  t: SessionNavBadgeTranslator,
  /** Reserved for agent-scoped labels (see TODO above). */
  _agentId?: string | null
): string {
  const raw = pipelineState?.trim();
  if (!raw) return t('badgeInProgress');
  const key = PIPELINE_STATE_LABEL_KEYS[raw.toLowerCase()];
  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[session-nav-badges] Unmapped pipeline_state "${raw}" — add to PIPELINE_STATE_LABEL_KEYS`
      );
    }
    return t('badgeInProgress');
  }
  return t(key);
}

export function sessionNavBadgePillClass(kind: SessionNavBadgeKind): string {
  switch (kind) {
    case 'inProgress':
    case 'pipeline':
      return 'bg-green-100 text-green-800';
    case 'resumable':
      return 'bg-amber-100 text-amber-800';
    case 'archived':
    case 'notStarted':
      return 'bg-gray-100 text-gray-600';
    case 'comingSoon':
      return 'bg-gray-100 text-gray-600';
    // Placement hint (Clinic-only agents), not a lifecycle status.
    case 'clinicInline':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function formatSessionNavBadgeLabel(
  badge: SessionNavBadgeKind,
  badgeDetail: string | null | undefined,
  t: SessionNavBadgeTranslator,
  agentId?: string | null
): string {
  const kindLabels: Record<SessionNavBadgeKind, string> = {
    comingSoon: t('comingSoon'),
    clinicInline: t('clinicInlineHint'),
    inProgress: t('badgeInProgress'),
    resumable: t('badgeResumable'),
    archived: t('badgeArchived'),
    notStarted: t('badgeNotStarted'),
    pipeline: resolvePipelineBadgeLabel(badgeDetail, t, agentId),
  };
  return kindLabels[badge];
}
