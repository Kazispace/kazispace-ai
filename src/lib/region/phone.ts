/**
 * Phone normalization + longest-prefix match (align BE region.phone.resolve_phone_region).
 */

/** Strip spaces; map 00→+; bare 86… → +86… */
export function normalizePhone(raw: string): string {
  let phone = raw.replace(/\s+/g, '').trim();
  if (!phone) return '';

  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`;
  }

  // Domestic CN without +: 86XXXXXXXXXXX
  if (!phone.startsWith('+') && /^86\d{8,}$/.test(phone)) {
    phone = `+${phone}`;
  }

  return phone;
}

/** Longest matching phone_prefix from the given prefix list. */
export function matchLongestPrefix(
  phone: string,
  prefixes: string[]
): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  let best: string | null = null;
  for (const prefix of prefixes) {
    if (!prefix) continue;
    if (normalized.startsWith(prefix)) {
      if (!best || prefix.length > best.length) {
        best = prefix;
      }
    }
  }
  return best;
}
