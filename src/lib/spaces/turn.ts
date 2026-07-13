import { parseAssistantEnvelope } from '@/lib/chat-envelope';

const PLACEHOLDER_REPLIES = new Set(['…', '...', '\u2026']);

export function isPlaceholderReply(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || PLACEHOLDER_REPLIES.has(trimmed);
}

/** Extract assistant text from POST /spaces/{id}/turn payloads. */
export function resolveSpaceTurnReply(data: unknown): string {
  if (!data || typeof data !== 'object') return '';

  const raw = data as Record<string, unknown>;

  const replyText =
    typeof raw.reply_text === 'string' ? raw.reply_text.trim() : '';
  if (!isPlaceholderReply(replyText)) return replyText;

  const fromRoot = parseAssistantEnvelope(data).reply.trim();
  if (!isPlaceholderReply(fromRoot)) return fromRoot;

  if (raw.envelope) {
    const fromEnvelope = parseAssistantEnvelope(raw.envelope).reply.trim();
    if (!isPlaceholderReply(fromEnvelope)) return fromEnvelope;
  }

  const assistantMessage = raw.assistant_message;
  if (assistantMessage && typeof assistantMessage === 'object') {
    const content = (assistantMessage as Record<string, unknown>).content;
    if (typeof content === 'string' && !isPlaceholderReply(content)) {
      return content.trim();
    }
  }

  return '';
}

export type SpaceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function normalizeSpaceHistoryMessage(
  raw: Record<string, unknown>
): SpaceChatMessage | null {
  const roleRaw = String(raw.role ?? 'assistant');
  const role: 'user' | 'assistant' = roleRaw === 'user' ? 'user' : 'assistant';

  let content =
    (typeof raw.content === 'string' ? raw.content : '') ||
    (typeof raw.text === 'string' ? raw.text : '') ||
    (typeof raw.message === 'string' ? raw.message : '');

  if (!content && raw.assistant_message && typeof raw.assistant_message === 'object') {
    const nested = (raw.assistant_message as Record<string, unknown>).content;
    if (typeof nested === 'string') content = nested;
  }

  content = content.trim();
  if (!content) return null;
  if (role === 'assistant' && isPlaceholderReply(content)) return null;

  return {
    id: String(raw.id ?? raw.message_id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    role,
    content,
  };
}

export function mapSpaceHistoryMessages(messages: unknown[]): SpaceChatMessage[] {
  return messages
    .map((item) =>
      item && typeof item === 'object'
        ? normalizeSpaceHistoryMessage(item as Record<string, unknown>)
        : null
    )
    .filter((message): message is SpaceChatMessage => message != null);
}
