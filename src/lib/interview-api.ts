import { apiRequest } from '@/lib/api-client';
import type {
  ApiResponse,
  CreateInterviewSessionRequest,
  CreateInterviewSessionResponse,
  InterviewSessionDetail,
  SubmitInterviewAnswerRequest,
  SubmitInterviewAnswerResponse,
} from '@/types';

export async function createInterviewSession(
  body: CreateInterviewSessionRequest
): Promise<ApiResponse<CreateInterviewSessionResponse>> {
  return apiRequest<CreateInterviewSessionResponse>('/api/v1/interview/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitInterviewAnswer(
  sessionId: string,
  body: SubmitInterviewAnswerRequest
): Promise<ApiResponse<SubmitInterviewAnswerResponse>> {
  return apiRequest<SubmitInterviewAnswerResponse>(
    `/api/v1/interview/sessions/${encodeURIComponent(sessionId)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function getInterviewSession(
  sessionId: string
): Promise<ApiResponse<InterviewSessionDetail>> {
  return apiRequest<InterviewSessionDetail>(
    `/api/v1/interview/sessions/${encodeURIComponent(sessionId)}`
  );
}
