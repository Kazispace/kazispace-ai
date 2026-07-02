import { apiRequest } from '@/lib/api-client';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import type {
  AgentChatMeta,
  AgentChatResponse,
  ApiResponse,
  CvChatRequest,
  CvChatResponse,
} from '@/types';
import type { CvDiffPayload, CvDiffChange } from '@/types/api-schema';

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
  if (am && typeof am === 'object' && 'content' in am) {
    return String(am.content ?? '');
  }
  if (typeof am === 'string') return am;
  const legacy = data as Record<string, unknown>;
  if (typeof legacy.reply === 'string') return legacy.reply;
  if (typeof legacy.message === 'string') return legacy.message;
  return '';
}

export type CvPreviewContent =
  | { format: 'html'; content: string }
  | { format: 'markdown'; content: string };

function cvLegacy(data: CvChatResponse): Record<string, unknown> {
  return data as Record<string, unknown>;
}

function cvDocument(data: CvChatResponse): Record<string, unknown> | undefined {
  const doc = cvLegacy(data).document;
  return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : undefined;
}

export function extractCvPreview(data: CvChatResponse): CvPreviewContent | null {
  const legacy = cvLegacy(data);
  const document = cvDocument(data);
  const html =
    (typeof legacy.preview_html === 'string' ? legacy.preview_html : undefined) ??
    (typeof document?.html === 'string' ? document.html : undefined);
  if (html) {
    return { format: 'html', content: html };
  }

  const markdown =
    data.cv_content ??
    (typeof legacy.preview_markdown === 'string' ? legacy.preview_markdown : undefined) ??
    (typeof document?.markdown === 'string' ? document.markdown : undefined) ??
    (typeof document?.content === 'string' ? document.content : undefined) ??
    (typeof legacy.preview_text === 'string' ? legacy.preview_text : undefined) ??
    (typeof legacy.content_markdown === 'string' ? legacy.content_markdown : undefined);

  if (markdown) {
    return { format: 'markdown', content: markdown };
  }

  return null;
}

export function extractCvButtons(data: CvChatResponse): string[] {
  if (data.buttons?.length) {
    return data.buttons;
  }
  const options = cvLegacy(data).options;
  if (!Array.isArray(options)) return [];
  return options
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = (item as { label?: unknown }).label;
      return typeof label === 'string' ? label : null;
    })
    .filter((label): label is string => Boolean(label));
}

export function extractCvDiff(data: CvChatResponse): CvDiffPayload | null {
  return normalizeCvDiff(data.diff);
}

function agentMeta(data: AgentChatResponse): Record<string, unknown> | undefined {
  const meta = data.meta;
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : undefined;
}

export function extractCvReplyFromAgent(data: AgentChatResponse): string {
  const envelope = parseAssistantEnvelope(data);
  if (envelope.reply) return envelope.reply;
  if (typeof data.reply === 'string') return data.reply;
  return '';
}

export function extractCvPreviewFromAgent(
  data: AgentChatResponse
): CvPreviewContent | null {
  const meta = agentMeta(data);
  const markdown =
    typeof meta?.cv_preview_markdown === 'string'
      ? meta.cv_preview_markdown
      : undefined;
  if (markdown) {
    return { format: 'markdown', content: markdown };
  }
  return null;
}

export function extractCvDiffFromAgent(data: AgentChatResponse): CvDiffPayload | null {
  return normalizeCvDiff(agentMeta(data)?.diff);
}

/** Update diff only when agent meta includes an explicit `diff` key (null clears the panel). */
export function patchDiffFromAgentMeta(
  data: { meta?: AgentChatMeta | null },
  setDiff: (diff: CvDiffPayload | null) => void
): void {
  const meta = data.meta;
  if (!meta || !Object.prototype.hasOwnProperty.call(meta, 'diff')) {
    return;
  }
  setDiff(normalizeCvDiff(meta.diff));
}

export function extractCvButtonsFromAgent(data: AgentChatResponse): string[] {
  const meta = agentMeta(data);
  if (Array.isArray(meta?.buttons)) {
    return meta.buttons.filter((b): b is string => typeof b === 'string');
  }
  const envelope = parseAssistantEnvelope(data);
  return envelope.nextActions
    .map((action) => {
      if (typeof action.label === 'string') return action.label;
      return action.type;
    })
    .filter(Boolean);
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
