/**
 * Personal radio settings rules (KAZI-1209 part 4; kazispace-ui personal-radio.md, Radio settings ·
 * Data · Saving settings). Pure, so the rules are tested without a screen.
 */
import type { RadioBand } from '@/types/radio';

/** The English shares each level allows (Radio settings), and each level's default. */
export const EN_RATIOS: Record<RadioBand, number[]> = {
  A2: [0.2, 0.3, 0.4],
  B1: [0.3, 0.4, 0.5],
  B2: [0.5, 0.6, 0.7],
  C1: [0.7, 0.8],
};
export const EN_RATIO_DEFAULT: Record<RadioBand, number> = { A2: 0.3, B1: 0.4, B2: 0.6, C1: 0.8 };

/** Each voice id in `voices` has its label key under `radio.settings.voice`. */
export const VOICE_LABEL_KEY: Record<string, string> = {
  en_us_f1: 'usF',
  en_us_m1: 'usM',
  en_gb_f1: 'gbF',
  en_gb_m1: 'gbM',
};

/** Music sits from −30 to −12 dB below the voice, −18 dB by default; the switch starts on. */
export const BGM_LEVEL_MIN = -30;
export const BGM_LEVEL_MAX = -12;
export const BGM_LEVEL_DEFAULT = -18;

/** The English share as the segmented control shows it: 0.4 → "40%". */
export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** The share to mark: the stored one when the level allows it, else the level's default. */
export function shownEnRatio(band: RadioBand, ratio: number | null | undefined): number {
  if (ratio != null && EN_RATIOS[band].some((r) => Math.abs(r - ratio) < 1e-6)) return ratio;
  return EN_RATIO_DEFAULT[band];
}

// ── default speed: kept by the app, not the server (Saving settings) ─────────────────────────
const SPEED_KEY = 'kazi.radio.defaultSpeed';

export function readDefaultSpeed(): 1 | 0.75 {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(SPEED_KEY) === '0.75' ? 0.75 : 1;
  } catch {
    return 1;
  }
}

export function writeDefaultSpeed(speed: 1 | 0.75): void {
  try {
    window.localStorage.setItem(SPEED_KEY, String(speed));
  } catch {
    // Private mode or blocked storage: the setting lasts for this visit only.
  }
}

// ── where the player was when it opened settings (Back resumes from that sentence) ─────────────
const RESUME_KEY = (saveId: string) => `kazi.radio.resume.${saveId}`;

export function rememberPlace(saveId: string, nodeId: string, index: number): void {
  try {
    window.sessionStorage.setItem(RESUME_KEY(saveId), JSON.stringify({ nodeId, index }));
  } catch {
    // Without storage the player starts the part again from its first sentence.
  }
}

/** The sentence to resume from, once: read and forgotten. Only for the same part. */
export function takePlace(saveId: string, nodeId: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY(saveId));
    if (!raw) return null;
    window.sessionStorage.removeItem(RESUME_KEY(saveId));
    const v = JSON.parse(raw) as { nodeId?: string; index?: number };
    return v.nodeId === nodeId && typeof v.index === 'number' && v.index > 0 ? v.index : null;
  } catch {
    return null;
  }
}
