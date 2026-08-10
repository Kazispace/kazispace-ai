import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import { hydrateStrategyPayloadUserLabels } from '@/lib/strategy-select';
import { isServerAssistantMessageId } from '@/lib/clinic/message-feedback';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';

/** Unicode ellipsis (U+2026) and ASCII three-dot placeholder. */
const PLACEHOLDER_REPLIES = new Set(['…', '...']);

export function isPlaceholderReply(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || PLACEHOLDER_REPLIES.has(trimmed);
}

/**
 * Extract text components from ADR-006 SpaceTurnEnvelope.
 * Text still prefers `components[].type=text` for reply copy; job cards are read
 * from `assistant_response.cards` (see `resolveSpaceTurnCards`) — not from
 * envelope.components card entries yet.
 */
export function extractSpaceTurnEnvelopeText(envelope: unknown): string {
  if (!envelope || typeof envelope !== 'object') return '';
  const components = (envelope as Record<string, unknown>).components;
  if (!Array.isArray(components)) return '';

  const parts = components
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const component = item as Record<string, unknown>;
      if (component.type !== 'text' || typeof component.text !== 'string') return '';
      return component.text.trim();
    })
    .filter((text) => text && !isPlaceholderReply(text));

  return parts.join('\n\n');
}

/** Extract assistant text from POST /spaces/{id}/turn payloads. */
export function resolveSpaceTurnReply(data: unknown): string {
  if (!data || typeof data !== 'object') return '';

  const raw = data as Record<string, unknown>;

  const replyText =
    typeof raw.reply_text === 'string' ? raw.reply_text.trim() : '';
  if (!isPlaceholderReply(replyText)) return replyText;

  if (raw.envelope) {
    const fromComponents = extractSpaceTurnEnvelopeText(raw.envelope);
    if (!isPlaceholderReply(fromComponents)) return fromComponents;
  }

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

/**
 * Job cards from Space turn / history.
 * Prefers `assistant_response.cards` (BE passthrough). `parseAssistantEnvelope`
 * does not unwrap nested `envelope`, so we try root then `raw.envelope`.
 */
export function resolveSpaceTurnCards(data: unknown): ChatJobCard[] {
  if (!data || typeof data !== 'object') return [];
  const raw = data as Record<string, unknown>;

  for (const candidate of [data, raw.envelope]) {
    if (!candidate) continue;
    const cards = parseAssistantEnvelope(candidate).cards;
    if (cards.length > 0) return cards;
  }

  return [];
}

/**
 * next_actions from Space turn / history (same unwrap as cards — KAZI-296).
 * Clinic already stores these; Space previously dropped them → dead "click to continue" copy.
 */
export function resolveSpaceTurnNextActions(data: unknown): ChatNextAction[] {
  if (!data || typeof data !== 'object') return [];
  const raw = data as Record<string, unknown>;

  for (const candidate of [data, raw.envelope]) {
    if (!candidate) continue;
    const nextActions = parseAssistantEnvelope(candidate).nextActions;
    if (nextActions.length > 0) return nextActions;
  }

  return [];
}

export function resolveSpaceTurnAssistantMeta(
  data: unknown
): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;

  for (const candidate of [data, raw.envelope]) {
    if (!candidate) continue;
    const meta = parseAssistantEnvelope(candidate).meta;
    if (meta && Object.keys(meta).length > 0) return meta;
  }

  return undefined;
}

export function resolveSpaceTurnCustomComponents(
  data: unknown
): import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[] {
  if (!data || typeof data !== 'object') return [];
  const raw = data as Record<string, unknown>;

  for (const candidate of [data, raw.envelope]) {
    if (!candidate) continue;
    const customComponents = parseAssistantEnvelope(candidate).customComponents;
    if (customComponents && customComponents.length > 0) return customComponents;
  }

  return [];
}

export type SpaceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /**
   * Rich cards from assistant_response (today: job teasers via ChatJobCard).
   * MessageBubble already filters `type === 'job'`; keep ChatJobCard[] so other
   * card types can land here without a Space-only union rewrite.
   */
  cards?: ChatJobCard[];
  /** CTA row from assistant_response.next_actions (KAZI-296). */
  nextActions?: ChatNextAction[];
  /** assistant_response.meta (e.g. recommended_strategy_id for KAZI-400). */
  assistantMeta?: Record<string, unknown>;
  /** english_tutor Cap custom_components (KAZI-502). */
  customComponents?: import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[];
  /** Present on optimistic local turns (KAZI-186 retry). */
  status?: 'sending' | 'sent' | 'failed';
  /** Persisted chat_messages.id for feedback (KAZI-254). */
  serverMessageId?: string;
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

  const cards =
    role === 'assistant' ? resolveSpaceTurnCards(raw) : [];
  const nextActions =
    role === 'assistant' ? resolveSpaceTurnNextActions(raw) : [];
  const assistantMeta =
    role === 'assistant' ? resolveSpaceTurnAssistantMeta(raw) : undefined;
  const customComponents =
    role === 'assistant' ? resolveSpaceTurnCustomComponents(raw) : [];

  return {
    id,
    role,
    content,
    ...(cards.length > 0 ? { cards } : {}),
    ...(nextActions.length > 0 ? { nextActions } : {}),
    ...(assistantMeta ? { assistantMeta } : {}),
    ...(customComponents.length > 0 ? { customComponents } : {}),
    ...(role === 'assistant' && isServerAssistantMessageId(id)
      ? { serverMessageId: id }
      : {}),
  };
}

export function mapSpaceHistoryMessages(
  messages: unknown[],
  locale?: string
): SpaceChatMessage[] {
  const mapped = messages
    .map((item, index) =>
      item && typeof item === 'object'
        ? normalizeSpaceHistoryMessage(item as Record<string, unknown>, index)
        : null
    )
    .filter((message): message is SpaceChatMessage => message != null);
  return locale ? hydrateStrategyPayloadUserLabels(mapped, locale) : mapped;
}

function assistantContentKey(content: string): string {
  return content.trim();
}

/**
 * First non-placeholder assistant after the **last** user turn (position-based).
 * Prefer this over content matching — duplicate utterances / in-flight turns
 * are ambiguous when keyed only by text.
 */
export function latestAssistantAfterLastUser(
  messages: SpaceChatMessage[]
): string {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) return '';

  for (let index = lastUserIndex + 1; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role === 'assistant' && !isPlaceholderReply(message.content)) {
      return message.content.trim();
    }
  }
  return '';
}

/** @deprecated Use latestAssistantAfterLastUser — text matching is unreliable. */
export function latestAssistantAfterUser(
  messages: SpaceChatMessage[],
  _userText?: string
): string {
  return latestAssistantAfterLastUser(messages);
}

/** Keep local assistant turns when session history lags behind the turn response. */
export function mergeSpaceMessagesAfterSend(
  local: SpaceChatMessage[],
  fromServer: SpaceChatMessage[]
): SpaceChatMessage[] {
  if (fromServer.length === 0) return local;

  // Position-based: Nth local assistant → Nth server assistant (not content key —
  // duplicate copy like「找到 10 个岗位」must not cross-attach cards / CTAs).
  const localAssistantExtras: {
    cards?: ChatJobCard[];
    nextActions?: ChatNextAction[];
    assistantMeta?: Record<string, unknown>;
    customComponents?: import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[];
  }[] = [];
  for (const message of local) {
    if (message.role !== 'assistant') continue;
    localAssistantExtras.push({
      ...(message.cards && message.cards.length > 0
        ? { cards: message.cards }
        : {}),
      ...(message.nextActions && message.nextActions.length > 0
        ? { nextActions: message.nextActions }
        : {}),
      ...(message.assistantMeta ? { assistantMeta: message.assistantMeta } : {}),
      ...(message.customComponents && message.customComponents.length > 0
        ? { customComponents: message.customComponents }
        : {}),
    });
  }

  let assistantOrdinal = 0;
  const enrichedServer = fromServer.map((message) => {
    if (message.role !== 'assistant') return message;
    const localExtras = localAssistantExtras[assistantOrdinal] ?? {};
    assistantOrdinal += 1;
    let next = message;
    if (!(message.cards && message.cards.length > 0) && localExtras.cards) {
      next = { ...next, cards: localExtras.cards };
    }
    if (
      !(message.nextActions && message.nextActions.length > 0) &&
      localExtras.nextActions
    ) {
      next = { ...next, nextActions: localExtras.nextActions };
    }
    if (!message.assistantMeta && localExtras.assistantMeta) {
      next = { ...next, assistantMeta: localExtras.assistantMeta };
    }
    if (
      !(message.customComponents && message.customComponents.length > 0) &&
      localExtras.customComponents
    ) {
      next = { ...next, customComponents: localExtras.customComponents };
    }
    return next;
  });

  const serverAssistantContents = new Set(
    enrichedServer
      .filter((message) => message.role === 'assistant')
      .map((message) => assistantContentKey(message.content))
  );

  const missingAssistants = local.filter(
    (message) =>
      message.role === 'assistant' &&
      !serverAssistantContents.has(assistantContentKey(message.content))
  );

  if (missingAssistants.length === 0) return enrichedServer;

  return [...enrichedServer, ...missingAssistants];
}
