/**
 * Personal radio routes (KAZI-1209; kazispace-ui personal-radio.md, Screens and back).
 *
 * The radio lives under `/radio`. Its home is the Radio destination, with the tab bar (KAZI-1485,
 * kazispace-ui D36); a story's player, a program's player, replay and settings are sub-screens of it
 * and hide the tab bar, see `top-level-nav.ts`. ❌ Former (D28): all of them Studio sub-screens.
 */
export const RADIO_SEGMENT = 'radio';

export type RadioFrom = 'studio' | 'home';

export function radioHomeHref(locale: string): string {
  return `/${locale}/${RADIO_SEGMENT}`;
}

/** A story's player. `from=studio` when opened from Studio's continue card: back returns to Studio. */
export function radioStoryHref(locale: string, saveId: string, from: RadioFrom = 'home'): string {
  const q = from === 'studio' ? '?from=studio' : '';
  return `/${locale}/${RADIO_SEGMENT}/story/${encodeURIComponent(saveId)}${q}`;
}

/**
 * Radio settings (Radio settings · Screens and back). Opened from the player it carries the story,
 * so Back returns to it; from the radio home it carries nothing and Back returns home.
 */
export function radioSettingsHref(locale: string, from?: { saveId: string; from: RadioFrom }): string {
  const base = `${radioHomeHref(locale)}/settings`;
  if (!from) return base;
  const qs = new URLSearchParams({ save: from.saveId });
  if (from.from === 'studio') qs.set('from', 'studio');
  return `${base}?${qs.toString()}`;
}

/** Replay of a story (Replay); Back returns to the radio home. */
export function radioReplayHref(locale: string, saveId: string): string {
  return `${radioHomeHref(locale)}/replay/${encodeURIComponent(saveId)}`;
}

export function radioProgramHref(locale: string, programId: string): string {
  return `/${locale}/${RADIO_SEGMENT}/program/${encodeURIComponent(programId)}`;
}

/** A serial story line's page: its episodes (KAZI-1455). Back returns to the radio home. */
export function radioStorylineHref(locale: string, storylineId: string): string {
  return `/${locale}/${RADIO_SEGMENT}/serial/${encodeURIComponent(storylineId)}`;
}

/** One episode in the player. Back returns to the story line's page. */
export function radioEpisodeHref(locale: string, storylineId: string, programId: string): string {
  return `${radioStorylineHref(locale, storylineId)}/${encodeURIComponent(programId)}`;
}

/**
 * The Live screen (KAZI-1287; live-room.md, Screens and back). Opened only by Start on the radio
 * home, which hands it the session; back returns to the radio home and ends the session.
 */
export function radioLiveHref(locale: string): string {
  return `${radioHomeHref(locale)}/live`;
}

/**
 * Who is offered the radio (KAZI-1442; personal-radio.md, Who sees it): a Chinese or an English
 * interface. ❌ Former (D9 / MVP, 2026-11-03): Chinese only. Every other interface language is still
 * not offered. The server decides too; this only stops the app from asking for a closed language.
 */
export function isRadioLocale(locale: string | null | undefined): boolean {
  const tag = (locale ?? '').trim().toLowerCase().replace('_', '-');
  return tag === 'zh' || tag.startsWith('zh-') || tag === 'en' || tag.startsWith('en-');
}

/**
 * Who is offered Live Room (KAZI-1442; live-room.md, Who sees it): a Chinese interface only, narrower
 * than the radio. Owen 2026-11-22 chose "Live Room stays Chinese-only (Recommended)": "Open the stories
 * and programs to English, but keep Live Room Chinese-only until the English disclaimer is approved (a
 * legal question)" (the option wording is the agent's, the choice is Owen's). ⛔ Do not use
 * `isRadioLocale` for Live Room: an English interface gets the stories and programs but no Live section
 * and no Live screen.
 */
export function isLiveRoomLocale(locale: string | null | undefined): boolean {
  const tag = (locale ?? '').trim().toLowerCase().replace('_', '-');
  return tag === 'zh' || tag.startsWith('zh-');
}
