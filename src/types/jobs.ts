/** Job Recommendation API types — aligned with Web App API Spec §8. */

export type JobPrimaryCtaValue =
  | 'complete_profile'
  | 'edit_cv'
  | 'start_interview'
  | 'unlock_pro';

export type JobMatchLevel = 'excellent' | 'good' | 'fair';

export interface JobMatchScores {
  skills_match?: number;
  experience_match?: number;
  language_match?: number;
  preference_match?: number;
}

export interface JobMatchAnalysis {
  overall_reason?: string;
  scores?: JobMatchScores;
  why_matched?: string[];
  gap_to_close?: string[];
}

export interface JobRecommendationItem {
  job_id: string;
  title: string;
  company: string;
  logo_url?: string | null;
  location?: string | null;
  work_mode?: string | null;
  salary?: string | null;
  match_score?: number;
  match_level?: JobMatchLevel | string;
  why_matched?: string[];
  gap_to_close?: string[];
  ranking_reason?: string;
  primary_cta?: JobPrimaryCtaValue | string;
  is_locked: boolean;
  is_saved?: boolean;
  source?: string;
  published_at?: string | null;
}

export interface JobRecommendationsResponse {
  items: JobRecommendationItem[];
  is_pro_user: boolean;
  page?: number;
  limit?: number;
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
  match_level?: JobMatchLevel | string;
  why_matched?: string[];
  gap_to_close?: string[];
  match_analysis?: JobMatchAnalysis;
  apply_url?: string | null;
  source_url?: string | null;
  source?: string;
  published_at?: string | null;
  is_saved?: boolean;
  primary_cta?: JobPrimaryCtaValue | string;
  is_pro_user?: boolean;
  pro_features_locked?: boolean;
}
