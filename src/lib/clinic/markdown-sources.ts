/**
 * Split Research-style Markdown so the trailing「信息来源」block can render collapsed.
 * BE (quality v3) ends answers with `## 信息来源` + `📚 共 N 个来源` + short links.
 */

const SOURCES_HEADING_RE =
  /(?:^|\n)##\s*(信息来源|Sources|Information sources|Источники)\s*\n/gi;

export type SplitMarkdownSources = {
  body: string;
  /** Markdown after the sources heading (no heading line). */
  sourcesBody: string | null;
  /** Compact summary for <details>, e.g. 📚 共 3 个来源 */
  sourcesSummary: string | null;
};

/** Prefer the last heading — sources belong at the end; mid-body false positives stay in body. */
function findLastSourcesHeading(
  text: string,
): { index: number; match: string } | null {
  let last: { index: number; match: string } | null = null;
  const re = new RegExp(SOURCES_HEADING_RE.source, SOURCES_HEADING_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    last = { index: m.index, match: m[0] };
    // Avoid zero-length loops if a future pattern could match empty.
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return last;
}

export function splitMarkdownSources(content: string): SplitMarkdownSources {
  const text = content ?? '';
  const hit = findLastSourcesHeading(text);
  if (!hit) {
    return { body: text, sourcesBody: null, sourcesSummary: null };
  }

  const splitAt = hit.match.startsWith('\n') ? hit.index + 1 : hit.index;
  const body = text.slice(0, splitAt).trimEnd();
  const sourcesRaw = text.slice(hit.index + hit.match.length).trim();
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
