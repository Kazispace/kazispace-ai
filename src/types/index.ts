// User types
// API path types: run `npm run gen:api` → src/types/api.generated.ts (from docs/openapi.json)

export interface User {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  country?: string;
  careerGoal?: string;
  targetRole?: string;
  englishLevel?: string;
  currentStatus?: string;
  education?: string;
  experience?: string;
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
export interface ReferralPayload {
  agentId: string;
  reason: string;
  dismissed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sessionId: string;
  intent?: string;
  status?: 'sending' | 'sent' | 'failed';
  referral?: ReferralPayload;
  streamComplete?: boolean;
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
}

export interface OtpRequestResponse {
  success: boolean;
  message?: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface TelegramWebappResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  is_new_user: boolean;
  expires_in: number;
}

// Agent Hub types (API Spec §13)
export interface ActiveAgentState {
  active_agent: string | null;
  session_id: string | null;
  activated_at?: string;
  context_module?: string | null;
}

export interface ActivateAgentResponse {
  agent_id: string;
  session_id: string;
  greeting: string;
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

export interface AgentChatResponse {
  message_id?: string;
  agent_id?: string;
  response?: { text?: string };
  reply?: string;
  credits_consumed?: number;
}

export interface AgentMessagesResponse {
  session_id: string;
  agent_id: string;
  messages: ChatMessage[];
  has_more?: boolean;
}

// Jobs (KAZI-24 / API §8)
export interface JobRecommendationItem {
  job_id: string;
  title: string;
  company: string;
  logo_url?: string | null;
  location?: string | null;
  work_mode?: string | null;
  salary?: string | null;
  match_score?: number;
  match_level?: string;
  why_matched?: string[];
  gap_to_close?: string[];
  primary_cta?: string;
  is_locked: boolean;
  is_saved?: boolean;
  source?: string;
  published_at?: string | null;
}

export interface JobRecommendationsResponse {
  items: JobRecommendationItem[];
  is_pro_user: boolean;
  page: number;
  limit: number;
  total?: number;
  engine_total?: number;
  upgrade_hint?: string;
}

export interface JobDetailResponse {
  job_id: string;
  title: string;
  company: string;
  logo_url?: string | null;
  location?: string | null;
  work_mode?: string | null;
  salary?: string | null;
  description_text?: string;
  required_skills?: string[];
  match_score?: number;
  why_matched?: string[];
  gap_to_close?: string[];
  apply_url?: string | null;
  primary_cta?: string;
  is_pro_user?: boolean;
  pro_features_locked?: boolean;
  match_analysis?: {
    overall_reason?: string;
    why_matched?: string[];
    gap_to_close?: string[];
  };
}

// Mock Interview (KAZI-25 / API §7)
export interface InterviewQuestion {
  question_id: string;
  category: string;
  content: string;
}

export interface CreateInterviewSessionRequest {
  target_role: string;
  interview_level: string;
  source_channel?: string;
  answer_mode?: string;
}

export interface CreateInterviewSessionResponse {
  session_id: string;
  status: string;
  interview_level?: string;
  question_index?: number;
  question_count?: number;
  language_notice?: string;
  question?: InterviewQuestion;
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
}

export interface InterviewSessionDetail {
  session_id: string;
  status: string;
  target_role?: string;
  feedback_summary?: InterviewFeedbackSummary;
  message?: string;
}

export interface InterviewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}
