export type CitationItem = {
  url: string;
  title: string;
  snippet?: string;
  fetched_at?: string | null;
  has_full_text?: boolean;
  quality?: string;
};

export type CitationListComponent = {
  type: 'citation_list';
  items: CitationItem[];
};

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
      const title =
        typeof row.title === 'string' && row.title.trim()
          ? row.title.trim()
          : row.url;
      const entry: CitationItem = { url: row.url.trim(), title };
      if (typeof row.snippet === 'string') entry.snippet = row.snippet;
      if (typeof row.fetched_at === 'string' || row.fetched_at === null) {
        entry.fetched_at = row.fetched_at;
      }
      if (typeof row.has_full_text === 'boolean') {
        entry.has_full_text = row.has_full_text;
      }
      if (typeof row.quality === 'string') entry.quality = row.quality;
      items.push(entry);
    }
    if (items.length === 0) continue;
    return { type: 'citation_list', items };
  }
  return null;
}

/**
 * When structured citations are shown, drop the trailing Markdown sources
 * section so links are not duplicated (BE still embeds 信息来源 in text).
 */
export function stripMarkdownSourcesSection(content: string): string {
  return content
    .replace(
      /(?:^|\n)##\s*(信息来源|Sources|Information sources|Источники)\s*\n[\s\S]*$/i,
      '',
    )
    .trimEnd();
}
