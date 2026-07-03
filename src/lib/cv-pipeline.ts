/** User-visible CV Builder pipeline steps (maps BE `pipeline_state`). */

export type CvPipelineStepId = 'intake' | 'analyze' | 'generate' | 'review' | 'done';

export const CV_PIPELINE_STEP_ORDER: CvPipelineStepId[] = [
  'intake',
  'analyze',
  'generate',
  'review',
  'done',
];

const RAW_STATE_TO_STEP: Record<string, CvPipelineStepId> = {
  entered: 'intake',
  intake: 'intake',
  collecting: 'intake',
  profile_analysis: 'analyze',
  cv_analysis: 'analyze',
  job_target: 'analyze',
  strength: 'analyze',
  needs_confirmation: 'generate',
  draft_generate: 'generate',
  polish: 'generate',
  review_confirm: 'review',
  generated: 'done',
  exit: 'done',
};

export function resolveCvPipelineStep(
  pipelineState?: string | null
): CvPipelineStepId {
  if (!pipelineState) return 'intake';
  return RAW_STATE_TO_STEP[pipelineState] ?? 'intake';
}

export function cvPipelineStepIndex(stepId: CvPipelineStepId): number {
  return CV_PIPELINE_STEP_ORDER.indexOf(stepId);
}
