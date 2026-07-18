/**
 * Starter Prompts — static config by template_id (KAZI-240).
 * SSOT: kazispace-design docs/prd/kazi-starter-prompts-prd-v1.0.md
 */

import type { SpaceStarterConfig, SpaceTemplateId } from './types';

/** Official template capability allowlists (space-config-schema.yaml). */
export const TEMPLATE_ALLOWLIST: Record<SpaceTemplateId, readonly string[]> = {
  blank_conversation: ['generic_chat'],
  job_sprint: ['cv_builder', 'mock_interview', 'job_search'],
  ielts_prep: ['english_tutor'],
};

const BLANK: SpaceStarterConfig = {
  enabled: true,
  capabilities: [
    {
      id: 'ask',
      labelKey: 'starter.blank.caps.ask.label',
      insertTextKey: 'starter.blank.caps.ask.insert',
      descriptionKey: 'starter.blank.caps.ask.desc',
      capability_id: 'generic_chat',
      priority: 10,
    },
    {
      id: 'translate',
      labelKey: 'starter.blank.caps.translate.label',
      insertTextKey: 'starter.blank.caps.translate.insert',
      descriptionKey: 'starter.blank.caps.translate.desc',
      capability_id: 'generic_chat',
      priority: 20,
    },
    {
      id: 'write',
      labelKey: 'starter.blank.caps.write.label',
      insertTextKey: 'starter.blank.caps.write.insert',
      descriptionKey: 'starter.blank.caps.write.desc',
      capability_id: 'generic_chat',
      priority: 30,
    },
    {
      id: 'brainstorm',
      labelKey: 'starter.blank.caps.brainstorm.label',
      insertTextKey: 'starter.blank.caps.brainstorm.insert',
      descriptionKey: 'starter.blank.caps.brainstorm.desc',
      capability_id: 'generic_chat',
      priority: 40,
    },
    {
      id: 'explain',
      labelKey: 'starter.blank.caps.explain.label',
      insertTextKey: 'starter.blank.caps.explain.insert',
      descriptionKey: 'starter.blank.caps.explain.desc',
      capability_id: 'generic_chat',
      priority: 50,
    },
  ],
  examples: [
    {
      id: 'transformer',
      promptKey: 'starter.blank.examples.transformer',
      shortLabelKey: 'starter.blank.examples.transformerShort',
      capability_id: 'generic_chat',
      priority: 10,
    },
    {
      id: 'email',
      promptKey: 'starter.blank.examples.email',
      shortLabelKey: 'starter.blank.examples.emailShort',
      capability_id: 'generic_chat',
      priority: 20,
    },
    {
      id: 'translatePaste',
      promptKey: 'starter.blank.examples.translatePaste',
      shortLabelKey: 'starter.blank.examples.translatePasteShort',
      capability_id: 'generic_chat',
      priority: 30,
    },
  ],
};

const JOB: SpaceStarterConfig = {
  enabled: true,
  capabilities: [
    {
      id: 'cv',
      labelKey: 'starter.job.caps.cv.label',
      insertTextKey: 'starter.job.caps.cv.insert',
      descriptionKey: 'starter.job.caps.cv.desc',
      capability_id: 'cv_builder',
      priority: 10,
    },
    {
      id: 'cover',
      labelKey: 'starter.job.caps.cover.label',
      insertTextKey: 'starter.job.caps.cover.insert',
      descriptionKey: 'starter.job.caps.cover.desc',
      capability_id: 'cv_builder',
      priority: 20,
    },
    {
      id: 'interview',
      labelKey: 'starter.job.caps.interview.label',
      insertTextKey: 'starter.job.caps.interview.insert',
      descriptionKey: 'starter.job.caps.interview.desc',
      capability_id: 'mock_interview',
      priority: 30,
    },
    {
      id: 'salary',
      labelKey: 'starter.job.caps.salary.label',
      insertTextKey: 'starter.job.caps.salary.insert',
      descriptionKey: 'starter.job.caps.salary.desc',
      capability_id: 'mock_interview',
      priority: 40,
    },
    {
      id: 'match',
      labelKey: 'starter.job.caps.match.label',
      insertTextKey: 'starter.job.caps.match.insert',
      descriptionKey: 'starter.job.caps.match.desc',
      capability_id: 'job_search',
      priority: 50,
    },
  ],
  examples: [
    {
      id: 'optimizeCv',
      promptKey: 'starter.job.examples.optimizeCv',
      shortLabelKey: 'starter.job.examples.optimizeCvShort',
      capability_id: 'cv_builder',
      priority: 10,
    },
    {
      id: 'mockInterview',
      promptKey: 'starter.job.examples.mockInterview',
      shortLabelKey: 'starter.job.examples.mockInterviewShort',
      capability_id: 'mock_interview',
      priority: 20,
    },
    {
      id: 'matchRoles',
      promptKey: 'starter.job.examples.matchRoles',
      shortLabelKey: 'starter.job.examples.matchRolesShort',
      capability_id: 'job_search',
      priority: 30,
    },
  ],
};

const IELTS: SpaceStarterConfig = {
  enabled: true,
  capabilities: [
    {
      id: 'speaking',
      labelKey: 'starter.ielts.caps.speaking.label',
      insertTextKey: 'starter.ielts.caps.speaking.insert',
      descriptionKey: 'starter.ielts.caps.speaking.desc',
      capability_id: 'english_tutor',
      priority: 10,
    },
    {
      id: 'writing',
      labelKey: 'starter.ielts.caps.writing.label',
      insertTextKey: 'starter.ielts.caps.writing.insert',
      descriptionKey: 'starter.ielts.caps.writing.desc',
      capability_id: 'english_tutor',
      priority: 20,
    },
    {
      id: 'plan',
      labelKey: 'starter.ielts.caps.plan.label',
      insertTextKey: 'starter.ielts.caps.plan.insert',
      descriptionKey: 'starter.ielts.caps.plan.desc',
      capability_id: 'english_tutor',
      priority: 30,
    },
    {
      id: 'grammar',
      labelKey: 'starter.ielts.caps.grammar.label',
      insertTextKey: 'starter.ielts.caps.grammar.insert',
      descriptionKey: 'starter.ielts.caps.grammar.desc',
      capability_id: 'english_tutor',
      priority: 40,
    },
    {
      id: 'topics',
      labelKey: 'starter.ielts.caps.topics.label',
      insertTextKey: 'starter.ielts.caps.topics.insert',
      descriptionKey: 'starter.ielts.caps.topics.desc',
      capability_id: 'english_tutor',
      priority: 50,
    },
  ],
  examples: [
    {
      id: 'speakingPart2',
      promptKey: 'starter.ielts.examples.speakingPart2',
      shortLabelKey: 'starter.ielts.examples.speakingPart2Short',
      capability_id: 'english_tutor',
      priority: 10,
    },
    {
      id: 'task2',
      promptKey: 'starter.ielts.examples.task2',
      shortLabelKey: 'starter.ielts.examples.task2Short',
      capability_id: 'english_tutor',
      priority: 20,
    },
    {
      id: 'eightWeek',
      promptKey: 'starter.ielts.examples.eightWeek',
      shortLabelKey: 'starter.ielts.examples.eightWeekShort',
      capability_id: 'english_tutor',
      priority: 30,
    },
  ],
};

export const STARTER_BY_TEMPLATE: Record<SpaceTemplateId, SpaceStarterConfig> = {
  blank_conversation: sortStarterConfig(BLANK),
  job_sprint: sortStarterConfig(JOB),
  ielts_prep: sortStarterConfig(IELTS),
};

function sortStarterConfig(cfg: SpaceStarterConfig): SpaceStarterConfig {
  return {
    ...cfg,
    capabilities: [...cfg.capabilities].sort((a, b) => a.priority - b.priority),
    examples: [...cfg.examples].sort((a, b) => a.priority - b.priority),
  };
}

export function isSpaceTemplateId(id: string): id is SpaceTemplateId {
  return id in STARTER_BY_TEMPLATE;
}

/** True when the bar should render (enabled + at least one chip or example). */
export function isStarterConfigRenderable(cfg: SpaceStarterConfig): boolean {
  if (!cfg.enabled) return false;
  return (
    (cfg.capabilities?.length ?? 0) > 0 || (cfg.examples?.length ?? 0) > 0
  );
}

/** Dev-only: throw if any capability_id is outside the template allowlist. */
export function assertStarterAllowlist(
  templateId: SpaceTemplateId,
  cfg: SpaceStarterConfig
): void {
  const allow = new Set(TEMPLATE_ALLOWLIST[templateId]);
  const ids = [
    ...cfg.capabilities.map((c) => c.capability_id),
    ...cfg.examples.map((e) => e.capability_id),
  ].filter((id): id is string => Boolean(id));

  for (const id of ids) {
    if (!allow.has(id)) {
      throw new Error(
        `[starter-prompts] ${templateId}: capability_id "${id}" not in allowlist [${Array.from(allow).join(', ')}]`
      );
    }
  }
}

/**
 * Resolve starter config for a space template.
 * Returns null when disabled, unknown template, or empty shell.
 * Lists are pre-sorted at module load (priority ASC).
 */
export function resolveStarterConfig(
  templateId: string,
  options?: { assertInDev?: boolean }
): SpaceStarterConfig | null {
  if (!isSpaceTemplateId(templateId)) return null;
  const cfg = STARTER_BY_TEMPLATE[templateId];
  if (!isStarterConfigRenderable(cfg)) return null;

  const assertInDev = options?.assertInDev ?? process.env.NODE_ENV !== 'production';
  if (assertInDev) {
    assertStarterAllowlist(templateId, cfg);
  }

  return cfg;
}

export function starterCollapseStorageKey(spaceId: string): string {
  return `ks.starter.${spaceId}.collapsed`;
}

/** Read collapsed preference; null = no preference stored. */
export function readStarterCollapsed(spaceId: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(starterCollapseStorageKey(spaceId));
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeStarterCollapsed(spaceId: string, collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      starterCollapseStorageKey(spaceId),
      collapsed ? '1' : '0'
    );
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Collapse scheme A (PRD §5.4 / SDD §4):
 * - No preference + no user messages → expanded
 * - No preference + has user messages → collapsed (first 0→1 auto-fold)
 * - Preference present → respect it (never re-force on later sends)
 */
export function resolveStarterCollapsed(params: {
  hasUserMessage: boolean;
  stored: boolean | null;
}): boolean {
  if (params.stored !== null) return params.stored;
  return params.hasUserMessage;
}
