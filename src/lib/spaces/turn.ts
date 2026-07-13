import { parseAssistantEnvelope } from '@/lib/chat-envelope';

/** Unicode ellipsis (U+2026) and ASCII three-dot placeholder. */
const PLACEHOLDER_REPLIES = new Set(['…', '...']);

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

  // Clinic-style turns may flatten assistant_response / reply on the root payload.
  const fromFlattenedTurn = parseAssistantEnvelope(data).reply.trim();
  if (!isPlaceholderReply(fromFlattenedTurn)) return fromFlattenedTurn;

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

function stableMessageIdFallback(
  role: 'user' | 'assistant',
  content: string,
  index: number
): string {
  let hash = 0;
  const key = `${role}\0${content}\0${index}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `msg_${role}_${hash.toString(36)}`;
}

export function normalizeSpaceHistoryMessage(
  raw: Record<string, unknown>,
  index = 0
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

  const id =
    typeof raw.id === 'string' && raw.id
      ? raw.id
      : typeof raw.message_id === 'string' && raw.message_id
        ? raw.message_id
        : stableMessageIdFallback(role, content, index);

  return { id, role, content };
}

export function mapSpaceHistoryMessages(messages: unknown[]): SpaceChatMessage[] {
  return messages
    .map((item, index) =>
      item && typeof item === 'object'
        ? normalizeSpaceHistoryMessage(item as Record<string, unknown>, index)
        : null
    )
    .filter((message): message is SpaceChatMessage => message != null);
}
