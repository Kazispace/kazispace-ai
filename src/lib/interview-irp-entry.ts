import type { InterviewProfileStatus } from '@/types';

export type InterviewEntryRoute = 'job_prep' | 'training';

/** Web SDD §9.1 — job_id wins; all other cold opens use chat intake (KAZI-161). */
export function resolveInterviewEntry(params: {
  jobId?: string | null;
}): InterviewEntryRoute {
  if (params.jobId) return 'job_prep';
  return 'training';
}

export function hasFormalIrp(profileStatus?: InterviewProfileStatus | null): boolean {
  return profileStatus === 'formal';
}
