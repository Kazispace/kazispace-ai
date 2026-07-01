import { apiRequest } from '@/lib/api-client';
import type { ApiResponse, CvChatRequest, CvChatResponse } from '@/types';

export async function postCvChat(
  body: CvChatRequest
): Promise<ApiResponse<CvChatResponse>> {
  return apiRequest<CvChatResponse>('/api/v1/cv/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function extractCvReply(data: CvChatResponse): string {
  return (
    data.reply ??
    data.assistant_message ??
    data.message ??
    ''
  );
}

export function extractCvPreview(data: CvChatResponse): string | null {
  return (
    data.preview_html ??
    data.document?.html ??
    data.preview_markdown ??
    data.document?.markdown ??
    data.preview_text ??
    data.document?.content ??
    null
  );
}
