import type { SupportedLocale } from '@/lib/constants';
import type {
  ChatJobCard,
  ChatNextAction,
  LocalizedLabel,
  ParsedAssistantEnvelope,
} from '@/types/chat-envelope';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeNextActions(raw: unknown): ChatNextAction[] {
  if (!Array.isArray(raw)) return [];
  const actions: ChatNextAction[] = [];
  for (const item of raw) {
    const action = asRecord(item);
    if (!action) continue;
    const type =
      typeof action.type === 'string'
        ? action.type
        : typeof action.action === 'string'
          ? action.action
          : null;
    if (!type) continue;
    const label = action.label;
    const entry: ChatNextAction = { type };
    if (typeof label === 'string' || (label && typeof label === 'object')) {
      entry.label = label as LocalizedLabel;
    }
    actions.push(entry);
  }
  return actions;
}

function normalizeJobCards(raw: unknown): ChatJobCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: ChatJobCard[] = [];
  for (const item of raw) {
    const card = asRecord(item);
    if (!card || typeof card.type !== 'string') continue;
    cards.push({
      type: card.type,
      job_id: typeof card.job_id === 'string' ? card.job_id : undefined,
      title: typeof card.title === 'string' ? card.title : undefined,
      company: typeof card.company === 'string' ? card.company : undefined,
      location:
        typeof card.location === 'string' || card.location === null
          ? card.location
          : undefined,
      work_mode:
        typeof card.work_mode === 'string' || card.work_mode === null
          ? card.work_mode
          : undefined,
      salary:
        typeof card.salary === 'string' || card.salary === null
          ? card.salary
          : undefined,
      match_score:
        typeof card.match_score === 'number' ? card.match_score : undefined,
      is_locked:
        typeof card.is_locked === 'boolean' ? card.is_locked : undefined,
      logo_url:
        typeof card.logo_url === 'string' || card.logo_url === null
          ? card.logo_url
          : undefined,
    });
  }
  return cards;
}

/** Resolve CTA label from API envelope (INTEGRATION.md §6). */
export function resolveActionLabel(
  action: ChatNextAction,
  locale: string,
  fallback?: (type: string) => string | undefined
): string {
  const label = action.label;
  if (typeof label === 'string' && label.trim()) return label;
  if (label && typeof label === 'object') {
    const loc = locale as SupportedLocale;
    const localized =
      label[loc] ?? label.en ?? Object.values(label).find((v) => typeof v === 'string');
    if (localized) return localized;
  }
  return fallback?.(action.type) ?? action.type;
}

/** Extract reply text, next_actions, and cards from clinic or agent chat payloads. */
export function parseAssistantEnvelope(data: unknown): ParsedAssistantEnvelope {
  const raw = asRecord(data);
  if (!raw) {
    return { reply: '', nextActions: [], cards: [] };
  }

  const assistant = asRecord(raw.assistant_response);
  const response = asRecord(raw.response);

  const reply =
    (typeof raw.reply === 'string' ? raw.reply : undefined) ??
    (typeof assistant?.content === 'string' ? assistant.content : undefined) ??
    (typeof response?.text === 'string' ? response.text : undefined) ??
    '';

  const nextActions = normalizeNextActions(
    assistant?.next_actions ?? response?.next_actions ?? raw.next_actions
  );
  const cards = normalizeJobCards(
    assistant?.cards ?? response?.cards ?? raw.cards
  );

  return {
    reply,
    intent: typeof raw.intent === 'string' ? raw.intent : undefined,
    nextActions,
    cards: cards.filter((card) => card.type === 'job'),
  };
}
