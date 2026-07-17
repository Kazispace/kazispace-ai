/** Helpers for assistant message action toolbar (quote / feedback / copy / save doc). */

/** Quote block for composer insert (Markdown-style). */
export function formatQuotedMessage(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  const lines = trimmed.split('\n').map((line) => `> ${line}`);
  return `${lines.join('\n')}\n\n`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Download assistant reply as a Markdown file (BE file API does not accept text/* yet). */
export function downloadMessageAsMarkdown(
  content: string,
  filenamePrefix = 'kazi-note',
): boolean {
  const body = content.trim();
  if (!body || typeof document === 'undefined') return false;
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const filename = `${filenamePrefix}-${stamp}.md`;
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
