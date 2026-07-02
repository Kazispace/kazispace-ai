import { apiRequest } from '@/lib/api-client';
import type { ApiResponse, CvChatRequest, CvChatResponse } from '@/types';
import type { CvDiffPayload, CvDiffChange } from '@/types/cv-contract';

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

export function extractCvDiff(data: CvChatResponse): CvDiffPayload | null {
  return normalizeCvDiff(data.diff);
}

/** Normalize API diff to KAZI-35 shape; accepts legacy section objects during transition. */
export function normalizeCvDiff(raw: unknown): CvDiffPayload | null {
  if (!raw || typeof raw !== 'object') return null;

  const d = raw as Record<string, unknown>;

  const toStringList = (list: unknown): string[] => {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const row = item as { section?: string; text?: string };
          if (row.text) return `${row.section ?? ''}: ${row.text}`.trim();
          if (row.section) return row.section;
        }
        return null;
      })
      .filter((s): s is string => Boolean(s));
  };

  const toModified = (list: unknown): CvDiffChange[] => {
    if (!Array.isArray(list)) return [];
    return list.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      if (typeof row.path === 'string') {
        return [
          {
            path: row.path,
            before: typeof row.before === 'string' ? row.before : undefined,
            after: typeof row.after === 'string' ? row.after : undefined,
          },
        ];
      }
      if (typeof row.section === 'string') {
        return [
          {
            path: row.section,
            before: typeof row.before === 'string' ? row.before : undefined,
            after: typeof row.after === 'string' ? row.after : undefined,
          },
        ];
      }
      return [];
    });
  };

  const added = toStringList(d.added);
  const removed = toStringList(d.removed);
  const modified = toModified(d.modified);

  const hasContent = added.length > 0 || removed.length > 0 || modified.length > 0;

  return hasContent ? { added, removed, modified } : null;
}
