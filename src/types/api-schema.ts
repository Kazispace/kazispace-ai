/** Re-exports of OpenAPI component schemas (KAZI-35). Source: `npm run gen:api`. */
import type { components } from './api.generated';

type Schemas = components['schemas'];

export type CvEditRequest = Schemas['CvEditRequest'];

export type CreateInterviewSessionResponse = Schemas['CreateInterviewSessionResponse'];
export type InterviewPrepCard = Schemas['InterviewPrepCard'];
export type InterviewQuestionBlock = Schemas['InterviewQuestionBlock'];

export type JobDetailResponse = Schemas['JobDetailResponse'];
export type JobRecommendationItem = Schemas['JobRecommendationItem'];
export type JobRecommendationsResponse = Schemas['JobRecommendationsResponse'];
export type MatchAnalysisBlock = Schemas['MatchAnalysisBlock'];
export type MatchAnalysisScores = Schemas['MatchAnalysisScores'];

/**
 * CV types — kept as local definitions after backend consolidated
 * its OpenAPI schemas. These mirror the shapes used by cv-api.ts.
 */
export interface CvDiffChange {
  path: string;
  before?: string | null;
  after?: string | null;
}

export interface CvDiffPayload {
  added: string[];
  removed: string[];
  modified: CvDiffChange[];
}

export interface CvChatRequest {
  session_id?: string | null;
  message: string;
  document_id?: number | null;
}

export interface CvChatResponse {
  reply?: string;
  diff?: CvDiffPayload | null;
  preview?: { content: string; format?: string } | null;
  document_id?: number | null;
  pipeline_state?: string | null;
}
