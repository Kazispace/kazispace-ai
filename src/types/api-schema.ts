/** Re-exports of OpenAPI component schemas (KAZI-35). Source: `npm run gen:api`. */
import type { components } from './api.generated';

type Schemas = components['schemas'];

export type CvAssistantMessage = Schemas['CvAssistantMessage'];
export type CvChatRequest = Schemas['CvChatRequest'];
export type CvChatResponse = Schemas['CvChatResponse'];
export type CvDiffChange = Schemas['CvDiffChange'];
export type CvDiffPayload = Schemas['CvDiffPayload'];

export type CreateInterviewSessionResponse = Schemas['CreateInterviewSessionResponse'];
export type InterviewPrepCard = Schemas['InterviewPrepCard'];
export type InterviewQuestionBlock = Schemas['InterviewQuestionBlock'];

export type JobDetailResponse = Schemas['JobDetailResponse'];
export type JobRecommendationItem = Schemas['JobRecommendationItem'];
export type JobRecommendationsResponse = Schemas['JobRecommendationsResponse'];
export type MatchAnalysisBlock = Schemas['MatchAnalysisBlock'];
export type MatchAnalysisScores = Schemas['MatchAnalysisScores'];
