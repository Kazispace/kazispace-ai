/**
 * Live Room (KAZI-1287): hands the session that Start opened to the Live screen, and the audio
 * element the Start tap unlocked.
 *
 * The session is held in memory only: there is no saved place and no "continue later"
 * (live-room.md, Screens and back). A Live screen opened with no session here (a reload, a link)
 * goes back to the radio home, whose `open_session_id` then ends the session that was left.
 *
 * One exception (KAZI-1366, live-room.md 0.11, The English part: "Coming back to it"): from the last
 * answer until the closing starts, the session is also kept in the tab's session storage, so a phone
 * that unloads the page while the screen is locked brings the user back to the English part.
 */
import type { LiveHost, LiveSession } from '@/types/radio-live';

export interface StartedLiveSession {
  session: LiveSession;
  host: LiveHost;
  /** `GET live/home` said this region must label (KAZI-1242): the Morse "AI" rhythm plays before the opening. */
  aigcLabel?: boolean;
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

/** The English part's session, kept in the tab across a reload (KAZI-1366). */
export const LIVE_ENGLISH_KEY = 'kazi.radio.live.english';
/** A kept English part older than this is forgotten (live-room.md 0.11). */
export const LIVE_ENGLISH_MAX_MS = 60 * 60 * 1000;

/** The last answer arrived: keep the session until the closing starts or the user leaves. */
export function keepLiveEnglish(s: StartedLiveSession, now: number = Date.now()): void {
  try {
    window.sessionStorage.setItem(LIVE_ENGLISH_KEY, JSON.stringify({ at: now, started: s }));
  } catch {
    // No session storage (private mode, a full quota): a reload goes back to the radio home, as before.
  }
}

export function forgetLiveEnglish(): void {
  try {
    window.sessionStorage.removeItem(LIVE_ENGLISH_KEY);
  } catch {
    // Nothing kept.
  }
}

/** The kept English part, if any and not older than {@link LIVE_ENGLISH_MAX_MS}; the AI marker never plays again. */
export function takeLiveEnglish(now: number = Date.now()): StartedLiveSession | null {
  try {
    const raw = window.sessionStorage.getItem(LIVE_ENGLISH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at?: unknown; started?: StartedLiveSession };
    if (typeof v.at !== 'number' || now - v.at > LIVE_ENGLISH_MAX_MS || !v.started?.session?.session_id || !v.started.host) {
      forgetLiveEnglish();
      return null;
    }
    return { ...v.started, aigcLabel: false };
  } catch {
    return null;
  }
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
