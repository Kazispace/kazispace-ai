import { apiRequest } from '@/lib/api-client';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import type {
  ActivateAgentResponse,
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

function agentMeta(data: AgentChatResponse | ActivateAgentResponse): Record<string, unknown> | undefined {
  const nested = data.response?.meta;
  const top = data.meta;
  const merged =
    top || nested
      ? ({ ...(nested ?? {}), ...(top ?? {}) } as Record<string, unknown>)
      : undefined;
  return merged;
}

/** Merge top-level and `response.meta` (Agent Hub chat returns meta nested). */
export function resolveAgentMeta(
  data: Pick<AgentChatResponse, 'meta' | 'response'> | Pick<ActivateAgentResponse, 'meta' | 'response'>
): AgentChatMeta | undefined {
  return agentMeta(data as AgentChatResponse) as AgentChatMeta | undefined;
}

export function extractCvReplyFromAgent(data: AgentChatResponse): string {
  const envelope = parseAssistantEnvelope(data);
  if (envelope.reply) return envelope.reply;
  if (typeof data.reply === 'string') return data.reply;
  return '';
}

export function extractCvPreviewFromAgent(
  data: AgentChatResponse | ActivateAgentResponse
): CvPreviewContent | null {
  const meta = agentMeta(data as AgentChatResponse);
  const markdown =
    typeof meta?.cv_preview_markdown === 'string'
      ? meta.cv_preview_markdown
      : typeof meta?.cv_content === 'string'
        ? meta.cv_content
        : undefined;
  if (markdown) {
    return { format: 'markdown', content: markdown };
  }
  return null;
}

export function extractCvDiffFromAgent(data: AgentChatResponse): CvDiffPayload | null {
  return normalizeCvDiff(agentMeta(data)?.diff);
}

export function extractPipelineState(
  data:
    | Pick<AgentChatResponse, 'meta' | 'response'>
    | Pick<ActivateAgentResponse, 'meta' | 'response'>
): string | null {
  const raw = resolveAgentMeta(data)?.pipeline_state;
  return typeof raw === 'string' ? raw : null;
}

/** Scan assistant history (newest first) for the latest CV agent meta snapshot. */
export function hydrateCvMetaFromAgentHistory(
  messages: unknown[],
  handlers: {
    setPipelineState: (state: string | null) => void;
    setPreview: (preview: CvPreviewContent | null) => void;
    setDiff: (diff: CvDiffPayload | null) => void;
  }
): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (record.role === 'user') continue;

    const envelope = {
      meta: record.meta as AgentChatMeta | undefined,
      response: record.response as AgentChatResponse['response'],
    };
    if (!resolveAgentMeta(envelope)) continue;

    patchPipelineStateFromMeta(envelope, handlers.setPipelineState);
    const preview = extractCvPreviewFromAgent(envelope);
    if (preview) handlers.setPreview(preview);
    patchDiffFromAgentMeta(envelope, handlers.setDiff);
    return;
  }
}

/** Update pipeline_state when agent meta includes an explicit key. */
export function patchPipelineStateFromMeta(
  data:
    | Pick<AgentChatResponse, 'meta' | 'response'>
    | Pick<ActivateAgentResponse, 'meta' | 'response'>,
  setPipelineState: (state: string | null) => void
): void {
  const meta = resolveAgentMeta(data);
  if (!meta || !Object.prototype.hasOwnProperty.call(meta, 'pipeline_state')) {
    return;
  }
  const raw = meta.pipeline_state;
  setPipelineState(typeof raw === 'string' ? raw : null);
}

/** Update diff only when agent meta includes an explicit `diff` key (null clears the panel). */
export function patchDiffFromAgentMeta(
  data: Pick<AgentChatResponse, 'meta' | 'response'> | Pick<ActivateAgentResponse, 'meta' | 'response'>,
  setDiff: (diff: CvDiffPayload | null) => void
): void {
  const meta = resolveAgentMeta(data);
  if (!meta || !Object.prototype.hasOwnProperty.call(meta, 'diff')) {
    return;
  }
  setDiff(normalizeCvDiff(meta.diff));
}

/** Legacy meta.buttons only; structured CTAs come from `response.next_actions`. */
export function extractCvMetaButtons(data: AgentChatResponse | ActivateAgentResponse): string[] {
  const meta = agentMeta(data as AgentChatResponse);
  if (Array.isArray(meta?.buttons)) {
    return meta.buttons.filter((b): b is string => typeof b === 'string');
  }
  return [];
}

/** @deprecated Use extractCvMetaButtons + parseAgentReply next_actions */
export function extractCvButtonsFromAgent(data: AgentChatResponse): string[] {
  return extractCvMetaButtons(data);
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
