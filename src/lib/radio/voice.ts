/**
 * Personal radio voice rules (KAZI-1209 part 2; kazispace-ui personal-radio.md, Voice · Data · A
 * spoken turn). Pure helpers, so the rules can be tested without a microphone.
 */

/** Record at most 20 seconds (Voice · Microphone button; Data · Format and size). */
export const RECORD_MAX_MS = 20_000;
/** Send at most 1 MB. */
export const AUDIO_MAX_BYTES = 1024 * 1024;
/** Recording ends by itself after this much quiet once speech has been heard. */
export const SILENCE_AFTER_SPEECH_MS = 1_200;
/** RMS level (0..1) above which the input counts as speech. */
export const SPEECH_LEVEL = 0.04;
/** How often the level meter is read. */
export const LEVEL_SAMPLE_MS = 100;
/** The listen window's length when the answer does not say (the server's default is 8 s). */
export const DEFAULT_LISTEN_WINDOW_MS = 8_000;
/** "Not understood" and "Can't take that" lines go after 3 seconds. */
export const VOICE_LINE_MS = 3_000;
/** Working: after 10 seconds `states.slow` appears under the button (D15). */
export const SLOW_AFTER_MS = 10_000;

/** Why voice cannot be used right now (Microphone button · Unavailable). */
export type MicUnavailable = 'region' | 'blocked' | 'no_device';

/**
 * What a failed `getUserMedia` means (Microphone access):
 * - a refusal (`NotAllowedError` / `SecurityError`) ⇒ the system has blocked the microphone;
 * - anything else (no microphone, one in use by another app, no recording support) is not a
 *   refusal ⇒ voice is unavailable for this visit, and the user's choice is left as it is.
 */
export function micErrorKind(err: unknown): 'blocked' | 'no_device' {
  const name = (err as { name?: string } | null)?.name;
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'no_device';
}

/** Web sends `voice.webm` (Opus); a browser that can only record MP4 / AAC sends `voice.m4a`. */
export function pickRecordingMime(isSupported: (mime: string) => boolean): string {
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (isSupported(mime)) return mime;
  }
  return '';
}

/** Name the file with its real extension: the server reads the format from it. */
export function recordingFileName(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 'voice.m4a';
  if (m.includes('ogg')) return 'voice.ogg';
  return 'voice.webm';
}

export type BlockedHelpPlatform = 'ios' | 'android' | 'desktop' | 'telegram';

/** Which steps the blocked-microphone help shows (Microphone access, the platform table). */
export function blockedHelpPlatform(
  userAgent: string,
  { telegram = false, maxTouchPoints = 0 }: { telegram?: boolean; maxTouchPoints?: number } = {}
): BlockedHelpPlatform {
  if (telegram || /Telegram/i.test(userAgent)) return 'telegram';
  // iPadOS reports a desktop Safari user agent; a touch screen tells them apart.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

/**
 * Commands the server parses from what the user said but leaves to the app (Data, Player: "the
 * parsed result of what the user said, so the app can carry out 'slower', 'pause', 'repeat' and
 * 'exit' itself"). The others (`advance`, `back`, `more_english`, `more_chinese`, `voice`,
 * `confirm`) come back with the next part.
 */
export const APP_COMMANDS = ['repeat', 'slower', 'faster', 'pause', 'resume', 'exit', 'save'] as const;
export type AppCommand = (typeof APP_COMMANDS)[number];

export function appCommandOf(parsed: { kind?: string; command?: string | null } | null | undefined): AppCommand | null {
  if (!parsed || parsed.kind !== 'command' || !parsed.command) return null;
  return (APP_COMMANDS as readonly string[]).includes(parsed.command) ? (parsed.command as AppCommand) : null;
}
