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
  /**
   * Template allowlist tag + future analytics.
   * Does **not** force FE routing — send path is plain text → `/turn` intent.
   */
  capability_id?: string;
  priority: number;
}

export interface StarterExampleDef {
  id: string;
  promptKey: string;
  /** Same as capability chips — validation / analytics only; not FE routing. */
  capability_id?: string;
  /** P1 reserved: strong playbook bind on `/turn` (ignored in MVP). */
  playbook_id?: string;
  priority: number;
}

export interface SpaceStarterConfig {
  enabled: boolean;
  capabilities: StarterCapabilityDef[];
  examples: StarterExampleDef[];
}
