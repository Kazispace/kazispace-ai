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
  const am = data.assistant_message;
  if (typeof am === 'string') return am;
  if (am && typeof am === 'object' && 'content' in am) {
    return String(am.content ?? '');
  }
  return data.reply ?? data.message ?? '';
}

export type CvPreviewContent =
  | { format: 'html'; content: string }
  | { format: 'markdown'; content: string };

export function extractCvPreview(data: CvChatResponse): CvPreviewContent | null {
  const html = data.preview_html ?? data.document?.html;
  if (html) {
    return { format: 'html', content: html };
  }

  const markdown =
    data.cv_content ??
    data.preview_markdown ??
    data.document?.markdown ??
    data.document?.content ??
    data.preview_text ??
    data.content_markdown;

  if (markdown) {
    return { format: 'markdown', content: markdown };
  }

  return null;
}

export function extractCvButtons(data: CvChatResponse): string[] {
  if (data.buttons?.length) {
    return data.buttons;
  }
  return data.options?.map((o) => o.label).filter(Boolean) ?? [];
}
