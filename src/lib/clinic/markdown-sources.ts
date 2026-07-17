/**
 * Split Research-style Markdown so the trailing「信息来源」block can render collapsed.
 * BE (quality v3) ends answers with `## 信息来源` + `📚 共 N 个来源` + short links.
 */

const SOURCES_HEADING_RE =
  /(?:^|\n)##\s*(信息来源|Sources|Information sources|Источники)\s*\n/i;

export type SplitMarkdownSources = {
  body: string;
  /** Markdown after the sources heading (no heading line). */
  sourcesBody: string | null;
  /** Compact summary for <details>, e.g. 📚 共 3 个来源 */
  sourcesSummary: string | null;
};

export function splitMarkdownSources(content: string): SplitMarkdownSources {
  const text = content ?? '';
  const match = SOURCES_HEADING_RE.exec(text);
  if (!match || match.index == null) {
    return { body: text, sourcesBody: null, sourcesSummary: null };
  }

  const splitAt = match[0].startsWith('\n') ? match.index + 1 : match.index;
  const body = text.slice(0, splitAt).trimEnd();
  const sourcesRaw = text.slice(match.index + match[0].length).trim();
  if (!sourcesRaw) {
    return { body: body || text, sourcesBody: null, sourcesSummary: null };
  }

  const lines = sourcesRaw.split('\n');
  const first = lines[0]?.trim() ?? '';
  const summaryFromLine = /^📚/.test(first)
    ? first
    : first.match(/共\s*\d+\s*个来源/)
      ? first
      : null;

  const sourcesBody = summaryFromLine
    ? lines.slice(1).join('\n').trim()
    : sourcesRaw;

  const countMatch = sourcesRaw.match(/共\s*(\d+)\s*个来源/);
  const linkCount = (sourcesRaw.match(/^\s*-\s*\[/gm) ?? []).length;
  const sourcesSummary =
    summaryFromLine ??
    (countMatch
      ? `📚 共 ${countMatch[1]} 个来源`
      : linkCount > 0
        ? `📚 共 ${linkCount} 个来源`
        : '📚 来源');

  return {
    body: body || text,
    sourcesBody: sourcesBody || null,
    sourcesSummary,
  };
}
