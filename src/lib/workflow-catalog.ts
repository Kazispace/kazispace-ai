import type { AssistantWorkflow, WorkflowStep, WorkflowStepStatus } from '@/types/chat-envelope';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import { resolveCvPipelineStep, type CvPipelineStepId } from '@/lib/cv-pipeline';

export type MockInterviewWorkflowPhase =
  | 'role_select'
  | 'prep_review'
  | 'interview'
  | 'feedback_pending'
  | 'feedback_ready'
  | 'feedback_failed';

const CV_STEP_ORDER: CvPipelineStepId[] = ['intake', 'analyze', 'generate', 'review', 'done'];

export type CvWorkflowLabels = Record<CvPipelineStepId, string>;

export type MockInterviewWorkflowLabels = {
  prep: string;
  questions: string;
  feedback: string;
  report: string;
  questionDetail: (values: { current: number; total: number }) => string;
};

function markSteps(
  order: string[],
  currentId: string,
  skippedBefore?: Set<string>
): WorkflowStep[] {
  let seenCurrent = false;
  return order.map((id) => {
    if (skippedBefore?.has(id)) {
      return { id, status: 'skipped' as WorkflowStepStatus };
    }
    if (id === currentId) {
      seenCurrent = true;
      return { id, status: 'current' as WorkflowStepStatus };
    }
    if (!seenCurrent) {
      return { id, status: 'done' as WorkflowStepStatus };
    }
    return { id, status: 'pending' as WorkflowStepStatus };
  });
}

/** Transitional until KAZI-131 `build_workflow` projection — no FE progress_pct. */
export function buildCvWorkflowFromPipeline(
  pipelineState: string | null | undefined,
  labels: CvWorkflowLabels
): AssistantWorkflow {
  const current = resolveCvPipelineStep(pipelineState);
  const steps = markSteps(CV_STEP_ORDER, current).map((step) => ({
    ...step,
    label: labels[step.id as CvPipelineStepId],
  }));

  return {
    agent_id: CV_BUILDER_AGENT_ID,
    pipeline_state: pipelineState ?? 'intake',
    steps,
  };
}

/** Transitional MI workflow — fixed skeleton + dynamic detail on q_group (§3.3.1). */
export function buildMockInterviewWorkflow(
  phase: MockInterviewWorkflowPhase,
  labels: MockInterviewWorkflowLabels,
  questionIndex = 1,
  questionCount = 3
): AssistantWorkflow | undefined {
  const order = ['prep', 'q_group', 'feedback', 'report'] as const;

  let currentId: string | null = null;
  let detail: string | undefined;

  switch (phase) {
    case 'role_select':
      return undefined;
    case 'prep_review':
      currentId = 'prep';
      break;
    case 'interview':
      currentId = 'q_group';
      detail = labels.questionDetail({ current: questionIndex, total: questionCount });
      break;
    case 'feedback_pending':
      currentId = 'feedback';
      break;
    case 'feedback_ready':
      currentId = 'report';
      break;
    case 'feedback_failed':
      currentId = 'feedback';
      break;
    default:
      return undefined;
  }

  if (!currentId) return undefined;

  const labelById: Record<(typeof order)[number], string> = {
    prep: labels.prep,
    q_group: labels.questions,
    feedback: labels.feedback,
    report: labels.report,
  };

  const steps = markSteps([...order], currentId).map((step) => {
    const id = step.id as (typeof order)[number];
    const enriched: WorkflowStep = { ...step, label: labelById[id] };
    if (id === 'q_group' && detail && step.status === 'current') {
      enriched.detail = detail;
    }
    return enriched;
  });

  return {
    agent_id: MOCK_INTERVIEW_AGENT_ID,
    pipeline_state: phase,
    steps,
  };
}
