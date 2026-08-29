import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import { hydrateStrategyPayloadUserLabels } from '@/lib/strategy-select';
import { isServerAssistantMessageId } from '@/lib/clinic/message-feedback';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';
import type { ReferralPayload } from '@/types';
import type { UpgradeCtaPayload } from '@/lib/clinic/upgrade-cta';

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

/**
 * KAZI-651 Phase A — carry a specialist-agent referral on a Space turn, same
 * field shape as Clinic's `parseClinicReply` (root `referral_agent_id`/
 * `referral.agent_id`, or an `intent` starting with `REFERRAL_`).
 *
 * Per docs/openapi.json, `SpaceTurnResponse` today is just `{ envelope }`
 * with no root referral fields or `intent` — so this will not fire against
 * a real Space turn as things stand. It exists as forward groundwork for a
 * Phase C design question: if Clinic's send path is ever unified onto this
 * resolver (rather than staying on `parseClinicReply`), Clinic's raw
 * response *does* carry these fields at root today. Scanning `raw.envelope`
 * too, like the sibling resolvers below, covers the Space-native shape as
 * well in case a future BE revision nests it there instead.
 *
 * Deliberately does NOT apply `isReferralDismissed` here (review on PR
 * #212): that would make this "additive, no behavior change" parser start
 * making a dismiss decision with no UI yet to act on it, and would mean a
 * referral Clinic's user already dismissed shows as permanently absent to
 * Space too (same agentId, same global localStorage map) with no way to
 * tell "never sent" apart from "dismissed". Dismiss-filtering belongs at
 * render time, same as `MessageBubble` already checks `!referral.dismissed`
 * for Clinic — a later phase decides whether Space reads the same map.
 */
export function resolveSpaceTurnReferral(data: unknown): ReferralPayload | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;

  for (const candidate of [raw, raw.envelope]) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;

    const referralRecord =
      record.referral && typeof record.referral === 'object'
        ? (record.referral as Record<string, unknown>)
        : undefined;

    let agentId =
      (typeof record.referral_agent_id === 'string' && record.referral_agent_id) ||
      (typeof referralRecord?.agent_id === 'string' ? referralRecord.agent_id : '');
    const reason =
      (typeof record.referral_reason === 'string' && record.referral_reason) ||
      (typeof referralRecord?.reason === 'string' ? referralRecord.reason : '') ||
      '';

    if (
      !agentId &&
      typeof record.intent === 'string' &&
      record.intent.startsWith('REFERRAL_')
    ) {
      agentId = record.intent.replace(/^REFERRAL_/, '');
    }

    if (agentId) return { agentId, reason };
  }

  return undefined;
}

/**
 * KAZI-651 Phase A — carry the web_search -> research upgrade CTA (KAZI-233)
 * on a Space turn. `parseAssistantEnvelope` already extracts this generically
 * from `meta.upgrade_cta`/`meta.cta`, scanning `[data, raw.envelope]` exactly
 * like `resolveSpaceTurnAssistantMeta` above — Space's sendMessage flow just
 * never read it back out. Unlike referral (see resolveSpaceTurnReferral),
 * `meta.upgrade_cta` under `assistant_response`/`envelope` is a passthrough
 * path Space turns already use for cards/next_actions/assistantMeta, so this
 * one plausibly *can* fire against a real Space turn today if the BE ever
 * populates it — it isn't purely aspirational the way the referral path is.
 *
 * Same caveat as cards (space-job-cards-cache.ts): whether `GET
 * .../messages` echoes `meta.upgrade_cta` back on history rows is
 * unverified — this phase doesn't add cache/rehydration for it the way
 * cards has, so a value present on a live send may not survive a cold
 * history reload. Same class of gap, not fixed here.
 */
export function resolveSpaceTurnUpgradeCta(data: unknown): UpgradeCtaPayload | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;

  for (const candidate of [data, raw.envelope]) {
    if (!candidate) continue;
    const upgradeCta = parseAssistantEnvelope(candidate).upgradeCta;
    if (upgradeCta) return upgradeCta;
  }

  return undefined;
}

export type SpaceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** KAZI-580 — older history row waiting for scroll hydrate. */
  contentPending?: boolean;
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
  /**
   * KAZI-651 Phase A — specialist-agent referral, carried but not yet
   * rendered by any Space UI (see resolveSpaceTurnReferral).
   */
  referral?: ReferralPayload;
  /**
   * KAZI-651 Phase A — web_search -> research upgrade CTA, carried but not
   * yet rendered by any Space UI (see resolveSpaceTurnUpgradeCta).
   */
  upgradeCta?: UpgradeCtaPayload;
  // Deliberately no `spaceNudge` field here: its premise (KAZI-181, "Clinic
  // -> Space progressive nudge") is nudging the user to leave Clinic and
  // create a Space, which is incoherent on a turn a Space itself already
  // produced. This is scoped out of Phase A by design, not an oversight —
  // whether the concept gets redefined or dropped is a Phase B product
  // decision (see KAZI-651).
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

function rawHistoryMessageId(raw: Record<string, unknown>): string {
  if (typeof raw.id === 'string' && raw.id) return raw.id;
  if (typeof raw.message_id === 'string' && raw.message_id) return raw.message_id;
  if (typeof raw.id === 'number') return String(raw.id);
  if (typeof raw.message_id === 'number') return String(raw.message_id);
  return '';
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
  const rawId = rawHistoryMessageId(raw);
  if (raw.content_pending === true && rawId) {
    return { id: rawId, role, content: '', contentPending: true };
  }
  if (!content) return null;
  if (role === 'assistant' && isPlaceholderReply(content)) return null;

  const id = rawId || stableMessageIdFallback(role, content, index);

  const cards =
    role === 'assistant' ? resolveSpaceTurnCards(raw) : [];
  const nextActions =
    role === 'assistant' ? resolveSpaceTurnNextActions(raw) : [];
  const assistantMeta =
    role === 'assistant' ? resolveSpaceTurnAssistantMeta(raw) : undefined;
  const customComponents =
    role === 'assistant' ? resolveSpaceTurnCustomComponents(raw) : [];
  const referral =
    role === 'assistant' ? resolveSpaceTurnReferral(raw) : undefined;
  const upgradeCta =
    role === 'assistant' ? resolveSpaceTurnUpgradeCta(raw) : undefined;

  return {
    id,
    role,
    content,
    ...(cards.length > 0 ? { cards } : {}),
    ...(nextActions.length > 0 ? { nextActions } : {}),
    ...(assistantMeta ? { assistantMeta } : {}),
    ...(customComponents.length > 0 ? { customComponents } : {}),
    ...(referral ? { referral } : {}),
    ...(upgradeCta ? { upgradeCta } : {}),
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
    referral?: ReferralPayload;
    upgradeCta?: UpgradeCtaPayload;
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
      ...(message.referral ? { referral: message.referral } : {}),
      ...(message.upgradeCta ? { upgradeCta: message.upgradeCta } : {}),
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
    if (!message.referral && localExtras.referral) {
      next = { ...next, referral: localExtras.referral };
    }
    if (!message.upgradeCta && localExtras.upgradeCta) {
      next = { ...next, upgradeCta: localExtras.upgradeCta };
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
