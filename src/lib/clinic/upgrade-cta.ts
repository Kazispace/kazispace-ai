/**
 * web_search → research upgrade CTA (KAZI-233 / design §4.3.6).
 * BE: assistant_response.meta.upgrade_cta (alias meta.cta).
 */

export type UpgradeCtaCitation = {
  url: string;
  title?: string;
  snippet?: string;
};

export type UpgradeCtaSeed = {
  question: string;
  playbook_id?: string | null;
  citations: UpgradeCtaCitation[];
};

export type UpgradeCtaPayload = {
  upgrade_to: 'research';
  /** BE label when present; UI falls back to i18n `chat.upgradeResearch.cta`. */
  label?: string;
  seed: UpgradeCtaSeed;
  /** Cleared after a successful same-thread handoff. */
  dismissed?: boolean;
};

/**
 * Mirror of BE `router._EXPLICIT_RESEARCH_MARKERS` (MVP optimistic waiting copy).
 * TODO(KAZI-233 follow-up): temporary FE guess — long-term BE should announce
 * the resolved capability on the first response frame so FE does not drift.
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

/** Match BE `build_upgrade_cta` citations[:8] seed cap. */
const MAX_SEED_CITATIONS = 8;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseCitations(raw: unknown): UpgradeCtaCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: UpgradeCtaCitation[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.url !== 'string' || !row.url.trim()) continue;
    const citation: UpgradeCtaCitation = { url: row.url.trim() };
    if (typeof row.title === 'string' && row.title.trim()) {
      citation.title = row.title.trim();
    }
    if (typeof row.snippet === 'string' && row.snippet.trim()) {
      citation.snippet = row.snippet.trim();
    }
    out.push(citation);
  }
  return out;
}

/**
 * Parse meta.upgrade_cta or meta.cta. Invalid / incomplete payloads → null
 * (caller shows body only; must not throw).
 */
export function parseUpgradeCta(meta: unknown): UpgradeCtaPayload | null {
  const root = asRecord(meta);
  if (!root) return null;
  const raw = asRecord(root.upgrade_cta) ?? asRecord(root.cta);
  if (!raw) return null;
  if (raw.upgrade_to !== 'research') return null;

  const seedRaw = asRecord(raw.seed);
  if (!seedRaw || typeof seedRaw.question !== 'string' || !seedRaw.question.trim()) {
    return null;
  }

  const label =
    typeof raw.label === 'string' && raw.label.trim()
      ? raw.label.trim()
      : undefined;

  const playbook =
    typeof seedRaw.playbook_id === 'string' && seedRaw.playbook_id.trim()
      ? seedRaw.playbook_id.trim()
      : seedRaw.playbook_id === null
        ? null
        : undefined;

  return {
    upgrade_to: 'research',
    ...(label ? { label } : {}),
    seed: {
      question: seedRaw.question.trim(),
      ...(playbook !== undefined ? { playbook_id: playbook } : {}),
      citations: parseCitations(seedRaw.citations),
    },
  };
}

/** True when the user text should route to research (mirrors BE markers). */
export function looksLikeResearchRequest(text: string): boolean {
  const lower = (text || '').toLowerCase();
  if (!lower.trim()) return false;
  return EXPLICIT_RESEARCH_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

/**
 * Same-thread handoff message: explicit research marker + seed question/citations.
 * BE has no structured seed field yet — pack into the user turn (design §4.3.6).
 */
export function buildResearchHandoffMessage(
  seed: UpgradeCtaSeed,
  locale: string,
): string {
  const question = seed.question.trim();
  const isZh = (locale || 'zh').toLowerCase().startsWith('zh');
  const header = isZh
    ? `帮我深入研究：${question}`
    : `Please do in-depth research: ${question}`;

  const citations = seed.citations
    .filter((c) => c.url.trim())
    .slice(0, MAX_SEED_CITATIONS);
  if (citations.length === 0) return header;

  const sourcesLabel = isZh
    ? '参考来源（请优先利用，避免重复抓取）'
    : 'Seed sources (prefer these; skip duplicate URLs)';
  const lines = citations.map((c) => {
    const title = c.title?.trim() || c.url;
    return `- ${title}: ${c.url}`;
  });
  return `${header}\n\n${sourcesLabel}:\n${lines.join('\n')}`;
}
