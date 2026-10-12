/**
 * KAZI-1064 (ET Capability §5.5.6): dimension names are localised by id on the FE;
 * the backend `label` (English) is the fallback, then the raw key.
 *
 * Uses `t.has` — next-intl's `t(key, { defaultValue })` does not fall back on a
 * missing key, it renders the key path (`english.envelope.dimensions.Task Response`,
 * KAZI-1064 write-back 13666).
 */
export type DimensionTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

export function dimensionLabel(
  t: DimensionTranslator,
  dim: { key: string; label?: string | null }
): string {
  const path = `dimensions.${dim.key}`;
  if (t.has(path)) return t(path);
  return dim.label || dim.key;
}
