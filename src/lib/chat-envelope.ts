import type { SupportedLocale } from '@/lib/constants';
import type {
  AssistantWorkflow,
  ChatJobCard,
  ChatNextAction,
  LocalizedLabel,
  ParsedAssistantEnvelope,
  WorkflowStep,
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
    if (typeof action.payload === 'string') {
      entry.payload = action.payload;
    }
    if (typeof action.path === 'string') {
      entry.path = action.path;
    }
    if (typeof action.job_id === 'string') {
      entry.job_id = action.job_id;
    }
    if (typeof action.session_id === 'string') {
      entry.session_id = action.session_id;
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
export function resolveLocalizedLabel(
  label: LocalizedLabel | undefined,
  locale: string,
  fallback?: string
): string {
  if (typeof label === 'string' && label.trim()) return label;
  if (label && typeof label === 'object') {
    const loc = locale as SupportedLocale;
    const localized =
      label[loc] ?? label.en ?? Object.values(label).find((v) => typeof v === 'string');
    if (localized) return localized;
  }
  return fallback ?? '';
}

function normalizeWorkflowStep(raw: unknown): WorkflowStep | null {
  const step = asRecord(raw);
  if (!step || typeof step.id !== 'string') return null;
  const status = step.status;
  if (
    status !== 'pending' &&
    status !== 'current' &&
    status !== 'done' &&
    status !== 'skipped'
  ) {
    return null;
  }
  const entry: WorkflowStep = { id: step.id, status };
  if (typeof step.label === 'string' || (step.label && typeof step.label === 'object')) {
    entry.label = step.label as LocalizedLabel;
  }
  if (typeof step.detail === 'string' || (step.detail && typeof step.detail === 'object')) {
    entry.detail = step.detail as LocalizedLabel;
  }
  return entry;
}

function normalizeWorkflow(raw: unknown): AssistantWorkflow | undefined {
  const wf = asRecord(raw);
  if (!wf || typeof wf.agent_id !== 'string' || typeof wf.pipeline_state !== 'string') {
    return undefined;
  }
  if (!Array.isArray(wf.steps) || wf.steps.length === 0) return undefined;

  const steps: WorkflowStep[] = [];
  for (const item of wf.steps) {
    const step = normalizeWorkflowStep(item);
    if (step) steps.push(step);
  }
  if (steps.length === 0) return undefined;

  const workflow: AssistantWorkflow = {
    agent_id: wf.agent_id,
    pipeline_state: wf.pipeline_state,
    steps,
  };
  if (typeof wf.progress_pct === 'number' && Number.isFinite(wf.progress_pct)) {
    workflow.progress_pct = Math.max(0, Math.min(100, Math.round(wf.progress_pct)));
  }
  return workflow;
}

/** Resolve CTA label from API envelope (INTEGRATION.md §6). */
export function resolveActionLabel(
  action: ChatNextAction,
  locale: string,
  fallback?: (type: string) => string | undefined
): string {
  const fromLabel = resolveLocalizedLabel(action.label, locale);
  if (fromLabel) return fromLabel;
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

  const workflow = normalizeWorkflow(
    assistant?.workflow ?? response?.workflow ?? raw.workflow
  );

  const suggestedRaw = raw.suggested_next_steps ?? assistant?.suggested_next_steps;
  const suggestedNextSteps = Array.isArray(suggestedRaw)
    ? suggestedRaw.filter((s): s is string => typeof s === 'string')
    : undefined;

  const exited =
    raw.exited === true ||
    assistant?.exited === true ||
    response?.exited === true;

  const exitedAgent =
    (typeof raw.exited_agent === 'string' ? raw.exited_agent : undefined) ??
    (typeof assistant?.exited_agent === 'string' ? assistant.exited_agent : undefined);

  const exitReason =
    (typeof raw.exit_reason === 'string' ? raw.exit_reason : undefined) ??
    (typeof assistant?.exit_reason === 'string' ? assistant.exit_reason : undefined);

  const metaRaw = assistant?.meta ?? response?.meta ?? raw.meta;
  const meta = asRecord(metaRaw);

  return {
    reply,
    intent:
      typeof raw.intent === 'string'
        ? raw.intent
        : typeof assistant?.intent === 'string'
          ? assistant.intent
          : undefined,
    nextActions,
    cards: cards.filter((card) => card.type === 'job'),
    workflow,
    exited: exited || undefined,
    exitedAgent,
    exitReason,
    suggestedNextSteps,
    meta,
  };
}
