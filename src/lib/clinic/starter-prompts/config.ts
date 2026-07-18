/**
 * Clinic Starter Prompts — independent static config (KAZI-258 / PRD §3.4).
 * Do **not** reuse blank_conversation Space config.
 */

import type { SpaceStarterConfig } from '@/lib/spaces/starter-prompts/types';
import { resolveStarterCollapsed } from '@/lib/spaces/starter-prompts/config';

/** Honest capability tags for analytics / future routing — Clinic-reachable only. */
export const CLINIC_STARTER_ALLOWLIST = [
  'cv_builder',
  'job_search',
  'mock_interview',
  'generic_chat',
] as const;

export type ClinicStarterCapabilityId =
  (typeof CLINIC_STARTER_ALLOWLIST)[number];

/**
 * i18n keys are under `clinic.starter.*` (next-intl namespace `clinic`).
 * labelKey etc. are relative to that namespace (no `starter.` prefix duplication
 * when calling useTranslations('clinic')).
 */
export const CLINIC_STARTER_CONFIG: SpaceStarterConfig = {
  enabled: true,
  capabilities: [
    {
      id: 'ask',
      labelKey: 'starter.caps.ask.label',
      insertTextKey: 'starter.caps.ask.insert',
      descriptionKey: 'starter.caps.ask.desc',
      capability_id: 'generic_chat',
      priority: 10,
    },
    {
      id: 'cv',
      labelKey: 'starter.caps.cv.label',
      insertTextKey: 'starter.caps.cv.insert',
      descriptionKey: 'starter.caps.cv.desc',
      capability_id: 'cv_builder',
      priority: 20,
    },
    {
      id: 'jobs',
      labelKey: 'starter.caps.jobs.label',
      insertTextKey: 'starter.caps.jobs.insert',
      descriptionKey: 'starter.caps.jobs.desc',
      capability_id: 'job_search',
      priority: 30,
    },
    {
      id: 'interview',
      labelKey: 'starter.caps.interview.label',
      insertTextKey: 'starter.caps.interview.insert',
      descriptionKey: 'starter.caps.interview.desc',
      capability_id: 'mock_interview',
      priority: 40,
    },
  ],
  examples: [
    {
      id: 'cvOptimize',
      promptKey: 'starter.examples.cvOptimize',
      shortLabelKey: 'starter.examples.cvOptimizeShort',
      capability_id: 'cv_builder',
      priority: 10,
    },
    {
      id: 'kzJobs',
      promptKey: 'starter.examples.kzJobs',
      shortLabelKey: 'starter.examples.kzJobsShort',
      capability_id: 'job_search',
      priority: 20,
    },
    {
      id: 'interviewPrep',
      promptKey: 'starter.examples.interviewPrep',
      shortLabelKey: 'starter.examples.interviewPrepShort',
      capability_id: 'mock_interview',
      priority: 30,
    },
  ],
};

function isRenderable(cfg: SpaceStarterConfig): boolean {
  return (
    cfg.enabled &&
    (cfg.capabilities.length > 0 || cfg.examples.length > 0)
  );
}

export function assertClinicStarterAllowlist(cfg: SpaceStarterConfig): void {
  const allow = new Set<string>(CLINIC_STARTER_ALLOWLIST);
  const ids = [
    ...cfg.capabilities.map((c) => c.capability_id),
    ...cfg.examples.map((e) => e.capability_id),
  ].filter((id): id is string => Boolean(id));

  for (const id of ids) {
    if (!allow.has(id)) {
      throw new Error(
        `[clinic-starter] capability_id "${id}" not in allowlist [${CLINIC_STARTER_ALLOWLIST.join(', ')}]`
      );
    }
  }

  for (const ex of cfg.examples) {
    if (!ex.shortLabelKey) {
      console.warn(
        `[clinic-starter] example "${ex.id}" missing shortLabelKey`
      );
    }
  }
}

export function resolveClinicStarterConfig(options?: {
  assertInDev?: boolean;
}): SpaceStarterConfig | null {
  if (!isRenderable(CLINIC_STARTER_CONFIG)) return null;

  const assertInDev =
    options?.assertInDev ?? process.env.NODE_ENV !== 'production';
  if (assertInDev) {
    assertClinicStarterAllowlist(CLINIC_STARTER_CONFIG);
  }

  return CLINIC_STARTER_CONFIG;
}

/** Phase B hard mutex; Phase B+ may type-filter or use length >= 3 (D12). */
export function shouldHideClinicStarterForQuickReplies(
  options: ReadonlyArray<unknown>
): boolean {
  return options.length > 0;
}

export function clinicStarterCollapseStorageKey(
  clinicSessionId: string
): string {
  const id = clinicSessionId.trim() || 'pending';
  return `ks.starter.clinic.${id}.collapsed`;
}

export function readClinicStarterCollapsed(
  clinicSessionId: string
): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(
      clinicStarterCollapseStorageKey(clinicSessionId)
    );
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeClinicStarterCollapsed(
  clinicSessionId: string,
  collapsed: boolean
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      clinicStarterCollapseStorageKey(clinicSessionId),
      collapsed ? '1' : '0'
    );
  } catch {
    // ignore quota / private mode
  }
}

export { resolveStarterCollapsed };
