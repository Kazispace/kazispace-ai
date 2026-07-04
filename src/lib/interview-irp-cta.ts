import type { IrpCtaHint, IrpCtaType } from '@/types';

const IRP_CTA_TYPES: IrpCtaType[] = [
  'start_training',
  'readiness_check',
  'growth_history',
  'edit_cv',
  'view_jobs',
];

export function isIrpCtaType(value: string): value is IrpCtaType {
  return IRP_CTA_TYPES.includes(value as IrpCtaType);
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
