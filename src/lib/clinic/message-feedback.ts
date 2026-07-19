/**
 * Message feedback API (KAZI-254) — SSOT:
 * kazispace-design/docs/architecture/kazi-message-feedback-api-v0.1.md
 */

import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

export const FEEDBACK_REASONS = [
  'off_topic',
  'inaccurate',
  'shallow',
  'other',
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
export type FeedbackVote = 'up' | 'down';
export type FeedbackSurface = 'clinic' | 'space' | 'agent';

export type MessageFeedbackAttribution = {
  rule_id?: string | null;
  emit?: string | null;
  capability_id?: string | null;
  playbook_id?: string | null;
  gate_code?: string | null;
  gate_first_fail?: string | null;
  gate_degraded?: boolean | null;
  utterance_hash?: string | null;
  reply_hash?: string | null;
};

export type MessageFeedbackResponse = {
  feedback_id?: string | null;
  message_id: string;
  vote: FeedbackVote | null;
  reasons: FeedbackReason[];
  note?: string | null;
  attribution?: MessageFeedbackAttribution | null;
  attribution_missing?: boolean;
  updated_at?: string | null;
};

export type MessageFeedbackState = {
  message_id: string;
  vote: FeedbackVote | null;
  reasons: FeedbackReason[];
  note?: string | null;
  updated_at?: string | null;
};

export type MessageFeedbackUpsertRequest = {
  vote: FeedbackVote;
  reasons?: FeedbackReason[];
  note?: string | null;
  surface?: FeedbackSurface;
  client_message_id?: string | null;
};

/** DB `chat_messages.id` is a numeric string; local placeholders are not. */
export function isServerAssistantMessageId(
  id: string | undefined | null
): id is string {
  if (!id) return false;
  return /^\d+$/.test(id);
}

/** Prefer BE id; fall back to history id when it is already persisted. */
export function resolveFeedbackMessageId(options: {
  serverMessageId?: string | null;
  messageId?: string | null;
}): string | undefined {
  const server = options.serverMessageId?.trim();
  if (isServerAssistantMessageId(server)) return server;
  const local = options.messageId?.trim();
  if (isServerAssistantMessageId(local)) return local;
  return undefined;
}

export function extractAssistantMessageId(
  data: unknown
): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;
  const top = raw.assistant_message_id ?? raw.assistantMessageId;
  if (typeof top === 'string' && top.trim()) return top.trim();
  if (typeof top === 'number' && Number.isFinite(top)) return String(top);

  const envelope = raw.envelope;
  if (envelope && typeof envelope === 'object') {
    const meta = (envelope as Record<string, unknown>).meta;
    if (meta && typeof meta === 'object') {
      const nested =
        (meta as Record<string, unknown>).assistant_message_id ??
        (meta as Record<string, unknown>).assistantMessageId;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
      if (typeof nested === 'number' && Number.isFinite(nested)) {
        return String(nested);
      }
    }
  }
  return undefined;
}

export function normalizeFeedbackReasons(
  reasons: readonly string[] | undefined
): FeedbackReason[] {
  if (!reasons?.length) return [];
  const allowed = new Set<string>(FEEDBACK_REASONS);
  const unique: FeedbackReason[] = [];
  for (const reason of reasons) {
    if (!allowed.has(reason)) continue;
    const typed = reason as FeedbackReason;
    if (!unique.includes(typed)) unique.push(typed);
  }
  return unique;
}

export function canSubmitDownFeedback(reasons: readonly FeedbackReason[]): boolean {
  return reasons.length >= 1;
}

export async function upsertMessageFeedback(
  messageId: string,
  body: MessageFeedbackUpsertRequest
): Promise<ApiResponse<MessageFeedbackResponse>> {
  const reasons =
    body.vote === 'up' ? [] : normalizeFeedbackReasons(body.reasons);
  return apiRequest<MessageFeedbackResponse>(
    `/api/v1/chat/messages/${encodeURIComponent(messageId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({
        vote: body.vote,
        reasons,
        note: body.note ?? null,
        surface: body.surface ?? 'clinic',
        ...(body.client_message_id
          ? { client_message_id: body.client_message_id }
          : {}),
      }),
    }
  );
}

export async function clearMessageFeedback(
  messageId: string
): Promise<ApiResponse<MessageFeedbackState>> {
  return apiRequest<MessageFeedbackState>(
    `/api/v1/chat/messages/${encodeURIComponent(messageId)}/feedback`,
    { method: 'DELETE' }
  );
}

export async function getMessageFeedback(
  messageId: string
): Promise<ApiResponse<MessageFeedbackState>> {
  return apiRequest<MessageFeedbackState>(
    `/api/v1/chat/messages/${encodeURIComponent(messageId)}/feedback`
  );
}

export function isFeedbackNotReady(
  res: Pick<ApiResponse<unknown>, 'status' | 'errorCode'>
): boolean {
  return res.status === 409 || res.errorCode === 'FEEDBACK_NOT_READY';
}
