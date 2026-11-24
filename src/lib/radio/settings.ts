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

// ── speed: kept by the app, not the server (Saving settings) ─────────────────────────────────
// One slider, in the player and in Radio settings. Until the listener moves it, it sits at the position for
// their level; once moved, the position is saved on the account (`PATCH prefs` `speed`) and used everywhere.
// A copy on this device has two jobs only: a save from the player that failed, and a listener who chose "Slow"
// before the slider. It is removed once a save succeeds and when radio memory is cleared.
const SPEED_KEY = 'kazi.radio.defaultSpeed';
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.2;
export const SPEED_STEP = 0.05;
/** Where the slider sits for each level while the listener has not moved it. */
export const SPEED_BY_BAND: Record<string, number> = { A2: 0.7, B1: 0.8, B2: 0.9, C1: 1 };

/** The slider position for a level, or `null` when the level is not known: the mark on the slider. */
export function levelSpeed(band: string | null | undefined): number | null {
  return (band ? SPEED_BY_BAND[band] : undefined) ?? null;
}

/** Onto the slider's range and step (0.5 … 1.2 in steps of 0.05). */
export function clampSpeed(v: number): number {
  if (!Number.isFinite(v)) return 1;
  const stepped = Math.round(v / SPEED_STEP) * SPEED_STEP;
  return Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, stepped)) * 100) / 100;
}

/** The position the listener saved on this device, or `null` when they never moved the slider. */
export function readSavedSpeed(): number | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SPEED_KEY) : null;
    if (raw == null || raw.trim() === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? clampSpeed(v) : null;
  } catch {
    return null;
  }
}

/**
 * The speed a listen starts at: the position saved on the account (`prefs.speed`), else the copy on this device,
 * else the one for the listener's level, else 1×.
 */
export function startSpeed(band: string | null | undefined, account?: number | null): number {
  if (typeof account === 'number' && Number.isFinite(account)) return clampSpeed(account);
  return readSavedSpeed() ?? (band ? SPEED_BY_BAND[band] : undefined) ?? 1;
}

/** Clearing radio memory removes the saved speed on the account; the device copy goes with it. */
export function clearSavedSpeed(): void {
  try {
    window.localStorage.removeItem(SPEED_KEY);
  } catch {
    // Blocked storage: there was no copy to remove.
  }
}

export function writeDefaultSpeed(speed: number): void {
  try {
    window.localStorage.setItem(SPEED_KEY, String(clampSpeed(speed)));
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
