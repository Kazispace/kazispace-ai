/** Starter Prompts — types (KAZI-238 / PRD + FE SDD). */

export type SpaceTemplateId =
  | 'blank_conversation'
  | 'job_sprint'
  | 'ielts_prep';

export interface StarterCapabilityDef {
  id: string;
  /** next-intl key under `spaces` */
  labelKey: string;
  insertTextKey: string;
  descriptionKey?: string;
  /** Must be ⊆ template allowlist when set */
  capability_id?: string;
  priority: number;
}

export interface StarterExampleDef {
  id: string;
  promptKey: string;
  capability_id?: string;
  playbook_id?: string;
  priority: number;
}

export interface SpaceStarterConfig {
  enabled: boolean;
  capabilities: StarterCapabilityDef[];
  examples: StarterExampleDef[];
}
