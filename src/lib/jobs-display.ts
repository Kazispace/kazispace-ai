import type { JobDetailResponse, JobMatchLevel } from '@/types/jobs';

export function getJobWhyMatched(job: JobDetailResponse): string[] {
  return job.match_analysis?.why_matched ?? job.why_matched ?? [];
}

export function getJobGaps(job: JobDetailResponse): string[] {
  if (job.pro_features_locked) return [];
  return job.match_analysis?.gap_to_close ?? job.gap_to_close ?? [];
}

export function getJobApplyUrl(job: JobDetailResponse): string | null {
  return job.apply_url ?? job.source_url ?? null;
}

export function isKnownMatchLevel(level?: string | null): level is JobMatchLevel {
  return level === 'excellent' || level === 'good' || level === 'fair';
}
