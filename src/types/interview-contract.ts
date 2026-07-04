/** KAZI-38 / API v2.8.3 §7 — ahead of partial OpenAPI snapshot. */

export type InterviewCtaType =
  | 'weakness_drill'
  | 'retry_full'
  | 'edit_cv'
  | 'view_jobs'
  | 'back_to_clinic';

export interface InterviewCta {
  cta_type: InterviewCtaType;
  label: string;
  primary?: boolean;
  job_id?: string | null;
}

export interface InterviewWeaknessTag {
  tag: string;
  label: string;
  question_index?: number;
}

export type PrepAckAction = 'start' | 'skip';

export interface PrepAckRequest {
  action: PrepAckAction;
}

export interface PrepAckResponse {
  session_id: string;
  prep_acknowledged: boolean;
  action: PrepAckAction;
  question: import('./api-schema').InterviewQuestionBlock;
}

export interface InterviewJobContext {
  jobId: string;
  title: string;
  company: string;
}
