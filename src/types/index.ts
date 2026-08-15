// User types
// API path types: run `npm run gen:api` → src/types/api.generated.ts (from docs/openapi.json)

export interface ProfileCompletion {
  minimumComplete: boolean;
  missingMinimum: string[];
  overallPct: number;
  minimumFieldsCompleted: number;
  minimumFieldsTotal: number;
}

export interface User {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  country?: string;
  primaryLocale?: string;
  careerGoal?: string;
  targetRole?: string;
  englishLevel?: string;
  weeklyHoursBudget?: number | null;
  currentStatus?: string;
  education?: string;
  experience?: string;
  profileCompletion?: ProfileCompletion;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
}

// Chat types
import type { AssistantWorkflow, ChatJobCard, ChatNextAction } from './chat-envelope';

export interface ReferralPayload {
  agentId: string;
  reason: string;
  dismissed?: boolean;
}

export type { SpaceNudgePayload } from '@/lib/spaces/space-nudge';

export type { ChatJobCard, ChatNextAction, LocalizedLabel, ParsedAssistantEnvelope, AssistantWorkflow, WorkflowStep, WorkflowStepStatus } from './chat-envelope';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sessionId: string;
  intent?: string;
  status?: 'sending' | 'sent' | 'failed';
  referral?: ReferralPayload;
  spaceNudge?: import('@/lib/spaces/space-nudge').SpaceNudgePayload;
  nextActions?: ChatNextAction[];
  cards?: ChatJobCard[];
  /** Research sources from citation_list custom_component (KAZI-223). */
  citations?: import('@/lib/clinic/citation-list').CitationItem[];
  /** web_search → research upgrade CTA (KAZI-233). */
  upgradeCta?: import('@/lib/clinic/upgrade-cta').UpgradeCtaPayload;
  /** Search capability for chip / short-answer density (KAZI-234). */
  capabilityId?: import('@/lib/clinic/search-capability').SearchCapabilityId;
  /** Bound playbook id from BE meta (tooltip only). */
  playbookId?: string | null;
  /**
   * Waiting-copy hint while the assistant placeholder is empty (KAZI-233).
   * Cleared when the reply arrives.
   */
  pendingCapability?: 'web_search' | 'research';
  workflow?: import('./chat-envelope').AssistantWorkflow;
  /** assistant_response.meta (e.g. recommended_strategy_id for KAZI-400). */
  assistantMeta?: Record<string, unknown>;
  /** english_tutor Cap custom_components (KAZI-502). */
  customComponents?: import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[];
  streamComplete?: boolean;
  /**
   * Persisted `chat_messages.id` from BE (KAZI-254).
   * Local optimistic ids stay on `id` until history merge; feedback uses this.
   */
  serverMessageId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// Credits types
export interface CreditBalance {
  cvCredits: number;
  interviewCredits: number;
}

export interface BillingSummary {
  credits?: {
    balance?: number;
    by_bucket?: Record<string, number>;
  };
  entitlements?: unknown[];
}

export interface CurrentPlan {
  plan_type?: string;
  is_locked?: boolean;
  summary?: {
    title?: string;
    days_total?: number;
    days_completed?: number;
  };
  upgrade_hint?: string;
}

export interface LedgerEntry {
  id: string;
  type: 'cv_consume' | 'interview_consume' | 'cv_recharge' | 'interview_recharge' | 'welcome_gift' | 'pro_recharge';
  amount: number;
  description?: string;
  price?: number;
  createdAt: string;
}

// Subscription types
export interface Subscription {
  plan: 'free' | 'pro' | 'sprint';
  expiresAt?: string;
  sprintDays?: number;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errorCode?: string;
  /** HTTP status when success is false (KAZI-186 / LLM_BUSY). */
  status?: number;
  /**
   * Parsed `Retry-After` seconds when present on error responses only.
   * Prefer `parseRetryAfterSeconds` — delay-seconds or HTTP-date.
   */
  retryAfter?: number;
}

export interface OtpRequestResponse {
  success: boolean;
  message?: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  token: string;
  user: User;
  home_api_base?: string;
  data_region?: 'cn-mainland' | 'global';
  directory_version?: number;
}

export interface TelegramWebappResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  is_new_user: boolean;
  expires_in: number;
  home_api_base?: string;
  data_region?: 'cn-mainland' | 'global';
  directory_version?: number;
}

// Agent Hub types (API Spec §13)
export interface ActiveAgentState {
  active_agent: string | null;
  session_id: string | null;
  master_session_id?: string | null;
  activated_at?: string;
  context_module?: string | null;
  resumed?: boolean;
}

export interface ActivateAgentResponse {
  agent_id: string;
  session_id: string;
  master_session_id?: string;
  resumed?: boolean;
  greeting: string;
  next_actions?: ChatNextAction[];
  response?: {
    text?: string;
    next_actions?: ChatNextAction[];
    cards?: ChatJobCard[];
    meta?: AgentChatMeta;
  };
  meta?: AgentChatMeta;
  context_summary?: {
    master_messages_passed?: number;
    profile_fields_shared?: string[];
  };
}

export interface DeactivateAgentResponse {
  deactivated_agent: string;
  return_message: string;
  session_summary?: {
    duration_minutes?: number;
    messages_exchanged?: number;
    artifacts_created?: string[];
  };
}

export interface ExitAgentSessionResponse extends DeactivateAgentResponse {
  status?: 'already_exited';
  agent_id?: string;
  session_id?: string | null;
}

export type OpenAgentSessionOptions = {
  master_session_id?: string;
  handoff_message?: string;
  job_id?: string;
  /** Lifecycle-Park: clear parked / resume Current (sessions/open). */
  space_id?: string;
};

export type NewAgentSessionOptions = OpenAgentSessionOptions & {
  confirm_abandon?: boolean;
};

export interface AgentChatMeta {
  cv_preview_markdown?: string;
  cv_content?: string;
  document_id?: number | string | null;
  diff?: unknown | null;
  pipeline_state?: string;
  buttons?: string[];
  error_code?: string;
  paywall_source?: string;
  event?: string;
  analysis?: {
    cv_analysis?: {
      parsed_sections?: Record<string, string>;
      parsed?: boolean;
      skipped?: boolean;
    };
  };
}

export interface AgentChatResponse {
  message_id?: string;
  agent_id?: string;
  session_id?: string;
  exited?: boolean;
  exited_agent?: string;
  exit_reason?: string;
  suggested_next_steps?: string[];
  pending_transition?: {
    kind?: string;
    from_agent_id?: string;
    to_agent_id?: string;
    prompt?: string;
    trigger_message_id?: string;
    confirm_action?: { activate_agent?: string };
    cancel_action?: { continue_agent?: string };
  };
  response?: {
    text?: string;
    next_actions?: ChatNextAction[];
    cards?: ChatJobCard[];
    meta?: AgentChatMeta;
  };
  meta?: AgentChatMeta;
  reply?: string;
  credits_consumed?: number;
  idempotent_replay?: boolean;
}

export interface AgentSessionSummary {
  session_id: string;
  agent_id: string;
  status: 'active' | 'exited' | string;
  pipeline_state?: string | null;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  /**
   * KAZI-269 / Lifecycle-Park: Current session yielded to Clinic/delivery.
   * Still `status=active`; not a separate status enum.
   */
  parked?: boolean;
  /** When present, delivery sessions are never treated as Park UI targets. */
  lifecycle_kind?: 'interactive' | 'delivery';
}

export interface AgentSessionsListResponse {
  sessions: AgentSessionSummary[];
}

export interface AgentMessagesResponse {
  session_id: string;
  agent_id: string;
  status?: string;
  pipeline_state?: string | null;
  messages: ChatMessage[];
  has_more?: boolean;
}

export type {
  JobDetailResponse,
  JobMatchAnalysis,
  JobMatchLevel,
  JobPrimaryCtaValue,
  JobRecommendationItem,
  JobRecommendationsResponse,
} from './jobs';

export type { MatchAnalysisScores as JobMatchScores } from './api-schema';

// CV Builder (KAZI-23 / API §6)
export type { CvChatRequest, CvChatResponse, CvDiffChange, CvDiffPayload } from './api-schema';

export type {
  NextBestActionItem,
  NextBestActionResponse,
} from './nba';

export interface CvChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  workflow?: import('./chat-envelope').AssistantWorkflow;
  nextActions?: import('./chat-envelope').ChatNextAction[];
  cards?: import('./chat-envelope').ChatJobCard[];
}

// Mock Interview (KAZI-25 / API §7)
export type InterviewQuestion = import('./api-schema').InterviewQuestionBlock;

export interface CreateInterviewSessionRequest {
  target_role: string;
  interview_level: string;
  source_channel?: string;
  answer_mode?: string;
  job_id?: string;
}

export type { CreateInterviewSessionResponse, InterviewPrepCard } from './api-schema';
export type {
  InterviewCta,
  InterviewCtaType,
  InterviewJobContext,
  InterviewWeaknessTag,
  PrepAckAction,
  PrepAckRequest,
  PrepAckResponse,
} from './interview-contract';

export interface CreateInterviewSessionResponseExtended {
  prep_ack_required?: boolean;
  mode?: string;
  job_id?: string | null;
  target_role?: string;
}

export interface SubmitInterviewAnswerRequest {
  question_id: string;
  answer_text: string;
}

export interface SubmitInterviewAnswerResponse {
  session_id: string;
  status: string;
  loading_hint?: string;
  next_question?: InterviewQuestion;
}

export interface InterviewFeedbackSummary {
  scores?: {
    clarity?: number;
    relevance?: number;
    confidence?: number;
  };
  overall_summary?: string;
  strengths?: string[];
  improvements?: string[];
  sample_better_answer?: string;
  next_step?: string;
  weakness_tags?: import('./interview-contract').InterviewWeaknessTag[];
  tier?: 'free' | 'pro';
}

/** KAZI-135/137 — BE-rendered feedback turn (Chat Envelope SSOT). */
export interface InterviewAssistantResponse {
  content?: string;
  next_actions?: ChatNextAction[];
  workflow?: AssistantWorkflow;
  cards?: ChatJobCard[];
}

export interface InterviewSessionDetail {
  session_id: string;
  status: string;
  target_role?: string;
  feedback_summary?: InterviewFeedbackSummary;
  assistant_response?: InterviewAssistantResponse;
  message?: string;
  ctas?: import('./interview-contract').InterviewCta[];
  job_id?: string | null;
  prep_ack_required?: boolean;
  prep_card?: import('./api-schema').InterviewPrepCard | null;
}

export interface InterviewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  workflow?: import('./chat-envelope').AssistantWorkflow;
  nextActions?: import('./chat-envelope').ChatNextAction[];
  cards?: import('./chat-envelope').ChatJobCard[];
}

export type {
  InterviewProfile,
  InterviewProfileStatus,
  InterviewReadinessCheckRequest,
  InterviewReadinessResult,
  InterviewReadinessSummary,
  InterviewScoringMethod,
  IrpCtaHint,
  IrpCtaType,
  IrpDimensionKey,
  IrpDimensionScore,
  IrpDimensions,
  IrpProfileHistory,
  IrpProfileHistoryItem,
  IrpProfileTags,
  ReadinessCheckSource,
  ReadinessGapItem,
  ReadinessTier,
} from './interview-profile';

export { IRP_DIMENSION_ORDER, parseReadinessCheckSource } from './interview-profile';

export type {
  EnglishAssessmentCompleteResult,
  EnglishAssessmentItem,
  EnglishAssessmentSession,
  EnglishAssessmentVariant,
  EnglishCareerGoal,
  EnglishCtaHint,
  EnglishCtaType,
  EnglishDimensionKey,
  EnglishDimensionScore,
  EnglishDimensions,
  EnglishOnboardingRequest,
  EnglishProfile,
  EnglishProfileDelta,
  EnglishProfileHistory,
  EnglishProfileHistoryItem,
  EnglishProfileStatus,
  EnglishProfileTags,
  EnglishProficiencySummary,
  EnglishSampleJobMatch,
  EnglishSampleJobPreview,
  EnglishSampleJobs,
  EnglishSampleJobUnlock,
  EnglishSelfAssessedBand,
  EnglishSessionStatus,
  EnglishTrainingFeedback,
  EnglishTrainingSession,
} from './english-profile';

export {
  DEFAULT_ENGLISH_SCENARIO_ID,
  ENGLISH_DIMENSION_ORDER,
} from './english-profile';
