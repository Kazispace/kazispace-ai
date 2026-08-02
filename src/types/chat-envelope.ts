import type { SupportedLocale } from '@/lib/constants';

/** API label — plain string or per-locale map (INTEGRATION.md §6). */
export type LocalizedLabel = string | Partial<Record<SupportedLocale, string>>;

export type WorkflowStepStatus = 'pending' | 'current' | 'done' | 'skipped';

export interface WorkflowStep {
  id: string;
  label?: LocalizedLabel;
  status: WorkflowStepStatus;
  detail?: LocalizedLabel;
}

export interface AssistantWorkflow {
  agent_id: string;
  pipeline_state: string;
  steps: WorkflowStep[];
  /** BE SSOT — FE must not derive when omitted. */
  progress_pct?: number;
}

/** Per-action meta on `strategy_select` (KAZI-400 / BE #309 `merged_turn`). */
export interface StrategySelectActionMeta {
  rationale?: string;
  recommended?: boolean;
  confirm_skipped?: boolean;
}

/** User message meta when submitting a payload-based next_action (KAZI-469). */
export interface UserMessageActionMeta {
  action_type: string;
  action_payload: string;
  strategy_id?: string;
  task_id?: string;
}

export interface ChatNextAction {
  type: string;
  label?: LocalizedLabel;
  /** Agent CTA payload (e.g. role label or `__action:regenerate`). */
  payload?: string;
  path?: string;
  job_id?: string;
  session_id?: string;
  /** Action-level meta; `strategy_select` carries rationale / recommended (#309). */
  meta?: StrategySelectActionMeta;
}

export interface ChatJobCard {
  type: string;
  job_id?: string;
  title?: string;
  company?: string;
  location?: string | null;
  work_mode?: string | null;
  salary?: string | null;
  match_score?: number;
  is_locked?: boolean;
  logo_url?: string | null;
}

export interface ParsedAssistantEnvelope {
  reply: string;
  intent?: string;
  nextActions: ChatNextAction[];
  cards: ChatJobCard[];
  /** Research citation_list custom_component items (KAZI-223). */
  citations?: import('@/lib/clinic/citation-list').CitationItem[];
  /** web_search → research upgrade CTA (KAZI-233). */
  upgradeCta?: import('@/lib/clinic/upgrade-cta').UpgradeCtaPayload;
  /** Search capability from meta / intent (KAZI-234). */
  capabilityId?: import('@/lib/clinic/search-capability').SearchCapabilityId;
  /** Vertical playbook id when BE binds one (KAZI-234; chip tooltip). */
  playbookId?: string | null;
  workflow?: AssistantWorkflow;
  exited?: boolean;
  exitedAgent?: string;
  exitReason?: string;
  suggestedNextSteps?: string[];
  /** Domain extension from assistant_response.meta (e.g. interview_session_status). */
  meta?: Record<string, unknown>;
}
