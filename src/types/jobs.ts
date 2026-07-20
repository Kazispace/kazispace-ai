/** Job API types — aliases over OpenAPI schemas (KAZI-35). */
export type {
  JobDetailResponse,
  JobRecommendationItem,
  JobRecommendationsResponse,
  MatchAnalysisBlock,
  MatchAnalysisScores,
} from './api-schema';

import type { MatchAnalysisBlock } from './api-schema';

/** @deprecated Use `MatchAnalysisBlock` from api-schema. */
export type JobMatchAnalysis = MatchAnalysisBlock;

export type JobPrimaryCtaValue =
  | 'complete_profile'
  | 'edit_cv'
  | 'start_interview'
  | 'assess_readiness'
  | 'unlock_pro';

export type JobMatchLevel = 'excellent' | 'good' | 'fair';

/** Context for "Practice for this job" from readiness → host chat prompt. */
export type JobPracticeContext = {
  jobId: string;
  jobTitle?: string | null;
  weaknessLabels: string[];
};
