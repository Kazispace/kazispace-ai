/**
 * Search capability presentation helpers (KAZI-234).
 * BE: assistant_response.meta.capability_id / playbook_id (KAZI-230/231).
 */

export type SearchCapabilityId = 'web_search' | 'research';

/**
 * Known L1 search capabilities shown as Clinic chips.
 * Keep in sync with BE capability registry (`web_search` / `research`);
 * unknown ids fall through to the raw intent badge.
 */
const KNOWN: ReadonlySet<string> = new Set(['web_search', 'research']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asCapabilityId(value: unknown): SearchCapabilityId | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim();
  return KNOWN.has(id) ? (id as SearchCapabilityId) : undefined;
}

export type ResolvedSearchCapability = {
  capabilityId?: SearchCapabilityId;
  /** Present when BE sent playbook_id (including null unbound). */
  playbookId?: string | null;
};

/**
 * Resolve capability/playbook from envelope meta + intent fallback.
 * Invalid / unknown values are ignored (no crash).
 */
export function resolveSearchCapability(input: {
  meta?: Record<string, unknown> | null;
  intent?: string;
  /** Top-level payload.capability_id (research branch may set this). */
  topLevelCapabilityId?: unknown;
}): ResolvedSearchCapability {
  const meta = input.meta ? asRecord(input.meta) : null;

  const capabilityId =
    asCapabilityId(meta?.capability_id) ??
    asCapabilityId(input.topLevelCapabilityId) ??
    asCapabilityId(input.intent);

  let playbookId: string | null | undefined;
  if (meta && 'playbook_id' in meta) {
    const raw = meta.playbook_id;
    if (raw === null) playbookId = null;
    else if (typeof raw === 'string' && raw.trim()) playbookId = raw.trim();
  }

  return {
    ...(capabilityId ? { capabilityId } : {}),
    ...(playbookId !== undefined ? { playbookId } : {}),
  };
}

export function isSearchCapability(
  value: string | undefined | null,
): value is SearchCapabilityId {
  return value === 'web_search' || value === 'research';
}

/**
 * Tooltip for playbook chip.
 * - `undefined` → BE omitted the field (no tooltip)
 * - `null` → unbound / general search
 * - `string` → bound playbook id
 */
export function playbookChipTitle(
  playbookId: string | null | undefined,
  labels: { bound: (id: string) => string; unbound: string },
): string | undefined {
  if (playbookId === undefined) return undefined;
  if (playbookId === null) return labels.unbound;
  return labels.bound(playbookId);
}

/**
 * Phrases that ask for research (mirror of the backend's explicit research
 * markers). Only picks the waiting copy while a reply is pending; it never
 * changes the request, and depth is decided by the backend (KAZI-1137).
 */
const EXPLICIT_RESEARCH_MARKERS = [
  '深入研究',
  '深度研究',
  '深度调研',
  '出报告',
  '写一份报告',
  '多源对比',
  'deep research',
  'in-depth research',
  'thorough research',
  'full report',
  '需要更深入研究',
  '帮我深入研究',
] as const;

/** True when the user text explicitly asks for research (waiting copy only). */
export function looksLikeResearchRequest(text: string): boolean {
  const lower = (text || '').toLowerCase();
  if (!lower.trim()) return false;
  return EXPLICIT_RESEARCH_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}
