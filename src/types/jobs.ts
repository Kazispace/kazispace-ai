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
  | 'unlock_pro';

export type JobMatchLevel = 'excellent' | 'good' | 'fair';
