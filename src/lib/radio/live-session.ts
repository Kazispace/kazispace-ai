/**
 * Live Room (KAZI-1287): hands the session that Start opened to the Live screen, and the audio
 * element the Start tap unlocked.
 *
 * The session is held in memory only: there is no saved place and no "continue later"
 * (live-room.md, Screens and back). A Live screen opened with no session here (a reload, a link)
 * goes back to the radio home, whose `open_session_id` then ends the session that was left.
 */
import type { LiveHost, LiveSession } from '@/types/radio-live';

export interface StartedLiveSession {
  session: LiveSession;
  host: LiveHost;
}

let started: StartedLiveSession | null = null;
let unlocked: HTMLAudioElement | null = null;

/** 75 ms of silence (8 kHz, 8-bit mono WAV, 595 samples): played inside the tap so later play() is allowed. */
export const LIVE_SILENCE_WAV =
  'data:audio/wav;base64,UklGRncCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVMCAACA' + 'gICA'.repeat(198);

/**
 * Call inside the Start (or Agree) tap, before anything is awaited. Browsers allow audio that starts
 * in a tap; an element that has played once may play again later without one. The opening then plays
 * at once when the Live screen opens (live-room.md, A session, step by step: Opening).
 */
export function unlockLiveAudio(): void {
  if (typeof Audio === 'undefined') return;
  const a = unlocked ?? new Audio();
  unlocked = a;
  try {
    a.src = LIVE_SILENCE_WAV;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  } catch {
    // Some browsers throw instead of rejecting; the opening then waits for a tap on Replay.
  }
}

/** The element unlocked by the Start tap, if any. The Live screen plays every host line through it. */
export function liveAudioElement(): HTMLAudioElement | null {
  return unlocked;
}

export function setStartedLiveSession(s: StartedLiveSession): void {
  started = s;
}

/** The session Start opened, once: a second Live screen (or a reload) does not get it again. */
export function takeStartedLiveSession(): StartedLiveSession | null {
  const s = started;
  started = null;
  return s;
}

/** For tests. */
export function resetLiveSessionForTest(): void {
  started = null;
  unlocked = null;
}

/** The microphone card's answer on this device (live-room.md 0.4, Microphone access). */
export const LIVE_MIC_CONSENT_KEY = 'kazi.radio.live.micConsent';

/**
 * Whether the user turned the microphone on from Live Room's card on this device. Decided by the
 * user's choice, not the browser's permission state (some browsers forget it at every visit).
 */
export function liveMicConsented(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(LIVE_MIC_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLiveMicConsented(): void {
  try {
    window.localStorage.setItem(LIVE_MIC_CONSENT_KEY, '1');
  } catch {
    // Storage blocked (a private window): the card shows again next visit, which is safe.
  }
}

/** The system has already blocked the microphone: the card would lead nowhere, so the help opens instead. */
export async function liveMicDenied(): Promise<boolean> {
  try {
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    if (!perms?.query) return false;
    const st = await perms.query({ name: 'microphone' as PermissionName });
    return st.state === 'denied';
  } catch {
    return false;
  }
}
