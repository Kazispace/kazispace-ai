/** IRP Profile API §7.7 — Phase 1.5 (KAZI-59) */

export type InterviewProfileStatus = 'empty' | 'provisional' | 'formal';

export type InterviewScoringMethod =
  | 'heuristic_v1'
  | 'llm_dimensions_v1'
  | 'evaluator_v2';

export type IrpDimensionKey =
  | 'content_quality'
  | 'expression_logic'
  | 'language_ability'
  | 'behavioral_presence'
  | 'stress_handling'
  | 'industry_depth';

export interface IrpDimensionScore {
  score: number;
  label: string;
  delta_last_round?: number | null;
}

export type IrpDimensions = Record<IrpDimensionKey, IrpDimensionScore>;

export type IrpCtaType =
  | 'start_training'
  | 'readiness_check'
  | 'growth_history'
  | 'edit_cv'
  | 'view_jobs';

export interface IrpCtaHint {
  cta_type: IrpCtaType;
  label: string;
  primary?: boolean;
  job_id?: string | null;
  /** From BE legacy `complete_N_more_rounds_for_formal` hint. */
  formal_rounds_remaining?: number;
}

export interface IrpStrengthTag {
  tag: string;
  label: string;
  stars?: number;
}

export interface IrpImprovementTag {
  tag: string;
  label: string;
  severity?: string;
}

export interface IrpUnlockedSkill {
  skill_id: string;
  label: string;
}

export interface IrpProfileTags {
  strengths?: IrpStrengthTag[];
  improvements?: IrpImprovementTag[];
  unlocked_skills?: IrpUnlockedSkill[];
}

export interface InterviewProfile {
  profile_status: InterviewProfileStatus;
  scoring_method?: InterviewScoringMethod;
  level?: number;
  level_name?: string;
  level_progress_pct?: number;
  composite_score?: number;
  total_training_rounds?: number;
  dimensions?: Partial<IrpDimensions>;
  tags?: IrpProfileTags;
  target_job_id?: string | null;
  cta_hints?: IrpCtaHint[];
  disclaimer?: string | null;
  updated_at?: string;
}

export interface IrpProfileHistoryItem {
  version: number;
  session_id?: string;
  level?: number;
  composite_score?: number;
  milestones?: Array<{
    type: string;
    from?: number;
    to?: number;
  }>;
  created_at: string;
}

export interface IrpProfileHistory {
  items: IrpProfileHistoryItem[];
  badges: Array<{
    badge_id: string;
    label: string;
    earned_at?: string;
  }>;
}

export type ReadinessTier =
  | 'large_gap'
  | 'needs_prep'
  | 'competitive'
  | 'strong'
  | 'dominant';

export interface ReadinessGapItem {
  dimension: IrpDimensionKey | string;
  label: string;
  impact_points?: number;
  recommendation?: string;
}

export interface ReadinessTrainingRecommendation {
  type: string;
  rounds?: number;
  job_id?: string;
}

export interface InterviewReadinessResult {
  job_id?: string;
  readiness_score_pct: number | null;
  readiness_tier?: ReadinessTier | null;
  disclaimer?: string | null;
  gap_analysis?: ReadinessGapItem[];
  recommended_training?: ReadinessTrainingRecommendation[];
  free_tier_remaining_today?: number | null;
}

export interface InterviewReadinessSummary {
  profile_status: InterviewProfileStatus;
  level?: number;
  level_name?: string;
  total_training_rounds?: number;
}

export interface InterviewReadinessCheckRequest {
  job_id: string;
}

export const IRP_DIMENSION_ORDER: IrpDimensionKey[] = [
  'content_quality',
  'expression_logic',
  'language_ability',
  'behavioral_presence',
  'stress_handling',
  'industry_depth',
];
