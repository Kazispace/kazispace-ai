import type { SupportedLocale } from '@/lib/constants';

/** API label — plain string or per-locale map (INTEGRATION.md §6). */
export type LocalizedLabel = string | Partial<Record<SupportedLocale, string>>;

export interface ChatNextAction {
  type: string;
  label?: LocalizedLabel;
  /** Agent CTA payload (e.g. role label or `__action:regenerate`). */
  payload?: string;
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
}
