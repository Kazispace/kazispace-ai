/**
 * KAZI-1069 — `GET /api/v1/english/ability` response (ET Capability §5.5.6).
 *
 * Shape mirrors backend `agents/english_tutor/ability.compute_ability`; the test fixture
 * `lib/english-tutor/__fixtures__/kazi1067_ability_response.json` is generated from it.
 * All scores are on the 0–6 continuous scale, already rounded to two decimals.
 */
export type EnglishAbilityTrend = 'improving' | 'stable' | 'declining';

export interface EnglishAbilityWindow {
  n: number;
  /** Earlier-half mean (v1.0.21) — not the first score. */
  from: number;
  /** Later-half mean (v1.0.21) — not the latest score; use `points` for that. */
  to: number;
  /** `to − from`; may be negative. */
  delta: number;
}

export interface EnglishAbilityDimension {
  id: string;
  label: string;
  score: number | null;
}

export interface EnglishAbilityPoint {
  at: string | null;
  score: number | null;
  exam_type?: string | null;
}

export interface EnglishAbilityModality {
  current: number | null;
  trend: EnglishAbilityTrend | null;
  window: EnglishAbilityWindow;
  dimensions: EnglishAbilityDimension[];
  points: EnglishAbilityPoint[];
}

export type EnglishAbilityModalityId = 'writing' | 'speaking';

export interface EnglishAbility {
  scale: string;
  scale_version: string;
  overall: number | null;
  modalities: Partial<Record<EnglishAbilityModalityId, EnglishAbilityModality | null>>;
  resolved_tags: string[];
  updated_at: string | null;
}
