/**
 * Research citation_list helpers (KAZI-223).
 * TODO(spaces): Space turn messages do not yet carry citations — wire when
 * workspace Research envelopes include custom_components.
 */

export type CitationItem = {
  url: string;
  title: string;
};

export type CitationListComponent = {
  type: 'citation_list';
  items: CitationItem[];
};

const SOURCES_HEADING_RE =
  /(?:^|\n)##\s*(信息来源|Sources|Information sources|Источники)\s*\n/gi;

/** Prefer the last heading — same rule as PR #124 Markdown sources split. */
function findLastSourcesHeading(
  text: string,
): { index: number; match: string } | null {
  let last: { index: number; match: string } | null = null;
  const re = new RegExp(SOURCES_HEADING_RE.source, SOURCES_HEADING_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    last = { index: m.index, match: m[0] };
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return last;
}

function titleFromUrl(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

/** First `citation_list` in assistant_response.custom_components (KAZI-223). */
export function parseCitationList(
  customComponents: unknown,
): CitationListComponent | null {
  if (!Array.isArray(customComponents)) return null;
  for (const raw of customComponents) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const block = raw as Record<string, unknown>;
    if (block.type !== 'citation_list') continue;
    const itemsRaw = block.items;
    if (!Array.isArray(itemsRaw)) continue;
    const items: CitationItem[] = [];
    for (const item of itemsRaw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      if (typeof row.url !== 'string' || !row.url.trim()) continue;
      const url = row.url.trim();
      const title =
        typeof row.title === 'string' && row.title.trim()
          ? row.title.trim()
          : titleFromUrl(url);
      items.push({ url, title });
    }
    if (items.length === 0) continue;
    return { type: 'citation_list', items };
  }
  return null;
}

/**
 * When structured citations are shown, drop the trailing Markdown sources
 * section so links are not duplicated (BE still embeds 信息来源 in text).
 * Uses the **last** sources heading so a mid-body false positive is kept.
 */
export function stripMarkdownSourcesSection(content: string): string {
  const text = content ?? '';
  const hit = findLastSourcesHeading(text);
  if (!hit) return text;
  const splitAt = hit.match.startsWith('\n') ? hit.index + 1 : hit.index;
  return text.slice(0, splitAt).trimEnd();
}
