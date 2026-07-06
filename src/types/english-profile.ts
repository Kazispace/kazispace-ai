export type EnglishProfileStatus = 'empty' | 'ready' | 'active';

export type EnglishCtaType =
  | 'start_training'
  | 'retake_assessment'
  | 'view_history'
  | 'view_sample_jobs';

export type EnglishDimensionKey = 'speaking' | 'writing' | 'listening' | 'reading';

export type EnglishAssessmentVariant = 'quick' | 'standard';

export type EnglishSessionStatus = 'in_progress' | 'scoring' | 'completed' | 'failed';

export type EnglishCareerGoal =
  | 'better_job'
  | 'promotion'
  | 'interview_english'
  | 'prove_ability'
  | 'long_term_growth'
  | 'other';

export type EnglishSelfAssessedBand = 'beginner' | 'elementary' | 'intermediate' | 'advanced';

export interface EnglishDimensionScore {
  score: number | null;
  confidence?: 'low' | 'medium' | 'high';
  delta_last_event?: number | null;
  label?: string;
}

export type EnglishDimensions = Record<EnglishDimensionKey, EnglishDimensionScore>;

export interface EnglishCtaHint {
  cta_type: EnglishCtaType;
  label: string;
  primary?: boolean;
  scenario_id?: string;
}

export interface EnglishProfileTags {
  strengths?: string[];
  improvements?: string[];
  unlocked_skills?: string[];
}

export interface EnglishProfile {
  profile_status: EnglishProfileStatus;
  scoring_method?: string;
  display_level: number;
  peak_level?: number;
  level_name?: string | null;
  level_progress_pct?: number | null;
  level_locked?: boolean;
  composite_score?: number | null;
  career_goal?: EnglishCareerGoal | string | null;
  self_assessed_band?: EnglishSelfAssessedBand | string | null;
  assessment_variant?: EnglishAssessmentVariant | null;
  dimensions?: Partial<EnglishDimensions>;
  subdimensions?: Record<string, { score: number }>;
  tags?: EnglishProfileTags;
  total_training_sessions?: number;
  cta_hints?: EnglishCtaHint[];
  updated_at?: string;
}

export interface EnglishProficiencySummary {
  profile_status: EnglishProfileStatus;
  display_level: number;
  level_name?: string | null;
  total_training_sessions?: number;
}

export interface EnglishProfileHistoryItem {
  version: number;
  source_type: 'assessment' | 'training';
  source_id?: string | null;
  display_level: number;
  composite_score?: number | null;
  created_at: string;
}

export interface EnglishProfileHistory {
  items: EnglishProfileHistoryItem[];
}

export type EnglishSampleJobMatch = 'eligible' | 'borderline' | 'gap';

export interface EnglishSampleJobPreview {
  title: string;
  required_level: number;
  user_level: number;
  match: EnglishSampleJobMatch;
}

export interface EnglishSampleJobUnlock {
  title: string;
  required_level: number;
  levels_needed: number;
}

export interface EnglishSampleJobs {
  display_level: number;
  eligible_count: number;
  preview_items: EnglishSampleJobPreview[];
  unlock_preview?: EnglishSampleJobUnlock[];
  disclaimer?: string;
}

export interface EnglishOnboardingRequest {
  career_goal: EnglishCareerGoal | string;
  self_assessed_band: EnglishSelfAssessedBand | string;
}

export interface EnglishAssessmentItem {
  index: number;
  type: 'speaking' | 'writing';
  prompt: string;
  max_duration_sec?: number;
  min_words?: number;
  max_words?: number;
}

export interface EnglishAssessmentSession {
  session_id: string;
  variant: EnglishAssessmentVariant;
  status: EnglishSessionStatus;
  items: EnglishAssessmentItem[];
  profile?: EnglishProfile;
}

export interface EnglishAssessmentCompleteResult {
  profile: EnglishProfile;
  sample_jobs?: EnglishSampleJobs;
}

export interface EnglishTrainingFeedback {
  summary: string;
  dimension_scores?: Record<string, number>;
}

export interface EnglishProfileDelta {
  display_level?: number;
  dimensions?: Partial<EnglishDimensions>;
}

export interface EnglishTrainingSession {
  session_id: string;
  status: EnglishSessionStatus;
  prompt?: string;
  items?: EnglishAssessmentItem[];
  feedback?: EnglishTrainingFeedback;
  profile_delta?: EnglishProfileDelta;
  profile?: EnglishProfile;
}

export const ENGLISH_DIMENSION_ORDER: EnglishDimensionKey[] = [
  'speaking',
  'writing',
  'listening',
  'reading',
];

export const DEFAULT_ENGLISH_SCENARIO_ID = 'workplace_oral_interview_intro_v1';
