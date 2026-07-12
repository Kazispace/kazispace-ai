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
) => string;

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
  t: SessionNavBadgeTranslator
): string {
  const kindLabels: Record<SessionNavBadgeKind, string> = {
    comingSoon: t('comingSoon'),
    clinicInline: t('clinicInlineHint'),
    inProgress: t('badgeInProgress'),
    resumable: t('badgeResumable'),
    archived: t('badgeArchived'),
    notStarted: t('badgeNotStarted'),
    pipeline: badgeDetail?.trim() || t('badgeInProgress'),
  };
  return kindLabels[badge];
}
