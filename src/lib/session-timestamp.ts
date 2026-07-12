/** Parse session `updated_at` / `created_at` for sort comparisons. Invalid → 0. */
export function parseSessionTimestamp(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}
