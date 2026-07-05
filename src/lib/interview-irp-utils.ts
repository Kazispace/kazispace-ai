/** Clamp percentage values for progress bars / readiness scores. */
export function clampPct(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}
