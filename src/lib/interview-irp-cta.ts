import type { InterviewProfileStatus, IrpCtaHint, IrpCtaType } from '@/types';

const IRP_CTA_TYPES: IrpCtaType[] = [
  'start_training',
  'readiness_check',
  'growth_history',
  'edit_cv',
  'view_jobs',
];

/** BE Phase 1.5 legacy string hints (PR #47) → API §7.7 `IrpCtaHint`. */
const BE_LEGACY_CTA_MAP: Record<
  string,
  Pick<IrpCtaHint, 'cta_type' | 'primary'>
> = {
  start_first_training: { cta_type: 'start_training', primary: true },
  continue_training: { cta_type: 'start_training', primary: false },
  view_readiness: { cta_type: 'readiness_check', primary: true },
  growth_history: { cta_type: 'growth_history', primary: false },
  edit_cv: { cta_type: 'edit_cv', primary: false },
  view_jobs: { cta_type: 'view_jobs', primary: false },
};

const COMPLETE_FORMAL_ROUNDS_RE =
  /^complete_(\d+)_more_rounds_for_formal$/;

export function isIrpCtaType(value: string): value is IrpCtaType {
  return IRP_CTA_TYPES.includes(value as IrpCtaType);
}

function isIrpCtaHintObject(value: unknown): value is IrpCtaHint {
  return (
    typeof value === 'object' &&
    value != null &&
    'cta_type' in value &&
    typeof (value as IrpCtaHint).cta_type === 'string' &&
    isIrpCtaType((value as IrpCtaHint).cta_type)
  );
}

function mapLegacyCtaString(
  raw: string,
  targetJobId?: string | null
): IrpCtaHint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const mapped = BE_LEGACY_CTA_MAP[trimmed];
  if (mapped) {
    return {
      ...mapped,
      label: '',
      ...(mapped.cta_type === 'readiness_check' && targetJobId
        ? { job_id: targetJobId }
        : {}),
    };
  }

  if (isIrpCtaType(trimmed)) {
    return { cta_type: trimmed, label: '' };
  }

  const provisional = COMPLETE_FORMAL_ROUNDS_RE.exec(trimmed);
  if (provisional) {
    return {
      cta_type: 'start_training',
      label: '',
      primary: true,
      formal_rounds_remaining: Number(provisional[1]),
    };
  }

  return null;
}

function upsertCtaHint(out: IrpCtaHint[], hint: IrpCtaHint): void {
  const idx = out.findIndex((h) => h.cta_type === hint.cta_type);
  if (idx < 0) {
    out.push(hint);
    return;
  }
  const existing = out[idx];
  if (hint.primary && !existing.primary) {
    out[idx] = {
      ...existing,
      ...hint,
      primary: true,
      job_id: hint.job_id ?? existing.job_id,
      formal_rounds_remaining:
        hint.formal_rounds_remaining ?? existing.formal_rounds_remaining,
    };
  }
}

/** Normalize BE string[] or §7.7 objects into typed CTAs for profile home. */
export function normalizeIrpCtaHints(
  raw: unknown,
  options?: {
    targetJobId?: string | null;
    profileStatus?: InterviewProfileStatus;
  }
): IrpCtaHint[] {
  const rawList = Array.isArray(raw) ? raw : [];
  const targetJobId = options?.targetJobId ?? null;
  const out: IrpCtaHint[] = [];

  for (const item of rawList) {
    let hint: IrpCtaHint | null = null;

    if (typeof item === 'string') {
      hint = mapLegacyCtaString(item, targetJobId);
    } else if (isIrpCtaHintObject(item)) {
      hint = {
        ...item,
        job_id: item.job_id ?? (item.cta_type === 'readiness_check' ? targetJobId : null),
      };
    }

    if (!hint) continue;
    upsertCtaHint(out, hint);
  }

  if (
    options?.profileStatus === 'formal' &&
    !out.some((h) => h.cta_type === 'growth_history')
  ) {
    out.push({ cta_type: 'growth_history', label: '', primary: false });
  }

  return out;
}

export function getIrpCtaHref(
  locale: string,
  cta: IrpCtaHint,
  fallbackJobId?: string | null
): string | null {
  const jobId = cta.job_id ?? fallbackJobId ?? null;

  switch (cta.cta_type) {
    case 'readiness_check':
      return jobId
        ? `/${locale}/interview/readiness?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/interview/readiness`;
    case 'growth_history':
      return `/${locale}/interview/growth`;
    case 'edit_cv':
      return jobId
        ? `/${locale}/cv?job_id=${encodeURIComponent(jobId)}`
        : `/${locale}/cv`;
    case 'view_jobs':
      return `/${locale}/jobs`;
    case 'start_training':
      return null;
    default:
      return null;
  }
}

export function sortIrpCtas(ctas: IrpCtaHint[]): IrpCtaHint[] {
  return [...ctas].sort((a, b) => Number(b.primary) - Number(a.primary));
}
