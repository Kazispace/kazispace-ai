/**
 * KAZI-1069 — pure view helpers for the ET ability panel (Capability §5.5.5 / §5.5.6).
 *
 * Kept free of React so the tests can drive them with the real `zh.json` through
 * next-intl's `createTranslator` (KAZI-1069 comment 13669: no hand-written translators).
 */
import type {
  EnglishAbilityModality,
  EnglishAbilityPoint,
  EnglishAbilityTrend,
} from '@/types/english-ability';
import type { DimensionTranslator } from '@/lib/english-tutor/dimension-label';

/**
 * `meta.event` values of a graded turn — the panel refetches when one arrives while it
 * is open. Backend source: `et_graph/envelope.py` (graph leg) and `writing_flow` /
 * `speaking_flow` (live leg) emit exactly these three.
 */
export const ABILITY_GRADING_EVENTS: ReadonlySet<string> = new Set([
  'writing_review',
  'writing_revise_review',
  'speaking_feedback',
]);

/** Scores arrive rounded; still format so `4` shows as `4.00` (AC-P1: two decimals). */
export function formatAbilityScore(score: number | null | undefined): string {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(2) : '—';
}

/** Sign comes from the value, not the template — `+-0.30` was the old bug (comment 13697). */
export function formatSignedDelta(delta: number): string {
  const rounded = Math.round(delta * 100) / 100;
  if (rounded > 0) return `+${rounded.toFixed(2)}`;
  if (rounded < 0) return `−${Math.abs(rounded).toFixed(2)}`;
  return '0.00';
}

/**
 * Localised trend word, or `null` when the backend sends a value we have no copy for.
 * `t.has` first — next-intl renders the key path on a miss, it ignores `defaultValue`
 * (KAZI-1064 write-back 13666).
 */
export function trendLabel(
  t: DimensionTranslator,
  trend: EnglishAbilityTrend | string | null | undefined
): string | null {
  if (!trend) return null;
  const key = `progressTrendValues.${trend}`;
  return t.has(key) ? t(key) : null;
}

/**
 * Latest graded score = the last point. ⛔ Not `window.to` — that is the later-half
 * mean since v1.0.21 (comment 13697 §3).
 */
export function latestPoint(
  modality: Pick<EnglishAbilityModality, 'points'> | null | undefined
): EnglishAbilityPoint | null {
  const points = modality?.points ?? [];
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (typeof points[i]?.score === 'number') return points[i];
  }
  return null;
}

/**
 * The window line starts at the same count the backend starts moving the trend
 * (`ability.TREND_MIN_N_TO_MOVE`, Capability §5.5.4 v1.0.20). With exactly two attempts the
 * trend is `stable` by rule, so "Stable · 2.67 → 4.00 (+1.33)" would contradict itself —
 * Owen 2026-10-13 (#230 review): show the window from three attempts.
 */
export const WINDOW_MIN_N = 3;

export function showsWindow(modality: EnglishAbilityModality | null | undefined): boolean {
  return (modality?.window?.n ?? 0) >= WINDOW_MIN_N;
}

/**
 * Id of the newest assistant message whose `meta.event` is a grading event, or `null`.
 * The panel keys its query on this, so a new graded turn refetches while open.
 */
export function latestGradingMessageId(
  messages: ReadonlyArray<{
    id: string;
    role: string;
    assistantMeta?: Record<string, unknown>;
  }>
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const event = m.assistantMeta?.event;
    if (typeof event === 'string' && ABILITY_GRADING_EVENTS.has(event)) return m.id;
  }
  return null;
}

/** SVG polyline points for a 0–6 sparkline; `null` scores are skipped. */
export function sparklinePath(
  points: ReadonlyArray<EnglishAbilityPoint>,
  { width, height, max = 6 }: { width: number; height: number; max?: number }
): { x: number; y: number; score: number }[] {
  const scored = points.filter((p): p is EnglishAbilityPoint & { score: number } =>
    typeof p.score === 'number'
  );
  if (scored.length === 0) return [];
  const step = scored.length > 1 ? width / (scored.length - 1) : 0;
  return scored.map((p, i) => ({
    x: scored.length > 1 ? i * step : width / 2,
    y: height - (Math.min(Math.max(p.score, 0), max) / max) * height,
    score: p.score,
  }));
}
