import type { InterviewProfileStatus } from '@/types';

export type InterviewEntryRoute = 'job_prep' | 'profile_home' | 'training';

/** Web SDD §9.1 entry decision — job_id always wins over profile home. */
export function resolveInterviewEntry(params: {
  irpEnabled: boolean;
  jobId?: string | null;
  profileStatus?: InterviewProfileStatus | null;
}): InterviewEntryRoute {
  if (params.jobId) return 'job_prep';
  if (params.irpEnabled && params.profileStatus === 'formal') return 'profile_home';
  return 'training';
}

export function hasFormalIrp(profileStatus?: InterviewProfileStatus | null): boolean {
  return profileStatus === 'formal';
}
